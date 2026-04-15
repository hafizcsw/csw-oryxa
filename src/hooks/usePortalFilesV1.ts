import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export interface PortalFileV1 {
  id: string;
  auth_user_id: string;
  application_id: string | null;
  file_kind: string;
  file_name: string;
  title: string | null;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: 'ready' | 'hidden' | 'rejected' | 'approved' | 'pending_review';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupedFiles {
  ready_downloads: PortalFileV1[];
  required_uploads: PortalFileV1[];
  additional: PortalFileV1[];
}

// File kind labels use i18n keys
export const FILE_KIND_KEYS: Record<string, { key: string; icon: string; priority: number }> = {
  // Ready Downloads (from admin/system)
  admission_letter: { key: 'hooks.files.kinds.admission_letter', icon: '📄', priority: 1 },
  contract: { key: 'hooks.files.kinds.contract', icon: '📝', priority: 2 },
  invoice: { key: 'hooks.files.kinds.invoice', icon: '🧾', priority: 3 },
  receipt: { key: 'hooks.files.kinds.receipt', icon: '🧾', priority: 4 },
  visa_invitation: { key: 'hooks.files.kinds.visa_invitation', icon: '✈️', priority: 5 },
  visa: { key: 'hooks.files.kinds.visa', icon: '🛂', priority: 6 },
  insurance: { key: 'hooks.files.kinds.insurance', icon: '🏥', priority: 7 },
  accommodation_letter: { key: 'hooks.files.kinds.accommodation_letter', icon: '🏠', priority: 8 },
  arrival_instructions: { key: 'hooks.files.kinds.arrival_instructions', icon: '📋', priority: 9 },
  // Required Uploads (from student)
  passport: { key: 'hooks.files.kinds.passport', icon: '🛂', priority: 10 },
  photo: { key: 'hooks.files.kinds.photo', icon: '📷', priority: 11 },
  certificate: { key: 'hooks.files.kinds.certificate', icon: '🎓', priority: 12 },
  transcript: { key: 'hooks.files.kinds.transcript', icon: '📊', priority: 13 },
  medical_report: { key: 'hooks.files.kinds.medical_report', icon: '🏥', priority: 14 },
  bank_statement: { key: 'hooks.files.kinds.bank_statement', icon: '🏦', priority: 15 },
  // Additional
  additional: { key: 'hooks.files.kinds.additional', icon: '📎', priority: 99 },
};

export function usePortalFilesV1(applicationId?: string) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<PortalFileV1[]>([]);
  const [grouped, setGrouped] = useState<GroupedFiles>({
    ready_downloads: [],
    required_uploads: [],
    additional: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('student-portal-api', {
        body: { 
          action: 'list_portal_files_v1',
          application_id: applicationId || undefined,
        }
      });

      if (fnError) {
        console.error('[usePortalFilesV1] Function error:', fnError);
        setError(t('hooks.files.connectionFailed'));
        return;
      }

      if (!data?.ok) {
        console.error('[usePortalFilesV1] API error:', data?.error);
        setError(data?.message || t('hooks.files.loadFailed'));
        return;
      }

      setFiles(data.files || []);
      setGrouped(data.grouped || { ready_downloads: [], required_uploads: [], additional: [] });
    } catch (err) {
      console.error('[usePortalFilesV1] Error:', err);
      setError(t('hooks.files.connectionFailed'));
    } finally {
      setLoading(false);
    }
  }, [applicationId, t]);

  // Get signed URL for a file
  const getSignedUrl = useCallback(async (file: PortalFileV1): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;

      const { data, error: fnError } = await supabase.functions.invoke('student-portal-api', {
        body: { 
          action: 'sign_portal_file_v1',
          file_id: file.id,
        }
      });

      if (fnError || !data?.ok) {
        console.error('[usePortalFilesV1] Sign file error:', fnError || data?.error);
        return null;
      }

      return data.signed_url || null;
    } catch (err) {
      console.error('[usePortalFilesV1] getSignedUrl error:', err);
      return null;
    }
  }, []);

  // Add a new file
  const addFile = useCallback(async (params: {
    file_kind: string;
    file_name: string;
    title?: string;
    storage_bucket?: string;
    storage_path: string;
    mime_type?: string;
    size_bytes?: number;
    application_id?: string;
  }): Promise<{ ok: boolean; file_id?: string; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { ok: false, error: t('hooks.files.notLoggedIn') };
      }

      const { data, error: fnError } = await supabase.functions.invoke('student-portal-api', {
        body: { 
          action: 'add_portal_file_v1',
          ...params,
        }
      });

      if (fnError || !data?.ok) {
        console.error('[usePortalFilesV1] Add file error:', fnError || data?.error);
        return { ok: false, error: data?.message || t('hooks.files.addFailed') };
      }

      // Refresh files list
      await fetchFiles();

      return { ok: true, file_id: data.file_id };
    } catch (err) {
      console.error('[usePortalFilesV1] addFile error:', err);
      return { ok: false, error: t('hooks.files.connectionFailed') };
    }
  }, [fetchFiles, t]);

  // Helper to get localized file kind label
  const getFileKindLabel = useCallback((kind: string): string => {
    const config = FILE_KIND_KEYS[kind];
    if (config) {
      return t(config.key);
    }
    return kind;
  }, [t]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Sort ready downloads by priority
  const sortedReadyDownloads = [...grouped.ready_downloads].sort((a, b) => {
    const priorityA = FILE_KIND_KEYS[a.file_kind]?.priority || 99;
    const priorityB = FILE_KIND_KEYS[b.file_kind]?.priority || 99;
    return priorityA - priorityB;
  });

  return {
    files,
    grouped: {
      ...grouped,
      ready_downloads: sortedReadyDownloads,
    },
    loading,
    error,
    refetch: fetchFiles,
    getSignedUrl,
    addFile,
    getFileKindLabel,
  };
}
