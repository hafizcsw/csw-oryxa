/**
 * useOrxScore — Hook to fetch ORX score for any entity from the DB.
 * Returns OrxScore with proper fallback states.
 * No fake data. Returns 'evaluating' when no DB row exists.
 * Also returns exposure_status for beta gating.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { orxRowToScore, defaultOrxScore, type OrxEntityType, type OrxScore, type OrxScoreRow } from '@/types/orx';
import type { OrxExposureStatus } from '@/types/orxBetaGate';

export interface OrxScoreResult extends OrxScore {
  exposure_status: OrxExposureStatus;
  isBetaApproved: boolean;
}

interface UseOrxScoreOptions {
  entityType: OrxEntityType;
  entityId: string | null | undefined;
  enabled?: boolean;
}

function defaultResult(status: 'evaluating' | 'scored' | 'insufficient'): OrxScoreResult {
  return {
    ...defaultOrxScore(status),
    exposure_status: 'internal_only',
    isBetaApproved: false,
  };
}

export function useOrxScore({ entityType, entityId, enabled = true }: UseOrxScoreOptions) {
  return useQuery({
    queryKey: ['orx-score', entityType, entityId],
    queryFn: async (): Promise<OrxScoreResult> => {
      if (!entityId) return defaultResult('evaluating');

      const { data, error } = await (supabase as any)
        .from('orx_scores')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();

      if (error) {
        console.error('[ORX] Score fetch error:', error);
        return defaultResult('evaluating');
      }

      if (!data) {
        return defaultResult('evaluating');
      }

      const score = orxRowToScore(data as unknown as OrxScoreRow);
      const exposureStatus = (data.exposure_status as OrxExposureStatus) || 'internal_only';

      return {
        ...score,
        exposure_status: exposureStatus,
        isBetaApproved: exposureStatus === 'beta_approved',
      };
    },
    enabled: enabled && !!entityId,
    staleTime: 5 * 60 * 1000,
  });
}
