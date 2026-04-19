// ═══════════════════════════════════════════════════════════════
// Door 2 — Hook: useDocumentLaneFacts
// ═══════════════════════════════════════════════════════════════
// Reads the canonical document_lane_facts row for the current user.
// Returns a simple map keyed by document_id for O(1) UI lookup.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { LaneFactsOutput, CanonicalField, LaneKind } from '@/features/documents/lanes';

export interface LaneFactsRow {
  document_id: string;
  lane: LaneKind;
  truth_state: 'extracted' | 'proposed' | 'needs_review';
  lane_confidence: number;
  requires_review: boolean;
  facts: Record<string, CanonicalField>;
  engine_metadata: LaneFactsOutput['engine_metadata'];
  notes: string[];
  updated_at: string;
}

export function useDocumentLaneFacts() {
  const [byDocId, setByDocId] = useState<Record<string, LaneFactsRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setByDocId({});
        return;
      }
      const { data, error: e } = await (supabase as any)
        .from('document_lane_facts')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (e) {
        setError(e.message);
        return;
      }
      const map: Record<string, LaneFactsRow> = {};
      for (const row of (data ?? []) as LaneFactsRow[]) {
        map[row.document_id] = row;
      }
      setByDocId(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { byDocId, loading, error, refetch };
}
