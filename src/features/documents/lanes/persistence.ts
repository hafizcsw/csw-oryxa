// ═══════════════════════════════════════════════════════════════
// Door 2 — Lane Facts Persistence
// ═══════════════════════════════════════════════════════════════
// Writes a LaneFactsOutput row into public.document_lane_facts.
// RLS enforced by the DB. Returns boolean — never throws.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type { LaneFactsOutput } from './lane-fact-model';

export async function persistLaneFacts(out: LaneFactsOutput): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user_id = auth.user?.id ?? null;
    if (!user_id) {
      // eslint-disable-next-line no-console
      console.warn('[LaneFactsPersistence] no user session — skipped');
      return false;
    }

    // review_reason is folded into engine_metadata to avoid a schema migration
    // while still being queryable: engine_metadata->>'review_reason'
    const engine_metadata_with_reason = {
      ...(out.engine_metadata as unknown as Record<string, unknown>),
      review_reason: out.review_reason ?? null,
    };

    const row = {
      document_id: out.document_id,
      user_id,
      lane: out.lane,
      truth_state: out.truth_state,
      lane_confidence: out.lane_confidence,
      requires_review: out.requires_review,
      facts: out.facts as unknown as Record<string, unknown>,
      engine_metadata: engine_metadata_with_reason,
      notes: out.notes,
    };

    const { error } = await (supabase as any)
      .from('document_lane_facts')
      .upsert(row, { onConflict: 'document_id' });

    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[LaneFactsPersistence] insert failed', error);
      return false;
    }
    // eslint-disable-next-line no-console
    console.log('[LaneFactsPersistence] ✅ persisted', {
      document_id: out.document_id,
      lane: out.lane,
      truth_state: out.truth_state,
      confidence: out.lane_confidence,
      requires_review: out.requires_review,
    });
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[LaneFactsPersistence] threw', e);
    return false;
  }
}
