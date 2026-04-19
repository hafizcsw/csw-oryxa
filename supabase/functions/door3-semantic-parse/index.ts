// ═══════════════════════════════════════════════════════════════
// door3-semantic-parse — AI semantic parser job handler
// ═══════════════════════════════════════════════════════════════
// CONTRACT
//  Input: { document_id, lane?: 'passport_lane'|'graduation_lane'|'language_lane',
//           is_transcript?: boolean }
//  Reads ONLY from document_ocr_evidence. Never the raw file.
//  Calls self-hosted Qwen via INTERNAL_QWEN_ENDPOINT/TOKEN.
//  Validates deterministically. Writes to:
//    - document_lane_facts (via Door 3 writer)
//    - document_academic_rows / document_academic_summary (transcript only)
//    - document_semantic_runs (audit)
//
// HARD RULES
//  - No external provider (no OpenAI/Gemini/Lovable AI Gateway).
//  - No raw-file path.
//  - Idempotent on (document_id, evidence_version).
//  - Failures are TRUTHFUL: outcome reflects reality, never fakes success.
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { callQwen } from '../_shared/semantic/qwen-client.ts';
import { promptForLane } from '../_shared/semantic/prompt-templates.ts';
import {
  validatePassport, validateCertificate, validateTranscript,
} from '../_shared/semantic/validator.ts';
import {
  writeSemanticRun, writeLaneFactsFromSemantic,
  replaceAcademicRows, replaceAcademicSummary,
} from '../_shared/semantic/truth-writer.ts';
import type { SemanticLane } from '../_shared/semantic/schemas.ts';

const PARSER_VERSION = 'semantic.v1';
const MIN_EVIDENCE_CHARS = 60;

function buildEvidenceString(pages: any[]): string {
  if (!Array.isArray(pages)) return '';
  const parts: string[] = [];
  for (const p of pages) {
    if (typeof p?.raw_text === 'string') parts.push(p.raw_text);
    else if (typeof p?.text === 'string') parts.push(p.text);
    if (Array.isArray(p?.tables)) {
      for (const tbl of p.tables) {
        if (typeof tbl === 'string') parts.push(tbl);
        else if (Array.isArray(tbl?.rows)) parts.push(tbl.rows.map((r: any) => Array.isArray(r) ? r.join(' | ') : String(r)).join('\n'));
      }
    }
  }
  return parts.join('\n').slice(0, 24000); // hard cap
}

