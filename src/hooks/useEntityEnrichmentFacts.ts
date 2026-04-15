/**
 * useEntityEnrichmentFacts — Hook to fetch published enrichment facts for any entity.
 * Reads from vw_entity_enrichment_published view.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UseEntityFactsOptions {
  entityType: 'university' | 'program' | 'country';
  entityId: string | null | undefined;
  enabled?: boolean;
}

export interface EnrichmentFact {
  id: string;
  entity_type: string;
  entity_id: string;
  fact_type: string;
  fact_key: string;
  fact_value: Record<string, unknown>;
  display_text: string | null;
  source_url: string | null;
  source_domain: string | null;
  source_type: string | null;
  confidence: number | null;
  last_verified_at: string | null;
  first_seen_at: string | null;
}

export function useEntityEnrichmentFacts({ entityType, entityId, enabled = true }: UseEntityFactsOptions) {
  return useQuery({
    queryKey: ['entity-enrichment-facts', entityType, entityId],
    queryFn: async (): Promise<EnrichmentFact[]> => {
      if (!entityId) return [];

      const { data, error } = await (supabase as any)
        .from('vw_entity_enrichment_published')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('confidence', { ascending: false });

      if (error) {
        console.error('[Enrichment] Fetch error:', error);
        return [];
      }

      return (data || []) as EnrichmentFact[];
    },
    enabled: enabled && !!entityId,
    staleTime: 10 * 60 * 1000, // 10 min cache
  });
}

/** Group facts by fact_type for display */
export function groupFactsByType(facts: EnrichmentFact[]): Record<string, EnrichmentFact[]> {
  const grouped: Record<string, EnrichmentFact[]> = {};
  for (const f of facts) {
    if (!grouped[f.fact_type]) grouped[f.fact_type] = [];
    grouped[f.fact_type].push(f);
  }
  return grouped;
}
