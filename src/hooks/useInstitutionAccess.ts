/**
 * Institution Access State Hook
 * Resolves institution access state and determines routing
 * Supports super-admin preview override
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { InstitutionAccessState, InstitutionAccessResponse, InstitutionRole } from '@/types/institution';

const ACCESS_STATE_ROUTES: Record<InstitutionAccessState, string> = {
  no_institution_link: '/institution/onboarding',
  claim_draft: '/institution/onboarding',
  claim_submitted: '/institution/pending',
  under_review: '/institution/pending',
  more_info_requested: '/institution/pending',
  rejected: '/institution/pending',
  verified: '/',
  restricted: '/',
  suspended: '/institution/locked',
};

/** Check if preview context is active in sessionStorage */
function getPreviewOverride() {
  try {
    const raw = sessionStorage.getItem('institution_preview_ctx');
    if (raw) {
      const ctx = JSON.parse(raw);
      if (ctx?.active) return ctx;
    }
  } catch {}
  return null;
}

export function useInstitutionAccess() {
  const [loading, setLoading] = useState(true);
  const [accessState, setAccessState] = useState<InstitutionAccessState | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [role, setRole] = useState<InstitutionRole | null>(null);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const resolve = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1) Check for super-admin preview override FIRST
    const preview = getPreviewOverride();
    if (preview) {
      setAccessState(preview.accessState);
      setInstitutionId(preview.institutionId);
      setInstitutionName(preview.institutionName);
      setRole(preview.role || 'owner');
      setAllowedModules(preview.allowedModules || []);
      setClaimId(null);
      setIsPreviewMode(true);
      setLoading(false);
      return preview.accessState;
    }

    setIsPreviewMode(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('NO_SESSION');
        setLoading(false);
        return null;
      }

      const { data, error: fnError } = await supabase.functions.invoke('institution-access-state', {
        body: { action: 'resolve' },
      });

      if (fnError) {
        console.error('[useInstitutionAccess] Error:', fnError);
        setError(fnError.message);
        setLoading(false);
        return null;
      }

      const response = data as InstitutionAccessResponse;
      
      if (!response.ok) {
        setAccessState('no_institution_link');
        setLoading(false);
        return 'no_institution_link';
      }

      setAccessState(response.access_state);
      setInstitutionId(response.institution_id || null);
      setInstitutionName(response.institution_name || null);
      setRole(response.role as InstitutionRole || null);
      setAllowedModules(response.allowed_modules || []);
      setClaimId(response.claim_id || null);
      setLoading(false);
      return response.access_state;
    } catch (err) {
      console.error('[useInstitutionAccess] Exception:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAccessState('no_institution_link');
      setLoading(false);
      return 'no_institution_link';
    }
  }, []);

  // Re-resolve when preview context changes
  useEffect(() => {
    resolve();

    // Listen for storage events (preview context changes in same tab)
    const handler = () => resolve();
    window.addEventListener('institution-preview-change', handler);
    return () => window.removeEventListener('institution-preview-change', handler);
  }, [resolve]);

  const getRoute = useCallback(() => {
    if (!accessState) return '/institution/onboarding';
    return ACCESS_STATE_ROUTES[accessState];
  }, [accessState]);

  const isModuleAllowed = useCallback((module: string) => {
    if (accessState === 'verified') return true;
    if (accessState === 'restricted') return allowedModules.includes(module);
    return false;
  }, [accessState, allowedModules]);

  return {
    loading,
    accessState,
    institutionId,
    institutionName,
    role,
    allowedModules,
    claimId,
    error,
    isPreviewMode,
    resolve,
    getRoute,
    isModuleAllowed,
  };
}
