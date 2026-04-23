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
export async function enqueueDoor3Job(args: {
  document_id: string;
  job_type: Door3JobType;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; job_id?: string; error?: string }> {
  // eslint-disable-next-line no-console
  console.warn(
    '[DEPRECATED] enqueueDoor3Job called — this is a dead path. ' +
      'Use student-portal-api → mistral-document-pipeline instead. ' +
      'See docs/document-pipeline-truth-table.md',
    { job_type: args.job_type, document_id: args.document_id },
  );
  try {
    const { data, error } = await supabase.functions.invoke('door3-enqueue', {
      body: args,
    });
    if (error) return { ok: false, error: error.message };
    if (!data?.ok) return { ok: false, error: data?.error ?? 'unknown' };
    return { ok: true, job_id: data.job_id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
