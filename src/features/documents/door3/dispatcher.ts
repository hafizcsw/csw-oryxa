// ═══════════════════════════════════════════════════════════════
// Door 3 — Client dispatcher
// ═══════════════════════════════════════════════════════════════
// Single client entry point. Calls door3-enqueue edge function which
// idempotently inserts into document_jobs.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type { Door3JobType } from './types';

export async function enqueueDoor3Job(args: {
  document_id: string;
  job_type: Door3JobType;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; job_id?: string; error?: string }> {
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
