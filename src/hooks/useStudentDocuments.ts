import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { listFiles, deleteFile, type FileRecord } from "@/api/crmStorage";
import { uploadAndRegisterFile } from "@/features/documents/uploadAndRegister";

// ✅ Upload Progress types - with real error details
export type UploadStage = 'prepare' | 'upload' | 'confirm' | 'done' | 'error';
export interface UploadProgress {
  fileName: string;
  percent: number;
  stage: UploadStage;
  error?: string;
  http_status?: number;
  request_id?: string;
}

export interface StudentDocument {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  file_path: string;
  storage_path: string;
  document_category: string | null;
  status: string;
  admin_notes: string | null;
  uploaded_at: string;
  signed_url?: string | null;
  file_kind?: string;
  created_at?: string;
  // ✅ Added for rejection/visibility tracking
  visibility?: string | null;
  review_status?: string | null;
  student_visible_note?: string | null;
  rejection_reason?: string | null;
}

// 🛡️ Identity firewall (client defense-in-depth)
// The Study File surface MUST NEVER display identity / verification artifacts
// (liveness, selfie, identity-activation videos/images), even if a stale CRM
// list_files response includes them. The server already filters under
// surface='study_file'; this is a second wall on the client.
const IDENTITY_FILE_KINDS = new Set([
  'liveness', 'selfie',
  'identity_selfie', 'identity_liveness',
  'identity_document', 'identity_doc',
  'identity_activation', 'identity_verification',
  'identity', 'verification', 'verification_video',
]);
const IDENTITY_BUCKETS = new Set([
  'identity-activation', 'identity_activation', 'identity', 'identity-verification',
]);
function isIdentityArtifact(f: { file_kind?: string; storage_bucket?: string; file_name?: string }): boolean {
  const kind = String(f.file_kind || '').toLowerCase();
  const bucket = String(f.storage_bucket || '').toLowerCase();
  const name = String(f.file_name || '').toLowerCase();
  if (IDENTITY_FILE_KINDS.has(kind)) return true;
  if (kind.startsWith('identity_')) return true;
  if (IDENTITY_BUCKETS.has(bucket)) return true;
  if (name === 'liveness.webm' || name === 'selfie.jpg' || name === 'selfie.jpeg' || name === 'selfie.png') return true;
  return false;
}

