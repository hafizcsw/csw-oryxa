/**
 * Determines if the current authenticated user can control a specific university page.
 * Uses resolved granted-access state from the institution access resolver.
 * Recognizes both university_page_staff and approved institution_claims.
 */
import { useInstitutionAccess } from '@/hooks/useInstitutionAccess';

export function useInstitutionPageControl(universityId: string | null | undefined) {
  const {
    loading,
    accessState,
    institutionId,
    role,
    isPreviewMode,
  } = useInstitutionAccess();

  // Control is granted when:
  // 1. Access state is 'verified' (admin-approved claim OR active page staff)
  // 2. The resolved institutionId matches the current page's universityId
  const canControl = !loading
    && accessState === 'verified'
    && !!institutionId
    && !!universityId
    && institutionId === universityId;

  return {
    loading,
    canControl,
    role,
    isPreviewMode,
    institutionId,
  };
}
