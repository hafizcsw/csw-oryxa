// ═══════════════════════════════════════════════════════════════
// usePortalDrafts — Order 2: Portal Draft Layer state
// ───────────────────────────────────────────────────────────────
// Tracks Study File draft uploads. NO CRM contact.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import {
  uploadPortalDraft,
  listActivePortalDrafts,
  deletePortalDraft,
  type PortalDraft,
} from "@/features/documents/portalDrafts";
import { supabase } from "@/integrations/supabase/client";

export interface PortalDraftPending {
  tempId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: "uploading" | "failed";
  error?: string;
}

interface UsePortalDraftsOptions {
  studentUserId: string | null;
}

interface UsePortalDraftsResult {
  drafts: PortalDraft[];
  pending: PortalDraftPending[];
  isUploading: boolean;
  enqueueFiles: (files: File[]) => void;
  removeDraft: (draftId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePortalDrafts({ studentUserId }: UsePortalDraftsOptions): UsePortalDraftsResult {
  const [drafts, setDrafts] = useState<PortalDraft[]>([]);
  const [pending, setPending] = useState<PortalDraftPending[]>([]);
  const queueRef = useRef<{ tempId: string; file: File }[]>([]);
  const processingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!studentUserId) {
      setDrafts([]);
      return;
    }
    const list = await listActivePortalDrafts(studentUserId);
    setDrafts(list);
  }, [studentUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const processQueue = useCallback(async () => {
    if (processingRef.current || !studentUserId) return;
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift();
      if (!item) break;
      const { tempId, file } = item;

      const result = await uploadPortalDraft({
        file,
        studentUserId,
      });

      if (result.ok && result.draft) {
        setDrafts((prev) => [result.draft as PortalDraft, ...prev]);
        setPending((prev) => prev.filter((p) => p.tempId !== tempId));
      } else {
        setPending((prev) =>
          prev.map((p) =>
            p.tempId === tempId
              ? { ...p, status: "failed", error: `${result.stage ?? "?"}: ${result.error ?? "unknown"}` }
              : p,
          ),
        );
      }
    }

    processingRef.current = false;
  }, [studentUserId]);

  const enqueueFiles = useCallback(
    (files: File[]) => {
      if (!studentUserId || files.length === 0) return;
      const newPending: PortalDraftPending[] = [];
      const newQueue: { tempId: string; file: File }[] = [];

      for (const file of files) {
        const tempId = crypto.randomUUID();
        newPending.push({
          tempId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          status: "uploading",
        });
        newQueue.push({ tempId, file });
      }

      setPending((prev) => [...prev, ...newPending]);
      queueRef.current.push(...newQueue);
      void processQueue();
    },
    [studentUserId, processQueue],
  );

  const removeDraft = useCallback(
    async (draftId: string) => {
      // Optimistic remove
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      const res = await deletePortalDraft(draftId);
      if (!res.ok) {
        // Refresh to recover state if deletion failed
        await refresh();
      }
    },
    [refresh],
  );

  return {
    drafts,
    pending,
    isUploading: pending.some((p) => p.status === "uploading"),
    enqueueFiles,
    removeDraft,
    refresh,
  };
}
