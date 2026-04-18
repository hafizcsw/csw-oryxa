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

import { useCallback, useEffect, useRef } from 'react';
import { deleteFile } from '@/api/crmStorage';

const STORAGE_KEY = 'unsaved_documents_v1';

function readPending(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writePending(ids: string[]) {
  try {
    if (ids.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* noop */
  }
}

interface UseUnsavedDocumentsGuardOptions {
  /** Whether the guard should be active (e.g. only after profile/student is ready) */
  enabled?: boolean;
  /** Called after orphan cleanup completes so the UI can refresh its document list */
  onCleanupComplete?: () => void;
}

export function useUnsavedDocumentsGuard({
  enabled = true,
  onCleanupComplete,
}: UseUnsavedDocumentsGuardOptions = {}) {
  const pendingRef = useRef<Set<string>>(new Set(readPending()));
  const cleanupRanRef = useRef(false);

  // ─── 1. On mount: clean up any orphans from a previous session ───
  useEffect(() => {
    if (!enabled || cleanupRanRef.current) return;
    cleanupRanRef.current = true;

    const orphans = readPending();
    if (orphans.length === 0) {
      pendingRef.current = new Set();
      return;
    }

    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(orphans.map(id => deleteFile(id)));
      if (cancelled) return;
      const stillFailing: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)) {
          stillFailing.push(orphans[i]);
        }
      });
      writePending(stillFailing);
      pendingRef.current = new Set(stillFailing);
      if (import.meta.env.DEV) {
        console.log('[unsaved-guard] orphan cleanup', {
          attempted: orphans.length,
          failed: stillFailing.length,
        });
      }
      onCleanupComplete?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, onCleanupComplete]);

  // ─── 2. beforeunload: warn the user if there are unsaved docs ───
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingRef.current.size === 0) return;
      e.preventDefault();
      // Modern browsers ignore the custom string and show their own message.
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);

  // ─── API ─────────────────────────────────────────────────────────
  const trackDocument = useCallback((documentId: string) => {
    if (!documentId) return;
    pendingRef.current.add(documentId);
    writePending(Array.from(pendingRef.current));
  }, []);

  const untrackDocument = useCallback((documentId: string) => {
    if (!documentId) return;
    if (pendingRef.current.delete(documentId)) {
      writePending(Array.from(pendingRef.current));
    }
  }, []);

  /** Mark all currently tracked documents as saved (clears the guard list). */
  const confirmAllSaved = useCallback(() => {
    pendingRef.current = new Set();
    writePending([]);
  }, []);

  const getPendingCount = useCallback(() => pendingRef.current.size, []);
  const getPendingIds = useCallback(() => Array.from(pendingRef.current), []);

  return {
    trackDocument,
    untrackDocument,
    confirmAllSaved,
    getPendingCount,
    getPendingIds,
  };
}
