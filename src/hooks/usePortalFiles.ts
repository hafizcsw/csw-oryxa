import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PortalFile {
  id: string;
  file_kind: string;
  file_name: string;
  status: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  file_url: string | null;
  signed_url?: string | null;
  created_at: string;
  admin_notes?: string | null;
  // 🆕 Rejection info (from CRM)
  student_visible_note?: string | null;
  rejection_reason?: string | null;
  review_status?: 'pending' | 'approved' | 'rejected' | 'needs_fix' | string;
  // 🆕 Staff uploads visibility
  visibility?: 'internal' | 'student_visible' | null;
}

export function usePortalFiles() {
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);

  const listFiles = useCallback(async () => {
    setError(null);
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('student-portal-api', {
        body: { action: 'list_files' }
      });

      if (fnError) {
        console.error('[usePortalFiles] Function error:', fnError);
        setError('فشل الاتصال بالخادم');
        return;
      }

      // Handle feature not available
      if (data?.error === 'FEATURE_NOT_AVAILABLE') {
        console.warn('[usePortalFiles] Feature not available:', data.message);
        setFeatureAvailable(false);
        setFiles([]);
        return;
      }

      if (!data?.ok) {
        console.error('[usePortalFiles] API error:', data?.error);
        setError(data?.message || 'فشل تحميل الملفات');
        return;
      }

      setFiles(data.files || []);
      setFeatureAvailable(true);
    } catch (err) {
      console.error('[usePortalFiles] Error:', err);
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, []);

  // Get signed URL on-demand for a specific file
  const getSignedUrl = useCallback(async (file: PortalFile): Promise<string | null> => {
    if (!file.storage_bucket || !file.storage_path) {
      console.warn('[usePortalFiles] Missing storage info for file:', file.id);
      return file.file_url || null;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;

      const { data, error: fnError } = await supabase.functions.invoke('student-portal-api', {
        body: { 
          action: 'sign_file',
          storage_bucket: file.storage_bucket,
          storage_path: file.storage_path,
        }
      });

      if (fnError || !data?.ok) {
        console.error('[usePortalFiles] Sign file error:', fnError || data?.error);
        return file.file_url || null;
      }

      return data.signed_url || null;
    } catch (err) {
      console.error('[usePortalFiles] getSignedUrl error:', err);
      return file.file_url || null;
    }
  }, []);

  useEffect(() => {
    listFiles();
  }, [listFiles]);

  return {
    files,
    loading,
    error,
    featureAvailable,
    listFiles,
    getSignedUrl,
    refetch: listFiles,
  };
}
