// ═══════════════════════════════════════════════════════════════
// useDocumentRegistry — Door 2: Upload hub + registry state
// ═══════════════════════════════════════════════════════════════
// Manages multi-file upload queue, tracks each file as a
// DocumentRecord, orchestrates prepare→PUT→confirm protocol.
// No OCR. No extraction. No AI.
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import {
  type DocumentRecord,
  type DocumentSlotType,
  type SourceSurface,
  createPendingRecord,
} from '@/features/documents/document-registry-model';
import { uploadAndRegisterFile } from '@/features/documents/uploadAndRegister';

interface UseDocumentRegistryOptions {
  studentId: string | null;
  /** Called after all uploads complete (for parent refresh) */
  onBatchComplete?: () => void;
}

interface UseDocumentRegistryResult {
  /** All records in current session (pending + done + failed) */
  records: DocumentRecord[];
  /** True when any upload is in progress */
  isUploading: boolean;
  /** Number of files currently in queue/uploading */
  activeCount: number;
  /** Add files to the upload queue and start processing */
  enqueueFiles: (files: File[], source?: SourceSurface, slotHint?: DocumentSlotType | null) => void;
  /** Cancel a pending (not yet started) upload */
  cancelRecord: (documentId: string) => void;
  /** Remove a completed/failed record from the list */
  dismissRecord: (documentId: string) => void;
  /** Clear all completed/failed records */
  clearCompleted: () => void;
}

export function useDocumentRegistry({
  studentId,
  onBatchComplete,
}: UseDocumentRegistryOptions): UseDocumentRegistryResult {
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const processingRef = useRef(false);
  const queueRef = useRef<{ record: DocumentRecord; file: File }[]>([]);

  const updateRecord = useCallback((id: string, patch: Partial<DocumentRecord>) => {
    setRecords(prev =>
      prev.map(r => r.document_id === id ? { ...r, ...patch, updated_at: new Date().toISOString() } : r)
    );
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift();
      if (!item) break;

      const { record, file } = item;

      // Skip cancelled
      if (record.processing_status === 'cancelled') continue;

      // Mark uploading
      updateRecord(record.document_id, {
        processing_status: 'uploading',
        upload_progress: 10,
      });

      const result = await uploadAndRegisterFile({
        file,
        file_kind: record.slot_hint === 'unknown' || !record.slot_hint
          ? 'additional'
          : record.slot_hint === 'graduation_certificate'
            ? 'certificate'
            : record.slot_hint,
        description: `Uploaded via upload hub: ${file.name}`,
        onProgress: (stage, percent) => {
          const statusMap: Record<string, DocumentRecord['processing_status']> = {
            prepare: 'uploading',
            upload: 'uploading',
            confirm: 'confirming',
            done: 'registered',
            error: 'upload_failed',
          };
          updateRecord(record.document_id, {
            processing_status: statusMap[stage] || 'uploading',
            upload_progress: percent,
          });
        },
      });

      if (result.success) {
        updateRecord(record.document_id, {
          processing_status: 'registered',
          upload_progress: 100,
          crm_file_id: result.file_id || null,
          storage_path: result.path || null,
          file_url: result.file_url || null,
          error_message: null,
        });
      } else {
        updateRecord(record.document_id, {
          processing_status: 'upload_failed',
          upload_progress: 0,
          error_message: `${result.stage}: ${result.error}${result.details ? ` — ${result.details}` : ''}`,
        });
      }
    }

    processingRef.current = false;
    onBatchComplete?.();
  }, [updateRecord, onBatchComplete]);

  const enqueueFiles = useCallback(
    (files: File[], source: SourceSurface = 'upload_hub', slotHint?: DocumentSlotType | null) => {
      if (!studentId) return;

      const newRecords: DocumentRecord[] = [];
      const newQueue: { record: DocumentRecord; file: File }[] = [];

      for (const file of files) {
        const record = createPendingRecord(file, studentId, source, slotHint);
        newRecords.push(record);
        newQueue.push({ record, file });
      }

      setRecords(prev => [...prev, ...newRecords]);
      queueRef.current.push(...newQueue);
      processQueue();
    },
    [studentId, processQueue],
  );

  const cancelRecord = useCallback((documentId: string) => {
    // Remove from queue if not yet started
    queueRef.current = queueRef.current.filter(q => q.record.document_id !== documentId);
    updateRecord(documentId, { processing_status: 'cancelled', upload_progress: 0 });
  }, [updateRecord]);

  const dismissRecord = useCallback((documentId: string) => {
    setRecords(prev => prev.filter(r => r.document_id !== documentId));
  }, []);

  const clearCompleted = useCallback(() => {
    setRecords(prev => prev.filter(r =>
      r.processing_status !== 'registered' &&
      r.processing_status !== 'upload_failed' &&
      r.processing_status !== 'cancelled'
    ));
  }, []);

  const isUploading = records.some(r =>
    r.processing_status === 'pending_upload' ||
    r.processing_status === 'uploading' ||
    r.processing_status === 'confirming'
  );

  const activeCount = records.filter(r =>
    r.processing_status === 'pending_upload' ||
    r.processing_status === 'uploading' ||
    r.processing_status === 'confirming'
  ).length;

  return {
    records,
    isUploading,
    activeCount,
    enqueueFiles,
    cancelRecord,
    dismissRecord,
    clearCompleted,
  };
}
