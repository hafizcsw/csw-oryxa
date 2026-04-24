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
import { deleteFile, clearPendingFiles, markFilesSaved } from '@/api/crmStorage';
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

async function cleanupServerPending(): Promise<string[]> {
  const res = await clearPendingFiles();
  const deleted = res.ok ? (res.deleted || []) : [];
  if (deleted.length > 0) {
    await purgePhaseAForDocs(deleted);
  }
  return [];
}

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

  // ─── 1. On mount: clear any server-side pending files from prior abandoned sessions ───
  useEffect(() => {
    if (!enabled || cleanupRanRef.current) return;
    cleanupRanRef.current = true;

    let cancelled = false;
    (async () => {
      await cleanupServerPending();

      const orphans = readPending();
      const stillFailing = await discardIds(orphans);
      if (cancelled) return;
      sync(new Set(stillFailing));
      if (import.meta.env.DEV) {
        console.log('[unsaved-guard] orphan cleanup', {
          attempted_local: orphans.length,
          failed_local: stillFailing.length,
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

  const confirmAllSaved = useCallback(async (opts?: { confirmationTraceId?: string }) => {
    const ids = Array.from(pendingRef.current);
    if (ids.length > 0) {
      // Phase 1 — Draft-first:
      //   SaveDocumentsBar click alone does NOT trigger a CRM markFilesSaved.
      //   A real post_confirm call requires an explicit confirmationTraceId,
      //   which Phase 1 does not yet emit (Draft layer is Phase 2).
      //   We log the intent, clear local pending, and skip CRM.
      const hasTrace = !!opts?.confirmationTraceId;
      if (!hasTrace) {
        // eslint-disable-next-line no-console
        console.warn('[draftFirstGuard] save_docs_bar_confirmation_intent_logged_only', {
          marker: 'save_docs_bar_confirmation_intent',
          document_ids: ids,
          reason: 'phase_1_no_crm_confirmation_trace_yet',
        });
      } else {
        await markFilesSaved(ids, {
          context: 'study_file',
          confirmationState: 'post_confirm',
          confirmationTraceId: opts!.confirmationTraceId,
          attemptedAction: 'save_documents_bar_confirm',
        });
      }
    }
    sync(new Set());
  }, [sync]);

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
