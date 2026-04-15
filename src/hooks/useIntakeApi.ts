/**
 * useIntakeApi — hook for intake application operations via canonical edge function.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FileQualityResult } from '@/features/file-quality/types';

interface SubmitParams {
  programId: string;
  universityId: string;
  fileQuality: FileQualityResult;
}

interface TransitionParams {
  applicationId: string;
  newStatus: string;
  note?: string;
}

interface DocRequestParams {
  applicationId: string;
  docType: string;
  message?: string;
}

interface AddNoteParams {
  applicationId: string;
  note: string;
  visibility?: 'internal' | 'shared';
}

export function useIntakeApi() {
  const submit = useCallback(async ({ programId, universityId, fileQuality }: SubmitParams) => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: {
        action: 'application.submit',
        program_id: programId,
        university_id: universityId,
        file_quality_snapshot: {
          overall_score: fileQuality.overall_score,
          verdict: fileQuality.verdict,
          blocking_gaps: fileQuality.blocking_gaps.length,
          gates: fileQuality.gates,
        },
        overall_score: fileQuality.overall_score,
        verdict: fileQuality.verdict,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const listForUniversity = useCallback(async (
    universityId: string,
    status?: string,
    options?: { search?: string; sortBy?: string; sortOrder?: string; limit?: number; offset?: number }
  ) => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: {
        action: 'application.list',
        university_id: universityId,
        status: status || undefined,
        search: options?.search || undefined,
        sort_by: options?.sortBy || undefined,
        sort_order: options?.sortOrder || undefined,
        limit: options?.limit || 50,
        offset: options?.offset || 0,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { applications: data.applications || [], total: data.total ?? 0 };
  }, []);

  const getDetail = useCallback(async (applicationId: string) => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: { action: 'application.detail', application_id: applicationId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const transition = useCallback(async ({ applicationId, newStatus, note }: TransitionParams) => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: {
        action: 'application.transition',
        application_id: applicationId,
        new_status: newStatus,
        note: note || undefined,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const review = useCallback(async ({ applicationId, newStatus, reviewerNotes }: {
    applicationId: string;
    newStatus: 'under_review' | 'accepted' | 'rejected' | 'info_requested';
    reviewerNotes?: string;
  }) => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: {
        action: 'application.review',
        application_id: applicationId,
        new_status: newStatus,
        reviewer_notes: reviewerNotes,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const requestDocs = useCallback(async ({ applicationId, docType, message }: DocRequestParams) => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: {
        action: 'application.request_docs',
        application_id: applicationId,
        doc_type: docType,
        message: message || undefined,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const fulfillDocRequest = useCallback(async (docRequestId: string) => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: { action: 'application.fulfill_doc_request', doc_request_id: docRequestId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const addNote = useCallback(async ({ applicationId, note, visibility }: AddNoteParams) => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: {
        action: 'application.add_note',
        application_id: applicationId,
        note,
        visibility: visibility || 'internal',
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const myApplications = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: { action: 'application.my_list' },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.applications || [];
  }, []);

  const myApplicationDetail = useCallback(async (applicationId: string) => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: { action: 'application.my_detail', application_id: applicationId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const inquire = useCallback(async ({ universityId, programId, subject, message }: {
    universityId: string;
    programId?: string;
    subject?: string;
    message: string;
  }) => {
    const { data, error } = await supabase.functions.invoke('intake-api', {
      body: {
        action: 'inquiry.create',
        university_id: universityId,
        program_id: programId || undefined,
        subject: subject || undefined,
        message,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  return {
    submit,
    listForUniversity,
    getDetail,
    transition,
    review,
    requestDocs,
    fulfillDocRequest,
    addNote,
    myApplications,
    myApplicationDetail,
    inquire,
  };
}
