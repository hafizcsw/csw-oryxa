/**
 * Shared institution landing resolver.
 * Single source of truth for post-login redirect for institution accounts.
 * Called by AuthFormCard, AuthStartModal, and App.tsx auth listener.
 */
import { supabase } from '@/integrations/supabase/client';

const PENDING_ROUTES: Record<string, string> = {
  no_institution_link: '/institution/onboarding',
  claim_draft: '/institution/onboarding',
  claim_submitted: '/institution/pending',
  under_review: '/institution/pending',
  more_info_requested: '/institution/pending',
  rejected: '/institution/pending',
  suspended: '/institution/locked',
};

/**
 * Resolves the correct landing path for an institution user.
 * Returns null if user has no institution association.
 */
export async function resolveInstitutionLanding(): Promise<string> {
  try {
    const { data } = await supabase.functions.invoke('institution-access-state', {
      body: { action: 'resolve' },
    });

    const state = data?.access_state || 'no_institution_link';

    // Verified/restricted → go to the exact university page
    if ((state === 'verified' || state === 'restricted') && data?.institution_id) {
      // Use slug from edge function response (already resolved server-side)
      if (data.university_slug) {
        return `/university/${data.university_slug}`;
      }
      // Fallback: resolve slug client-side
      const { data: uni } = await supabase
        .from('universities')
        .select('slug')
        .eq('id', data.institution_id)
        .maybeSingle();
      if (uni?.slug) {
        return `/university/${uni.slug}`;
      }
      return `/university/${data.institution_id}`;
    }

    // Non-verified states → onboarding/pending/locked
    return PENDING_ROUTES[state] || '/institution/onboarding';
  } catch {
    return '/institution/onboarding';
  }
}
