// ═══════════════════════════════════════════════════════════════
// useUnsavedDocumentsGuard
// ───────────────────────────────────────────────────────────────
// Tracks documents uploaded in the current session that have NOT
// been explicitly saved by the user (via "Save & Agree" action).
//
// Behaviors:
//  1. beforeunload → browser native confirm dialog
//  2. on mount    → cleanup of any session-tracked docs from a
//                   previous session that were never confirmed
//
// IDs are tracked in sessionStorage (per tab) so a true page
// refresh / close still triggers cleanup, but other tabs are
// unaffected.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteFile, markFilesSaved } from '@/api/crmStorage';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'unsaved_documents_v1';

async function purgePhaseAForDocs(docIds: string[]): Promise<void> {
  if (docIds.length === 0) return;
  try {
    const { error } = await (supabase as any).rpc('phase_a_purge_for_documents', { _doc_ids: docIds });
    if (error && import.meta.env.DEV) {
      console.warn('[unsaved-guard] phase_a_purge_for_documents error', error);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[unsaved-guard] phase_a_purge call failed', e);
  }
}

async function discardIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const results = await Promise.allSettled(ids.map(id => deleteFile(id)));
  const stillFailing: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)) {
      stillFailing.push(ids[i]);
    }
  });
  await purgePhaseAForDocs(ids);
  return stillFailing;
}

// ⛔ Phase 1.2: cleanupServerPending() REMOVED.
// Calling clear_pending_files automatically on mount caused unconfirmed CRM
// deletes on every portal page load (runtime-observed: deleted_count=2 with
// no user action). CRM mutations must never run without explicit user
// confirmation. Cleanup of stale pending files now belongs to either:
//   (a) an explicit user action (Save / Discard bar), or
//   (b) an admin-side job — never page-load.

