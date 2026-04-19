// ═══════════════════════════════════════════════════════════════
// Foundation — Persistence
// ═══════════════════════════════════════════════════════════════
// Writes route_decision + normalized_document + review_state to
// the project Supabase. Per-user RLS enforced at DB level.
// Returns boolean — never throws to caller.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type { FoundationOutput } from './index';

export async function persistFoundationOutput(out: FoundationOutput): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user_id = auth.user?.id ?? null;
    if (!user_id) {
      // eslint-disable-next-line no-console
      console.warn('[FoundationPersistence] no user session — skipped');
      return false;
    }

    const row = {
      document_id: out.document_id,
      user_id,
      route_family: out.route.route_family,
      route_confidence: out.route.route_confidence,
      selected_lane: out.route.selected_lane,
      requires_review: out.route.requires_review,
      processing_state: out.processing_state,
      privacy_blocked: out.privacy_blocked,
      route_reasons: out.route.route_reasons,
      router_version: out.route.router_version,
      review_status: out.review.review_status,
      review_reason: out.review.review_reason,
      normalized_document: out.normalized as unknown as Record<string, unknown>,
      route_decision: out.route as unknown as Record<string, unknown>,
    };

    const { error } = await (supabase as any)
      .from('document_foundation_outputs')
      .upsert(row, { onConflict: 'document_id' });

    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[FoundationPersistence] insert failed', error);
      return false;
    }
    // eslint-disable-next-line no-console
    console.log('[FoundationPersistence] ✅ persisted', out.document_id);
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[FoundationPersistence] threw', e);
    return false;
  }
}
