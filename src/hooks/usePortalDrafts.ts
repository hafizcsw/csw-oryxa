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

  // Order 3R.1: poll while any draft is mid-OCR or mid-DeepSeek extraction.
  // Covers the new pipeline statuses emitted by oryxa-ocr-worker + oryxa-ai-provider.
  useEffect(() => {
    const RUNNING_EXTRACTION_STATUSES = new Set([
      "extraction_pending",
      "extraction_running",
      "ocr_running",
      "ocr_completed",
      "deepseek_extraction_running",
    ]);
    const anyRunning = drafts.some((d) =>
      RUNNING_EXTRACTION_STATUSES.has(d.extraction_status as string),
    );
    if (!anyRunning) return;
    const id = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [drafts, refresh]);

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
        // Order 3R.1: CSW-controlled OCR pre-processing → DeepSeek (oryxa-ai-provider).
        // The raw file never leaves Supabase storage / our VPS — only OCR text reaches DeepSeek.
        void (async () => {
          try {
            await supabase.functions.invoke("oryxa-ocr-worker", {
              body: { draft_id: (result.draft as PortalDraft).id },
            });
          } catch {
            // ignore — status is persisted on the draft row
          } finally {
            void refresh();
          }
        })();
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
  }, [studentUserId, refresh]);

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
