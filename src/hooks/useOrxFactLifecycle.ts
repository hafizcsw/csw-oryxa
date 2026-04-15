/**
 * useOrxFactLifecycle — Internal hooks for ORX 2.0 fact operations
 *
 * Provides hooks for:
 * - Fact transitions (approve, reject, publish, etc.)
 * - Ops summaries (audit, readiness)
 * - Pending review queue
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FUNCTION_NAME = 'orx-dimension-facts-lifecycle';

async function invokeLifecycle(action: string, method: 'GET' | 'POST' = 'GET', body?: unknown) {
  if (method === 'GET') {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: { action },
    });
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    method: 'POST',
    body: { ...(body as object), action },
  });
  if (error) throw error;
  return data;
}

/**
 * Fetch ops summary (audit + readiness + top entities).
 */
export function useOrxOpsSummary(enabled = true) {
  return useQuery({
    queryKey: ['orx-ops-summary'],
    queryFn: () => invokeLifecycle('ops-summary'),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Fetch pending review facts.
 */
export function useOrxPendingReview(domain?: string, enabled = true) {
  return useQuery({
    queryKey: ['orx-pending-review', domain],
    queryFn: () => invokeLifecycle(`pending-review${domain ? `&domain=${domain}` : ''}`),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Fetch approved (unpublished) facts.
 */
export function useOrxApprovedFacts(enabled = true) {
  return useQuery({
    queryKey: ['orx-approved-facts'],
    queryFn: () => invokeLifecycle('approved'),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Fetch dimension readiness report.
 */
export function useOrxDimensionReadiness(enabled = true) {
  return useQuery({
    queryKey: ['orx-dimension-readiness'],
    queryFn: () => invokeLifecycle('readiness'),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Transition a fact (or batch of facts) to a new status.
 */
export function useOrxTransition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      fact_id: string | string[];
      to_status: string;
      reason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
        method: 'POST',
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orx-pending-review'] });
      queryClient.invalidateQueries({ queryKey: ['orx-approved-facts'] });
      queryClient.invalidateQueries({ queryKey: ['orx-ops-summary'] });
      queryClient.invalidateQueries({ queryKey: ['orx-dimension-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['orx-dimension-facts'] });
    },
  });
}
