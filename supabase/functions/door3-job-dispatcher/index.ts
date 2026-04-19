// ═══════════════════════════════════════════════════════════════
// Door 3 — Job Dispatcher (cron-driven, orchestration only)
// ═══════════════════════════════════════════════════════════════
// Pulled by pg_cron every minute via pg_net.
//
// Responsibilities:
//   1. Atomically claim a batch of queued jobs (claim_door3_jobs RPC).
//   2. For each job, dispatch by type:
//      - internal_ocr        → POST to private OCR worker (if configured)
//                              else mark worker_not_configured (TRUTHFUL).
//      - transcript_parse    → load OCR evidence, parse, write rows+summary.
//      - passport_recovery   → load OCR evidence, run MRZ recovery (stub V1).
//      - certificate_recovery→ load OCR evidence, minimal extraction (stub V1).
//   3. Update job status + create follow-up jobs idempotently.
//
// NEVER does OCR or rasterization in this function.
// ═══════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { parseTranscript } from '../_shared/door3-transcript-parser.ts';
import type { OcrEvidence } from '../_shared/door3-types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, service);

  // Claim a batch atomically (SECURITY DEFINER + FOR UPDATE SKIP LOCKED)
  const { data: jobs, error: claimErr } = await admin.rpc('claim_door3_jobs', {
    _batch_size: BATCH_SIZE,
  });
  if (claimErr) {
    return new Response(JSON.stringify({ error: claimErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Array<{ id: string; type: string; outcome: string }> = [];
  for (const job of jobs ?? []) {
    try {
      let outcome: string;
      switch (job.job_type) {
        case 'internal_ocr':
          outcome = await handleInternalOcr(admin, job);
          break;
        case 'transcript_parse':
          outcome = await handleTranscriptParse(admin, job);
          break;
        case 'passport_recovery':
          outcome = await handlePassportRecovery(admin, job);
          break;
        case 'certificate_recovery':
          outcome = await handleCertificateRecovery(admin, job);
          break;
        default:
          outcome = 'unknown_job_type';
          await fail(admin, job.id, 'unknown_job_type');
      }
      results.push({ id: job.id, type: job.job_type, outcome });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      await fail(admin, job.id, msg);
      results.push({ id: job.id, type: job.job_type, outcome: 'error:' + msg });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// ─── Handlers ───────────────────────────────────────────────────

async function handleInternalOcr(admin: SupabaseClient, job: any): Promise<string> {
  const workerUrl = Deno.env.get('INTERNAL_OCR_WORKER_URL') ?? '';
  const workerToken = Deno.env.get('INTERNAL_OCR_WORKER_TOKEN') ?? '';

  if (!workerUrl || !workerToken) {
    // Honest state — NOT silently queued, NOT fake completion.
    await admin
      .from('document_jobs')
      .update({
        status: 'worker_not_configured',
        last_error: 'INTERNAL_OCR_WORKER_URL or INTERNAL_OCR_WORKER_TOKEN not set',
        completed_at: null,
      })
      .eq('id', job.id);
    return 'worker_not_configured';
  }

  // Worker contract: POST { job_id, document_id, payload }
  // Worker writes OCR evidence itself via service role; returns evidence_id.
  const resp = await fetch(`${workerUrl.replace(/\/$/, '')}/process`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${workerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      job_id: job.id,
      document_id: job.document_id,
      user_id: job.user_id,
      payload: job.payload ?? {},
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`worker_http_${resp.status}: ${txt.slice(0, 200)}`);
  }
  const out = await resp.json().catch(() => ({}));
  if (!out?.ok || !out?.evidence_id) {
    throw new Error('worker_invalid_response');
  }

  await complete(admin, job.id, { evidence_id: out.evidence_id });
  // Schedule follow-up parse based on lane hint in payload
  const followUp = job.payload?.followup_job_type;
  if (followUp) {
    await admin.rpc('enqueue_door3_followup', {
      _document_id: job.document_id,
      _user_id: job.user_id,
      _job_type: followUp,
      _payload: { ocr_evidence_id: out.evidence_id },
    });
  }
  return 'completed';
}

async function loadEvidence(admin: SupabaseClient, document_id: string): Promise<OcrEvidence | null> {
  const { data, error } = await admin
    .from('document_ocr_evidence')
    .select('*')
    .eq('document_id', document_id)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    document_id: data.document_id,
    content_kind: data.content_kind,
    page_count: data.page_count,
    pages: data.pages ?? [],
    processing_notes: data.processing_notes ?? [],
    engine: data.engine,
    engine_version: data.engine_version,
    processed_at: data.processed_at,
  };
}

async function handleTranscriptParse(admin: SupabaseClient, job: any): Promise<string> {
  const ev = await loadEvidence(admin, job.document_id);
  if (!ev) {
    await fail(admin, job.id, 'no_ocr_evidence');
    return 'no_ocr_evidence';
  }
  const result = parseTranscript(ev);

  // Replace prior extractions for this document (truthful re-parse)
  await admin.from('document_academic_rows').delete().eq('document_id', job.document_id);
  await admin.from('document_academic_summary').delete().eq('document_id', job.document_id);

  if (result.rows.length > 0) {
    const rowsPayload = result.rows.map((r) => ({
      ...r,
      document_id: job.document_id,
      user_id: job.user_id,
    }));
    await admin.from('document_academic_rows').insert(rowsPayload);
  }
  if (result.summary.length > 0) {
    const sumPayload = result.summary.map((s) => ({
      ...s,
      document_id: job.document_id,
      user_id: job.user_id,
    }));
    await admin.from('document_academic_summary').insert(sumPayload);
  }

  if (result.needs_review) {
    await admin.from('document_jobs').update({
      status: 'needs_review',
      result: { rows_count: result.rows.length, summary_count: result.summary.length, notes: result.notes },
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);
    await enqueueReview(admin, job, 'academic_transcript', 'low_confidence_or_empty', result);
    return 'needs_review';
  }

  await complete(admin, job.id, {
    rows_count: result.rows.length,
    summary_count: result.summary.length,
    notes: result.notes,
  });
  return 'completed';
}

async function handlePassportRecovery(admin: SupabaseClient, job: any): Promise<string> {
  const ev = await loadEvidence(admin, job.document_id);
  if (!ev) { await fail(admin, job.id, 'no_ocr_evidence'); return 'no_ocr_evidence'; }
  // V1: stub — store result hint, mark needs_review (real MRZ recovery from
  // OCR text reuses src/features/documents/parsers/mrz-parser.ts; mirror later).
  await admin.from('document_jobs').update({
    status: 'needs_review',
    result: { stub: true, evidence_engine: ev.engine, page_count: ev.page_count },
    completed_at: new Date().toISOString(),
  }).eq('id', job.id);
  await enqueueReview(admin, job, 'passport_id', 'recovery_stub_v1', { notes: ['passport_recovery_v1_stub'] });
  return 'needs_review';
}

async function handleCertificateRecovery(admin: SupabaseClient, job: any): Promise<string> {
  const ev = await loadEvidence(admin, job.document_id);
  if (!ev) { await fail(admin, job.id, 'no_ocr_evidence'); return 'no_ocr_evidence'; }
  await admin.from('document_jobs').update({
    status: 'needs_review',
    result: { stub: true, evidence_engine: ev.engine, page_count: ev.page_count },
    completed_at: new Date().toISOString(),
  }).eq('id', job.id);
  await enqueueReview(admin, job, 'graduation_certificate', 'recovery_stub_v1', { notes: ['certificate_recovery_v1_stub'] });
  return 'needs_review';
}

// ─── helpers ───────────────────────────────────────────────────

async function complete(admin: SupabaseClient, job_id: string, result: unknown) {
  await admin.from('document_jobs').update({
    status: 'completed', result, completed_at: new Date().toISOString(),
  }).eq('id', job_id);
}

async function fail(admin: SupabaseClient, job_id: string, msg: string) {
  // Read attempts to decide retry vs final fail
  const { data } = await admin.from('document_jobs').select('attempts, max_attempts').eq('id', job_id).maybeSingle();
  const attempts = data?.attempts ?? 0;
  const max = data?.max_attempts ?? 3;
  const finalFail = attempts >= max;
  await admin.from('document_jobs').update({
    status: finalFail ? 'failed' : 'queued',
    last_error: msg,
    completed_at: finalFail ? new Date().toISOString() : null,
    claim_token: null,
    scheduled_at: finalFail ? new Date().toISOString() : new Date(Date.now() + 60_000).toISOString(),
  }).eq('id', job_id);
}

async function enqueueReview(admin: SupabaseClient, job: any, lane: string, reason: string, summary: unknown) {
  // Idempotent via uq_document_review_queue_doc_pending
  await admin.from('document_review_queue').upsert(
    {
      document_id: job.document_id,
      user_id: job.user_id,
      lane,
      reason,
      evidence_summary: summary as any,
      confidence_summary: { source: 'door3', job_type: job.job_type },
      state: 'pending',
    },
    { onConflict: 'document_id', ignoreDuplicates: true } as any,
  );
}