// We use localStorage (not sessionStorage) so a hard refresh / tab close
// still leaves a breadcrumb the NEXT mount can clean up. Without this, a
// real refresh wipes sessionStorage before cleanup ever runs, leaving
// orphan CRM files + Phase A rows behind.
function readPending(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writePending(ids: string[]) {
  try {
    if (ids.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* noop */
  }
}

interface UseUnsavedDocumentsGuardOptions {
  enabled?: boolean;
  onCleanupComplete?: () => void;
}

export function useUnsavedDocumentsGuard({
  enabled = true,
  onCleanupComplete,
}: UseUnsavedDocumentsGuardOptions = {}) {
  const [pendingIds, setPendingIds] = useState<string[]>(() => readPending());
  const pendingRef = useRef<Set<string>>(new Set(pendingIds));
  const cleanupRanRef = useRef(false);

  const sync = useCallback((next: Set<string>) => {
    pendingRef.current = next;
    const arr = Array.from(next);
    writePending(arr);
    setPendingIds(arr);
  }, []);

  // ─── 1. On mount: LOCAL-ONLY orphan reconciliation ───
  // Phase 1.2: We no longer call clear_pending_files on mount. We only
  // discard files that THIS browser already tracked locally as unsaved
  // (i.e. the user uploaded then closed the tab without saving). This
  // still requires per-file deleteFile() calls — those go through the
  // server-side firewall and require post_confirm context, so they will
  // be blocked unless explicitly authorized. That is the correct outcome:
  // page load alone must not mutate CRM.
  useEffect(() => {
    if (!enabled || cleanupRanRef.current) return;
    cleanupRanRef.current = true;

    let cancelled = false;
    (async () => {
      const orphans = readPending();
      if (orphans.length === 0) {
        onCleanupComplete?.();
        return;
      }
      // Local-only: do NOT auto-call CRM. Just surface the orphan IDs to
      // the UI and let the user decide via SaveDocumentsBar.
      if (cancelled) return;
      sync(new Set(orphans));
      if (import.meta.env.DEV) {
        console.log('[unsaved-guard] local orphan surface (no CRM mutation)', {
          surfaced_local: orphans.length,
        });
      }
      onCleanupComplete?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, onCleanupComplete, sync]);

  // ─── 2. beforeunload: warn the user if there are unsaved docs ───
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingRef.current.size === 0) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);

  // ─── API ─────────────────────────────────────────────────────────
  const trackDocument = useCallback((documentId: string) => {
    if (!documentId || pendingRef.current.has(documentId)) return;
    const next = new Set(pendingRef.current);
    next.add(documentId);
    sync(next);
  }, [sync]);

  const untrackDocument = useCallback((documentId: string) => {
    if (!documentId || !pendingRef.current.has(documentId)) return;
    const next = new Set(pendingRef.current);
    next.delete(documentId);
    sync(next);
  }, [sync]);

  const confirmAllSaved = useCallback(
    async (opts?: { confirmationTraceId?: string }): Promise<{
      ok: boolean;
      status:
        | 'noop'
        | 'confirmation_trace_required'
        | 'shared'
        | 'share_failed';
      error?: string;
    }> => {
      const ids = Array.from(pendingRef.current);
      if (ids.length === 0) {
        return { ok: true, status: 'noop' };
      }

      // ── Phase 1 — Draft-first guard ──
      // Without an explicit confirmationTraceId produced by a real share/confirm
      // event, we MUST NOT: call markFilesSaved, mutate saved status, or clear
      // the local pending set. UI stays in `awaiting_student_confirmation`.
      const hasTrace = !!opts?.confirmationTraceId;
      if (!hasTrace) {
        // eslint-disable-next-line no-console
        console.warn('[draftFirstGuard] save_docs_bar_confirmation_intent_logged_only', {
          marker: 'save_docs_bar_confirmation_intent_logged_only',
          document_ids: ids,
          reason: 'confirmation_trace_required',
        });
        // NOTE: intentionally NO sync(new Set()) here. Pending stays.
        return { ok: false, status: 'confirmation_trace_required' };
      }

      // Real post-confirm path (Phase 2+ will produce the trace).
      const result = await markFilesSaved(ids, {
        context: 'study_file',
        confirmationState: 'post_confirm',
        confirmationTraceId: opts!.confirmationTraceId,
        attemptedAction: 'save_documents_bar_confirm',
      });

      if (!result.ok) {
        // Share failed → keep pending, do NOT clear.
        // eslint-disable-next-line no-console
        console.warn('[draftFirstGuard] save_docs_bar_share_failed', {
          marker: 'save_docs_bar_share_failed',
          document_ids: ids,
          error: result.error,
        });
        return { ok: false, status: 'share_failed', error: result.error };
      }

      // Share succeeded → NOW it is safe to clear local pending.
      sync(new Set());
      return { ok: true, status: 'shared' };
    },
    [sync],
  );

  const discardAll = useCallback(async (): Promise<{ ok: boolean; failed: string[] }> => {
    const ids = Array.from(pendingRef.current);
    if (ids.length === 0) return { ok: true, failed: [] };
    const stillFailing = await discardIds(ids);
    sync(new Set(stillFailing));
    return { ok: stillFailing.length === 0, failed: stillFailing };
  }, [sync]);

  // Reconcile pending IDs against a known-valid set (e.g. current CRM docs).
  // Any tracked ID that is NOT in validIds will be dropped — prevents stale
  // counts when a file was deleted outside the normal untrack flow.
  const reconcileWithValidIds = useCallback((validIds: Iterable<string>) => {
    const valid = new Set(validIds);
    const current = pendingRef.current;
    let changed = false;
    const next = new Set<string>();
    current.forEach(id => {
      if (valid.has(id)) next.add(id);
      else changed = true;
    });
    if (changed) sync(next);
  }, [sync]);

  return {
    pendingCount: pendingIds.length,
    pendingIds,
    trackDocument,
    untrackDocument,
    confirmAllSaved,
    discardAll,
    reconcileWithValidIds,
  };
}