function evidenceVersion(ev: { processed_at?: string | null; engine_version?: string | null; page_count?: number | null }): string {
  return [ev.engine_version ?? 'eng?', ev.page_count ?? 0, ev.processed_at ?? 'no_ts'].join(':');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const t0 = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const document_id: string | undefined = body?.document_id;
    const requestedLane: SemanticLane | undefined = body?.lane;
    const isTranscript: boolean = !!body?.is_transcript;

    if (!document_id) {
      return json({ ok: false, error: 'missing_document_id' }, 400);
    }

    // 1) Load OCR evidence (single source for this layer)
    const { data: ev, error: evErr } = await admin
      .from('document_ocr_evidence')
      .select('document_id,user_id,content_kind,page_count,pages,engine,engine_version,processed_at')
      .eq('document_id', document_id)
      .maybeSingle();

    if (evErr) return json({ ok: false, error: `ocr_evidence_query_failed:${evErr.message}` }, 500);
    if (!ev) {
      // Truthful: no evidence = nothing to parse
      console.log('[SemanticParse:NoEvidence]', { document_id });
      return json({ ok: true, outcome: 'ocr_evidence_insufficient', detail: 'no_ocr_evidence_row' });
    }

    const lane: SemanticLane = requestedLane ?? inferLaneFromKind(ev.content_kind) ?? 'graduation_lane';
    const ver = evidenceVersion(ev);
    const evidence = buildEvidenceString(ev.pages as any[]);

    if (evidence.trim().length < MIN_EVIDENCE_CHARS) {
      const ms = Date.now() - t0;
      await writeSemanticRun(admin, {
        document_id, user_id: ev.user_id, evidence_version: ver, lane, model: 'n/a',
        parser_version: PARSER_VERSION, outcome: 'ocr_evidence_insufficient',
        raw_ai_output: null, validated_facts: null,
        notes: [`evidence_chars:${evidence.trim().length}`], reason: 'evidence_too_short', processing_ms: ms,
      });
      console.log('[SemanticParse:Insufficient]', { document_id, lane, chars: evidence.trim().length });
      return json({ ok: true, outcome: 'ocr_evidence_insufficient' });
    }

    // 2) Build prompt and call Qwen (self-hosted only)
    const { system, user } = promptForLane(lane, isTranscript, { evidence, engine: ev.engine ?? undefined });
    const out = await callQwen({ systemPrompt: system, userPrompt: user });

    if (!out.ok) {
      const outcome = out.reason === 'unconfigured' ? 'qwen_unconfigured'
        : out.reason === 'unreachable' ? 'qwen_unreachable'
        : 'parse_failed';
      const ms = Date.now() - t0;
      await writeSemanticRun(admin, {
        document_id, user_id: ev.user_id, evidence_version: ver, lane,
        model: out.model, parser_version: PARSER_VERSION, outcome,
        raw_ai_output: null, validated_facts: null,
        notes: [`qwen_${out.reason}`, out.detail.slice(0, 200)],
        reason: out.reason, processing_ms: ms,
      });
      console.warn('[SemanticParse:QwenFail]', { document_id, outcome, detail: out.detail });
      return json({ ok: true, outcome, detail: out.detail });
    }

    // 3) Validate (deterministic boundary)
    const ms = Date.now() - t0;
    if (lane === 'passport_lane') {
      const v = validatePassport(out.json);
      if (v.reason === 'schema_invalid') {
        await writeSemanticRun(admin, {
          document_id, user_id: ev.user_id, evidence_version: ver, lane,
          model: out.model, parser_version: PARSER_VERSION, outcome: 'validator_rejected',
          raw_ai_output: out.json, validated_facts: null,
          notes: v.notes, reason: 'schema_invalid', processing_ms: ms,
        });
        return json({ ok: true, outcome: 'validator_rejected', notes: v.notes });
      }
      const agg = await writeLaneFactsFromSemantic({
        admin, document_id, user_id: ev.user_id, lane: 'passport_lane',
        facts: v.facts, required: v.required,
        model: out.model, parser_version: PARSER_VERSION, processing_ms: ms,
        notes: ['semantic_layer', ...v.notes],
        review_reason: v.notes.length ? v.notes[0] : null,
      });
      await writeSemanticRun(admin, {
        document_id, user_id: ev.user_id, evidence_version: ver, lane,
        model: out.model, parser_version: PARSER_VERSION, outcome: 'parsed',
        raw_ai_output: out.json, validated_facts: { facts: v.facts, agg }, notes: v.notes,
        reason: null, processing_ms: ms,
      });
      console.log('[SemanticParse:Parsed]', { document_id, lane, truth: agg.truth_state });
      return json({ ok: true, outcome: 'parsed', truth_state: agg.truth_state });
    }

    if (lane === 'graduation_lane' && isTranscript) {
      const v = validateTranscript(out.json);
      if (v.reason === 'schema_invalid') {
        await writeSemanticRun(admin, {
          document_id, user_id: ev.user_id, evidence_version: ver, lane,
          model: out.model, parser_version: PARSER_VERSION, outcome: 'validator_rejected',
          raw_ai_output: out.json, validated_facts: null,
          notes: v.notes, reason: 'schema_invalid', processing_ms: ms,
        });
        return json({ ok: true, outcome: 'validator_rejected', notes: v.notes });
      }
      const provenance = { source: 'ai_semantic.qwen', model: out.model, parser_version: PARSER_VERSION, evidence_version: ver };
      await replaceAcademicRows(admin, document_id, ev.user_id, v.rows, provenance);
      await replaceAcademicSummary(admin, document_id, ev.user_id, v.summary, provenance);
      const agg = await writeLaneFactsFromSemantic({
        admin, document_id, user_id: ev.user_id, lane: 'graduation_lane',
        facts: v.laneFacts, required: v.required,
        model: out.model, parser_version: PARSER_VERSION, processing_ms: ms,
        notes: ['semantic_layer', `rows:${v.rows.length}`, ...v.notes],
        review_reason: v.notes.length ? v.notes[0] : null,
      });
      await writeSemanticRun(admin, {
        document_id, user_id: ev.user_id, evidence_version: ver, lane,
        model: out.model, parser_version: PARSER_VERSION, outcome: 'parsed',
        raw_ai_output: out.json, validated_facts: { laneFacts: v.laneFacts, rows: v.rows.length, summary: v.summary, agg },
        notes: v.notes, reason: null, processing_ms: ms,
      });
      console.log('[SemanticParse:Parsed]', { document_id, lane: 'transcript', rows: v.rows.length, truth: agg.truth_state });
      return json({ ok: true, outcome: 'parsed', truth_state: agg.truth_state, rows: v.rows.length });
    }

    // graduation_lane (certificate) or language_lane → certificate validator
    const v = validateCertificate(out.json);
    if (v.reason === 'schema_invalid') {
      await writeSemanticRun(admin, {
        document_id, user_id: ev.user_id, evidence_version: ver, lane,
        model: out.model, parser_version: PARSER_VERSION, outcome: 'validator_rejected',
        raw_ai_output: out.json, validated_facts: null,
        notes: v.notes, reason: 'schema_invalid', processing_ms: ms,
      });
      return json({ ok: true, outcome: 'validator_rejected', notes: v.notes });
    }
    const agg = await writeLaneFactsFromSemantic({
      admin, document_id, user_id: ev.user_id, lane,
      facts: v.facts, required: v.required,
      model: out.model, parser_version: PARSER_VERSION, processing_ms: ms,
      notes: ['semantic_layer', ...v.notes],
      review_reason: v.notes.length ? v.notes[0] : null,
    });
    await writeSemanticRun(admin, {
      document_id, user_id: ev.user_id, evidence_version: ver, lane,
      model: out.model, parser_version: PARSER_VERSION, outcome: 'parsed',
      raw_ai_output: out.json, validated_facts: { facts: v.facts, agg }, notes: v.notes,
      reason: null, processing_ms: ms,
    });
    console.log('[SemanticParse:Parsed]', { document_id, lane, truth: agg.truth_state });
    return json({ ok: true, outcome: 'parsed', truth_state: agg.truth_state });
  } catch (e) {
    console.error('[SemanticParse:Crash]', (e as Error).message, (e as Error).stack);
    return json({ ok: false, error: (e as Error).message ?? 'crash' }, 500);
  }
});

function inferLaneFromKind(kind: string | null | undefined): SemanticLane | null {
  if (!kind) return null;
  const k = kind.toLowerCase();
  if (k.includes('passport')) return 'passport_lane';
  if (k.includes('transcript') || k.includes('graduation') || k.includes('certificate') || k.includes('diploma')) return 'graduation_lane';
  if (k.includes('ielts') || k.includes('toefl') || k.includes('language')) return 'language_lane';
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