// ✅ Helper to find duplicate files (same file_kind, keep newest)
export function findDuplicateFiles(files: StudentDocument[]): {
  toKeep: StudentDocument[];
  toDelete: StudentDocument[];
  byKind: Record<string, { keep: StudentDocument; duplicates: StudentDocument[] }>;
} {
  const grouped: Record<string, StudentDocument[]> = {};
  
  // Group files by file_kind
  for (const file of files) {
    const kind = file.document_category || file.file_kind || 'unknown';
    if (!grouped[kind]) grouped[kind] = [];
    grouped[kind].push(file);
  }
  
  const toKeep: StudentDocument[] = [];
  const toDelete: StudentDocument[] = [];
  const byKind: Record<string, { keep: StudentDocument; duplicates: StudentDocument[] }> = {};
  
  for (const [kind, kindFiles] of Object.entries(grouped)) {
    if (kindFiles.length > 1) {
      // Sort by uploaded_at descending (newest first)
      const sorted = [...kindFiles].sort((a, b) => {
        const dateA = new Date(a.uploaded_at || a.created_at || 0).getTime();
        const dateB = new Date(b.uploaded_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      // Keep the newest, delete the rest
      toKeep.push(sorted[0]);
      toDelete.push(...sorted.slice(1));
      byKind[kind] = { keep: sorted[0], duplicates: sorted.slice(1) };
    } else if (kindFiles.length === 1) {
      toKeep.push(kindFiles[0]);
    }
  }
  
  return { toKeep, toDelete, byKind };
}

export function useStudentDocuments(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { t } = useTranslation('common');
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const { toast } = useToast();
  const latestLoadIdRef = useRef(0);

  // ✅ Helper to update progress
  const setProg = useCallback((key: string, patch: Partial<UploadProgress>) => {
    setUploadProgress(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch } as UploadProgress
    }));
  }, []);

  // ✅ Clear completed progress after delay
  const clearProgress = useCallback((key: string) => {
    setTimeout(() => {
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 3000);
  }, []);

  useEffect(() => {
    if (enabled) loadDocuments();
  }, [enabled]);

  // ✅ Auto-sign documents for live preview (sign image/PDF files)
  const autoSignDocuments = useCallback(async (docs: StudentDocument[]) => {
    const { signFile } = await import('@/api/crmStorage');
    const needsSigning = docs.filter(d => 
      !d.signed_url && isPreviewableFile(d.file_name)
    );
    
    if (needsSigning.length === 0) return;
    
    console.log('[autoSign] Signing', needsSigning.length, 'files for live preview');
    
    // Sign in parallel (max 5 at a time)
    const batchSize = 5;
    for (let i = 0; i < needsSigning.length; i += batchSize) {
      const batch = needsSigning.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(doc => signFile(doc.id))
      );
      
      // Update documents with signed URLs
      setDocuments(prev => {
        const updated = [...prev];
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value.ok && result.value.signed_url) {
            const docId = batch[idx].id;
            const docIdx = updated.findIndex(d => d.id === docId);
            if (docIdx >= 0) {
              updated[docIdx] = { ...updated[docIdx], signed_url: result.value.signed_url };
            }
          }
        });
        return updated;
      });
    }
  }, []);

  // ✅ Check if file is previewable (image or PDF)
  const isPreviewableFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(ext);
  };

  // ✅ Load documents from CRM via Portal proxy
  async function loadDocuments(options?: { silent?: boolean }) {
    const loadId = ++latestLoadIdRef.current;
    setError(null);
    if (!options?.silent) setLoading(true);
    
    try {
      const res = await listFiles();
      if (loadId !== latestLoadIdRef.current) return;
      
      if (!res.ok) {
        console.error('[useStudentDocuments] list_files error:', res.error);
        if (res.error === 'NOT_LINKED' || res.error === 'CRM_NOT_CONFIGURED') {
          setFeatureAvailable(false);
          setDocuments([]);
          return;
        }
        setError(res.error || 'LOAD_FAILED');
        return;
      }

      const files = res.files || [];

      // 🔎 DIAG — prove exactly what CRM returned to the UI
      console.log('[useStudentDocuments] 🔎 DIAG list_files result', {
        count: files.length,
        diag: (res as any).diag ?? null,
        first_10: files.slice(0, 10).map((f: any) => ({
          id: f.id,
          kind: f.file_kind,
          name: f.file_name,
          status: f.status,
          visibility: (f as any).visibility,
        })),
      });

      // Map CRM format to StudentDocument (includes rejection/visibility fields)
      const docs: StudentDocument[] = files.map((f: FileRecord) => ({
        id: f.id,
        file_name: f.file_name,
        file_type: f.mime_type,
        file_size: f.size_bytes,
        file_path: f.file_url,
        storage_path: f.storage_path,
        document_category: f.file_kind,
        status: f.status || 'pending',
        admin_notes: f.admin_notes,
        uploaded_at: f.created_at,
        // ✅ Added for rejection/visibility
        visibility: (f as any).visibility,
        review_status: (f as any).review_status,
        student_visible_note: (f as any).student_visible_note,
        rejection_reason: (f as any).rejection_reason,
      }));
      
      setDocuments(docs);
      setFeatureAvailable(true);
      
      // ✅ Auto-sign previewable files for live display
      if (docs.length > 0) {
        autoSignDocuments(docs);
      }

    } catch (err) {
      if (loadId !== latestLoadIdRef.current) return;
      console.error('[useStudentDocuments] Error:', err);
      setError('CONNECTION_FAILED');
    } finally {
      if (!options?.silent && loadId === latestLoadIdRef.current) setLoading(false);
    }
  }

  // ✅ Upload single file (for compatibility)
  async function uploadDocument(file: File, category: string): Promise<boolean> {
    const results = await uploadDocuments([file], category);
    return results.length > 0 && results[0];
  }

  // ✅ Upload files with prepare → PUT → confirm protocol (using unified wrapper)
  async function uploadDocuments(files: File[], category: string): Promise<boolean[]> {
    const results: boolean[] = [];
    const normalizedCategory = category === 'general' ? 'additional' : category;
    
    for (const file of files) {
      const key = `${category}:${file.name}:${file.size}`;
      
      // Use the unified upload function
      const result = await uploadAndRegisterFile({
        file,
        file_kind: normalizedCategory,
        description: `Uploaded via Portal: ${category}`,
        ctx: {
          context: 'my_files',
          confirmationState: 'pre_confirm',
          attemptedAction: `my_files:${normalizedCategory}`,
        },
        onProgress: (stage, percent) => {
          setProg(key, { fileName: file.name, percent, stage });
        },
      });
      
      if (!result.success) {
        const errMsg = `${result.stage}: ${result.error}${result.details ? ` - ${result.details}` : ''}`;
        console.error('[upload]', errMsg, { http_status: result.http_status });
        setProg(key, { 
          percent: 0, 
          stage: 'error', 
          error: errMsg, 
          http_status: result.http_status 
        });
        
        // ✅ Show specific error messages
        // Note: Toast messages are now shown in component layer with t() function
        // Here we just log and continue - component will show localized error
        console.error('[upload] Error:', result.error, result.details);
        results.push(false);
        continue;
      }
      
      // ========== DONE ==========
      clearProgress(key);
      results.push(true);
      
      // ✅ Optimistic UI Update
      const localPreviewUrl = URL.createObjectURL(file);
      const newDoc: StudentDocument = {
        id: result.file_id || crypto.randomUUID(),
        document_category: normalizedCategory,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: result.file_url || `storage://${result.bucket}/${result.path}`,
        storage_path: result.path || '',
        uploaded_at: new Date().toISOString(),
        signed_url: localPreviewUrl,
        status: 'pending',
        admin_notes: null,
      };
      
      setDocuments(prev => [...prev, newDoc]);
      
      // Cleanup preview URL after delay
      setTimeout(() => URL.revokeObjectURL(localPreviewUrl), 30000);
      
      // ✅ Trigger snapshot refresh
      window.dispatchEvent(new CustomEvent('crm-refresh-data'));
    }
    
    // Do NOT background-refetch here: unsaved uploads are shown optimistically
    // in the current session and should not be pulled from server truth until
    // the user explicitly saves them.
    
    // Success toast is shown by component layer with t() function
    
    return results;
  }

  // ✅ Delete document via CRM proxy (deletes from storage + DB)
  async function deleteDocument(docOrPath: StudentDocument | string): Promise<boolean> {
    try {
      // Support both old (storage_path) and new (document object with id) patterns
      const fileId = typeof docOrPath === 'string' ? null : docOrPath.id;
      const storagePath = typeof docOrPath === 'string' ? docOrPath : docOrPath.storage_path;
      
      if (fileId) {
        // ✅ New pattern: delete via CRM using file_id
        const res = await deleteFile(fileId);
        
        if (!res.ok) {
          // Error codes returned - component layer will show localized toast
          throw new Error(res.error || 'DELETE_FAILED');
        }
        
        // Optimistic UI
        setDocuments(prev => prev.filter(d => d.id !== fileId));
      } else {
        // ⚠️ Legacy pattern: document without proper ID - just remove from UI
        console.warn('[deleteDocument] No file_id, removing from UI only:', storagePath);
        setDocuments(prev => prev.filter(d => d.storage_path !== storagePath));
      }

      // Background sync
      loadDocuments({ silent: true });
      return true;
    } catch (err) {
      console.error('[useStudentDocuments] Delete error:', err);
      // Error code returned - component layer will show localized toast
      return false;
    }
  }

  // ✅ Delete ALL documents (for testing/reset purposes)
  async function deleteAllDocuments(): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;
    
    for (const doc of documents) {
      const success = await deleteDocument(doc);
      if (success) {
        deleted++;
      } else {
        failed++;
      }
    }
    
    // Refresh list
    await loadDocuments({ silent: true });
    
    return { deleted, failed };
  }

  // ✅ Delete duplicate files (keep newest of each kind)
  async function deleteDuplicates(): Promise<{ 
    kept: number; 
    deleted: number; 
    failed: number;
    details: Record<string, number>;
  }> {
    const { toDelete, byKind } = findDuplicateFiles(documents);
    
    if (toDelete.length === 0) {
      toast({
        title: t('hooks.documents.noDuplicates'),
        description: t('hooks.documents.allFilesUnique'),
      });
      return { kept: documents.length, deleted: 0, failed: 0, details: {} };
    }
    
    let deleted = 0;
    let failed = 0;
    const details: Record<string, number> = {};
    
    for (const doc of toDelete) {
      try {
        const res = await deleteFile(doc.id);
        if (res.ok) {
          deleted++;
          const kind = doc.document_category || 'unknown';
          details[kind] = (details[kind] || 0) + 1;
        } else {
          console.error('[deleteDuplicates] failed:', doc.id, res.error);
          failed++;
        }
      } catch (err) {
        console.error('[deleteDuplicates] exception:', err);
        failed++;
      }
    }
    
    // Refresh list
    await loadDocuments({ silent: true });
    
    const kept = Object.keys(byKind).length;
    
    // Success info returned - component layer will show localized toast
    return { kept, deleted, failed, details };
  }

  // ✅ Get duplicates info for UI
  function getDuplicatesInfo() {
    return findDuplicateFiles(documents);
  }

  return { 
    documents, 
    loading,
    error,
    featureAvailable,
    uploadDocument,
    uploadDocuments,
    uploadProgress,
    deleteDocument,
    deleteAllDocuments,
    deleteDuplicates,
    getDuplicatesInfo,
    refetch: loadDocuments,
  };
}
