// ═══════════════════════════════════════════════════════════════
// ⛔ DEPRECATED — DEAD PATH (Phase A truth-table)
// ═══════════════════════════════════════════════════════════════
// This dispatcher targeted the legacy `door3-enqueue` edge function and
// `document_jobs` table. The LIVE document path is:
//   client → student-portal-api (identity_upload_sign_url)
//          → mistral-document-pipeline
//          → document_lane_facts / document_review_queue
//
// Do NOT call enqueueDoor3Job() from any new code. It is retained only
// to avoid breaking historical imports while we remove call sites.
// See: docs/document-pipeline-truth-table.md
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type { Door3JobType } from './types';

/**
 * @deprecated DEAD PATH. Use the live mistral-document-pipeline path instead.
 * See docs/document-pipeline-truth-table.md.
 */
export async function enqueueDoor3Job(_args: {
  document_id: string;
  job_type: Door3JobType;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; job_id?: string; error?: string }> {
  // HARD-DEAD: edge function `door3-enqueue` is not deployed. Calling this
  // path would fail at the network layer anyway; we fail fast and loud here
  // so any accidental caller is caught immediately.
  const msg =
    '[DEAD PATH] enqueueDoor3Job is removed from the live pipeline. ' +
    'Use student-portal-api → mistral-document-pipeline. ' +
    'See docs/document-pipeline-truth-table.md';
  // eslint-disable-next-line no-console
  console.error(msg);
  // Reference supabase to keep the import valid (no runtime call).
  void supabase;
  return { ok: false, error: 'dead_path:door3-enqueue' };
}
