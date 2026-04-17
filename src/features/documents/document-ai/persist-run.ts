// ═══════════════════════════════════════════════════════════════
// Persist Document AI run to audit table
// ═══════════════════════════════════════════════════════════════
// Writes one row to `paddle_structure_runs` per attempt.
// RLS: per-user. Never throws — audit is best-effort.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type { DocumentAIResponse } from './document-ai-provider';

export async function persistDocumentAIRun(params: {
  document_id: string;
  storage_path: string | null;
  response: DocumentAIResponse;
}): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) return; // unauthenticated: nothing to audit

    const { document_id, storage_path, response } = params;
    const summary = response.artifact?.summary;

    await supabase.from('paddle_structure_runs').insert({
      user_id,
      document_id,
      storage_path,
      provider: response.mode === 'paddle_self_hosted' ? 'paddle_self_hosted' : 'none',
      status: response.status,
      reason: response.reason,
      latency_ms: response.latency_ms,
      page_count: summary?.pages_analyzed ?? null,
      block_count: summary
        ? (summary.header_groups + summary.footer_groups + summary.total_row_candidates)
        : null,
      table_count: summary?.table_like_region_count ?? null,
      error_message: response.error_message ?? null,
    });
  } catch {
    // best-effort audit
  }
}
