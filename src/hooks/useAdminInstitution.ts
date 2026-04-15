/**
 * useAdminInstitution
 * 
 * Dedicated hook for admin institution view context.
 * Owns institution data independently from preview context.
 * Preview context is used as a SECONDARY rendering aid only.
 */
import { useState, useEffect, useCallback } from 'react';
import { getInstitutionById, type CrmInstitutionDetail } from '@/services/institutionCrmAdapter';
import { useInstitutionPreview } from '@/contexts/InstitutionPreviewContext';
import type { InstitutionAccessState } from '@/types/institution';

interface AdminInstitutionState {
  loading: boolean;
  institution: CrmInstitutionDetail | null;
  error: string | null;
  /** Local preview state for UI switching — NOT persisted */
  previewAccessState: InstitutionAccessState | null;
}

export function useAdminInstitution(institutionId: string | undefined) {
  const [state, setState] = useState<AdminInstitutionState>({
    loading: true,
    institution: null,
    error: null,
    previewAccessState: null,
  });

  const { startPreview, exitPreview } = useInstitutionPreview();

  const load = useCallback(async () => {
    if (!institutionId) {
      setState({ loading: false, institution: null, error: 'No institution ID', previewAccessState: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    const { data, error } = await getInstitutionById(institutionId);

    if (error) {
      setState({ loading: false, institution: null, error, previewAccessState: null });
      return;
    }

    if (!data) {
      setState({ loading: false, institution: null, error: null, previewAccessState: null });
      return;
    }

    setState({
      loading: false,
      institution: data,
      error: null,
      previewAccessState: data.accessState,
    });

    // Sync to preview context as secondary rendering aid
    // This allows the shared dashboard shell to render correctly
    startPreview({
      institutionId: data.institutionId || data.id,
      institutionName: data.institutionName,
      accessState: data.accessState,
      role: (data.role as any) || 'owner',
      allowedModules: data.allowedModules,
    });
  }, [institutionId, startPreview]);

  useEffect(() => {
    load();
    // Cleanup: exit preview when unmounting admin view
    return () => {
      exitPreview();
    };
  }, [institutionId]); // intentionally exclude load/exitPreview to avoid loops

  /**
   * Switch preview state locally (UI-only, not persisted to CRM).
   * Clearly labeled as preview operation.
   */
  const switchPreviewState = useCallback((newState: InstitutionAccessState) => {
    setState(prev => ({ ...prev, previewAccessState: newState }));
    // Also update preview context for dashboard shell rendering
    if (state.institution) {
      startPreview({
        institutionId: state.institution.institutionId || state.institution.id,
        institutionName: state.institution.institutionName,
        accessState: newState,
        role: (state.institution.role as any) || 'owner',
        allowedModules: state.institution.allowedModules,
      });
    }
  }, [state.institution, startPreview]);

  return {
    ...state,
    /** The real access state from CRM */
    realAccessState: state.institution?.accessState || null,
    /** The preview state for UI switching */
    previewAccessState: state.previewAccessState,
    switchPreviewState,
    reload: load,
  };
}
