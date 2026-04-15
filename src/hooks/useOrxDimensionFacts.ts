/**
 * useOrxDimensionFacts — Internal read hooks for ORX 2.0 dimension facts.
 *
 * These hooks are for INTERNAL consumption only.
 * They read from vw_orx_dimension_facts_internal (all statuses)
 * via service-role edge function proxy.
 *
 * Public consumption will use vw_orx_dimension_facts_published
 * only after explicit promotion.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OrxDimensionDomain, OrxFactBoundary } from '@/types/orxSourceGovernance';
import type { OrxDimensionFactRow } from '@/types/orxDimensionFacts';

interface UseOrxDimensionFactsOptions {
  entityType: string;
  entityId: string | null | undefined;
  dimensionDomain?: OrxDimensionDomain;
  boundaryType?: OrxFactBoundary;
  enabled?: boolean;
}

/**
 * Fetch dimension facts for an entity (internal, all statuses via RPC).
 * For admin/internal dashboards only.
 */
export function useOrxDimensionFacts({
  entityType,
  entityId,
  dimensionDomain,
  boundaryType,
  enabled = true,
}: UseOrxDimensionFactsOptions) {
  return useQuery({
    queryKey: ['orx-dimension-facts', entityType, entityId, dimensionDomain, boundaryType],
    queryFn: async (): Promise<OrxDimensionFactRow[]> => {
      if (!entityId) return [];

      // Build query against internal view
      let query = (supabase as any)
        .from('vw_orx_dimension_facts_internal')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

      if (dimensionDomain) {
        query = query.eq('dimension_domain', dimensionDomain);
      }
      if (boundaryType) {
        query = query.eq('boundary_type', boundaryType);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('[ORX 2.0] Dimension facts fetch error:', error);
        return [];
      }

      return (data || []) as OrxDimensionFactRow[];
    },
    enabled: enabled && !!entityId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Group dimension facts by fact_family for display.
 */
export function groupDimensionFactsByFamily(
  facts: OrxDimensionFactRow[]
): Record<string, OrxDimensionFactRow[]> {
  const grouped: Record<string, OrxDimensionFactRow[]> = {};
  for (const f of facts) {
    if (!grouped[f.fact_family]) grouped[f.fact_family] = [];
    grouped[f.fact_family].push(f);
  }
  return grouped;
}

/**
 * Group dimension facts by dimension domain.
 */
export function groupDimensionFactsByDomain(
  facts: OrxDimensionFactRow[]
): Record<string, OrxDimensionFactRow[]> {
  const grouped: Record<string, OrxDimensionFactRow[]> = {};
  for (const f of facts) {
    const domain = f.dimension_domain;
    if (!grouped[domain]) grouped[domain] = [];
    grouped[domain].push(f);
  }
  return grouped;
}
