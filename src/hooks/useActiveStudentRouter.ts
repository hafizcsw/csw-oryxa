/**
 * useActiveStudentRouter — Determines the canonical route for a student
 * Active students go directly to their course dashboard
 * Non-active students see pre-course surfaces
 */

import { useMemo } from 'react';
import { useRussianActivation } from '@/hooks/useRussianActivation';

export type StudentFlowState =
  | 'exploring'        // No enrollment, browsing
  | 'onboarding'       // Started onboarding but not complete
  | 'awaiting_payment'  // Completed onboarding, needs to pay
  | 'payment_pending'   // Payment proof submitted, waiting
  | 'active'           // Paid and active learner
  | 'paused'           // Temporarily paused
  | 'completed';       // Course completed

export function useActiveStudentRouter() {
  const { loading, isActivated, activationStatus, isAuthenticated } = useRussianActivation();

  const flowState: StudentFlowState = useMemo(() => {
    if (!isAuthenticated) return 'exploring';
    if (isActivated) return 'active';
    
    switch (activationStatus) {
      case 'payment_pending': return 'payment_pending';
      case 'awaiting_payment': return 'awaiting_payment';
      case 'failed_or_retry': return 'awaiting_payment';
      default: return 'exploring';
    }
  }, [isAuthenticated, isActivated, activationStatus]);

  const canonicalRoute = useMemo(() => {
    const state: string = flowState;
    switch (state) {
      case 'active':
        return '/languages/russian/dashboard';
      case 'payment_pending':
      case 'awaiting_payment':
        return '/my-learning';
      case 'onboarding':
        return '/languages/russian/onboarding';
      default:
        return '/languages';
    }
  }, [flowState]);

  return {
    loading,
    flowState,
    canonicalRoute,
    isActive: flowState === 'active',
    isPreCourse: ['exploring', 'onboarding', 'awaiting_payment', 'payment_pending'].includes(flowState),
  };
}
