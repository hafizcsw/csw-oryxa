// ═══════════════════════════════════════════════════════════════
// phase-a-normalize — Server-side normalizer + persistence (Round 2)
// ───────────────────────────────────────────────────────────────
// Owns the writes to the OFFICIAL Phase A tables:
//   • student_award_raw
//   • student_credential_normalized
//   • credential_mapping_decision_log
//   • student_evaluation_snapshots
//
// Engine logic + packs are inlined here so the function has no
// dependency on src/. Logic is identical to src/features/source-normalization.
//
// Contract (POST):
//   {
//     docs: Array<{
//       document_id: string,
//       source_country: 'EG'|'AE'|'JO'|null,
//       award_name_raw: string,
//       award_year?: number|null,
//       award_grade_raw?: string|null,
//       award_score_raw?: string|null,
//       award_track_raw?: string|null,
//       award_stream_raw?: string|null,
//       content_hash?: string|null,
//     }>,
//     input_hash: string,
//     trace_id?: string,
//     force?: boolean,
//   }
//
// Returns:
//   { ok, recompute_reason, snapshot, credentials, decisions_inserted }
// ═══════════════════════════════════════════════════════════════

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const NORMALIZER_VERSION = 'phase-a.logic.0.1';

// ─── Inlined packs (mirror of src/features/source-normalization/packs) ──

type SourceCountryCode = 'EG' | 'AE' | 'JO';

interface CredentialNamePattern {
  pattern_id: string;
  source_country_code: SourceCountryCode;
  match_kind: 'exact' | 'contains' | 'regex';
  match_value: string;
  maps_to_kind: string;
  maps_to_subtype?: string;
  confidence_base: number;
  evidence_ids: string[];
}

interface CredentialMappingRule {
  rule_id: string;
  source_country_code: SourceCountryCode;
  applies_when: { pattern_ids?: string[] };
  emits: {
    normalized_kind: string;
    normalized_subtype?: string;
    grade_normalization?: { from_scale_id: string; formula_id: string };
  };
  needs_manual_review_if?: string[];
  priority: number;
  evidence_ids: string[];
}

const CREDENTIAL_PATTERNS: CredentialNamePattern[] = [
  { pattern_id: 'EG.thanaweya_amma.ar', source_country_code: 'EG', match_kind: 'contains', match_value: 'الثانوية العامة', maps_to_kind: 'secondary_general', maps_to_subtype: 'thanaweya_amma', confidence_base: 0.9, evidence_ids: ['EG.pattern.draft.2026'] },
  { pattern_id: 'EG.thanaweya_amma.en', source_country_code: 'EG', match_kind: 'contains', match_value: 'thanaweya amma', maps_to_kind: 'secondary_general', maps_to_subtype: 'thanaweya_amma', confidence_base: 0.85, evidence_ids: ['EG.pattern.draft.2026'] },
  { pattern_id: 'EG.thanaweya_fanniya.ar', source_country_code: 'EG', match_kind: 'contains', match_value: 'الثانوية الفنية', maps_to_kind: 'secondary_technical', maps_to_subtype: 'thanaweya_fanniya', confidence_base: 0.9, evidence_ids: ['EG.pattern.draft.2026'] },
  { pattern_id: 'AE.moe_secondary.ar', source_country_code: 'AE', match_kind: 'contains', match_value: 'الثانوية العامة', maps_to_kind: 'secondary_general', maps_to_subtype: 'moe_secondary', confidence_base: 0.85, evidence_ids: ['AE.pattern.draft.2026'] },
  { pattern_id: 'AE.moe_secondary.en', source_country_code: 'AE', match_kind: 'contains', match_value: 'uae secondary', maps_to_kind: 'secondary_general', maps_to_subtype: 'moe_secondary', confidence_base: 0.85, evidence_ids: ['AE.pattern.draft.2026'] },
  { pattern_id: 'JO.tawjihi.ar', source_country_code: 'JO', match_kind: 'contains', match_value: 'التوجيهي', maps_to_kind: 'secondary_general', maps_to_subtype: 'tawjihi', confidence_base: 0.9, evidence_ids: ['JO.pattern.draft.2026'] },
  { pattern_id: 'JO.tawjihi.en', source_country_code: 'JO', match_kind: 'contains', match_value: 'tawjihi', maps_to_kind: 'secondary_general', maps_to_subtype: 'tawjihi', confidence_base: 0.9, evidence_ids: ['JO.pattern.draft.2026'] },
];

const MAPPING_RULES: CredentialMappingRule[] = [
  { rule_id: 'EG.rule.thanaweya_amma', source_country_code: 'EG', applies_when: { pattern_ids: ['EG.thanaweya_amma.ar', 'EG.thanaweya_amma.en'] }, emits: { normalized_kind: 'secondary_general', normalized_subtype: 'thanaweya_amma', grade_normalization: { from_scale_id: 'EG_thanaweya_total_410', formula_id: 'pct_from_total' } }, needs_manual_review_if: ['grade_unparseable', 'multiple_streams_detected'], priority: 100, evidence_ids: ['EG.rule.draft.2026'] },
  { rule_id: 'EG.rule.thanaweya_fanniya', source_country_code: 'EG', applies_when: { pattern_ids: ['EG.thanaweya_fanniya.ar'] }, emits: { normalized_kind: 'secondary_technical', normalized_subtype: 'thanaweya_fanniya' }, needs_manual_review_if: ['grade_unparseable'], priority: 100, evidence_ids: ['EG.rule.draft.2026'] },
  { rule_id: 'AE.rule.moe_secondary', source_country_code: 'AE', applies_when: { pattern_ids: ['AE.moe_secondary.ar', 'AE.moe_secondary.en'] }, emits: { normalized_kind: 'secondary_general', normalized_subtype: 'moe_secondary', grade_normalization: { from_scale_id: 'AE_moe_pct_100', formula_id: 'pct_passthrough' } }, needs_manual_review_if: ['stream_advanced_vs_elite_unclear'], priority: 100, evidence_ids: ['AE.rule.draft.2026'] },
  { rule_id: 'JO.rule.tawjihi', source_country_code: 'JO', applies_when: { pattern_ids: ['JO.tawjihi.ar', 'JO.tawjihi.en'] }, emits: { normalized_kind: 'secondary_general', normalized_subtype: 'tawjihi', grade_normalization: { from_scale_id: 'JO_tawjihi_pct_100', formula_id: 'pct_passthrough' } }, needs_manual_review_if: ['track_vocational_vs_academic_unclear'], priority: 100, evidence_ids: ['JO.rule.draft.2026'] },
];

// ─── Engine (mirror of src/features/source-normalization/engine.ts) ──

interface NormalizerInput {
  student_user_id: string;
  source_country_code: SourceCountryCode;
  award_name_raw: string;
  award_year?: number;
  award_grade_raw?: string;
  award_score_raw?: string;
  award_track_raw?: string;
  award_stream_raw?: string;
  trace_id?: string;
}

interface NormalizerDecision {
  decision_kind: string;
  reason_code: string;
  params: Record<string, unknown>;
  matched_rule_id?: string;
  evidence_ids: string[];
}

interface NormalizerOutput {
  student_user_id: string;
  source_country_code: SourceCountryCode;
  normalized_credential_kind: string;
  normalized_credential_subtype?: string;
  normalized_grade_pct: number | null;
  normalized_cefr_level: string | null;
  normalized_language_code: string | null;
  confidence: number;
  needs_manual_review: boolean;
  matched_rule_ids: string[];
  evidence_ids: string[];
  decisions: NormalizerDecision[];
  normalizer_version: string;
  trace_id?: string;
}

function normalizeText(s: string): string { return s.trim().toLowerCase(); }

function patternMatches(p: CredentialNamePattern, raw: string): boolean {
  const hay = normalizeText(raw);
  const needle = normalizeText(p.match_value);
  switch (p.match_kind) {
    case 'exact': return hay === needle;
    case 'contains': return hay.includes(needle);
    case 'regex': try { return new RegExp(p.match_value, 'i').test(raw); } catch { return false; }
    default: return false;
  }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

function parseGrade(scoreRaw: string | undefined, gradeRaw: string | undefined, formulaId: string | undefined): { pct: number | null; reason: string | null; params: Record<string, unknown> } {
  const raw = (scoreRaw ?? gradeRaw ?? '').trim();
  if (!raw) return { pct: null, reason: 'grade_unparseable', params: { reason: 'empty_grade' } };
  const pctMatch = raw.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pctMatch) return { pct: round2(parseFloat(pctMatch[1])), reason: 'grade_normalized', params: { input: raw, formula: 'explicit_pct' } };
  const fracMatch = raw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]); const den = parseFloat(fracMatch[2]);
    if (den > 0 && formulaId === 'pct_from_total') return { pct: round2((num / den) * 100), reason: 'grade_normalized', params: { input: raw, formula: 'pct_from_total' } };
    if (den > 0) return { pct: round2((num / den) * 100), reason: 'grade_normalized', params: { input: raw, formula: 'fraction' } };
  }
  if (/^\d+(?:\.\d+)?$/.test(raw)) return { pct: null, reason: 'grade_unit_missing', params: { input: raw } };
  return { pct: null, reason: 'grade_unparseable', params: { input: raw } };
}

function detectAmbiguities(input: NormalizerInput, rule: CredentialMappingRule): string[] {
  const codes: string[] = [];
  const trackSig = `${input.award_name_raw ?? ''} ${input.award_track_raw ?? ''}`;
  const streamSig = `${input.award_name_raw ?? ''} ${input.award_stream_raw ?? ''}`;
  if (rule.rule_id === 'EG.rule.thanaweya_amma' && !/علمي|أدبي|scientific|literary/i.test(trackSig)) codes.push('multiple_streams_detected');
  if (rule.rule_id === 'AE.rule.moe_secondary' && !/advanced|elite|general|متقدم|نخبة|عام/i.test(streamSig)) codes.push('stream_advanced_vs_elite_unclear');
  if (rule.rule_id === 'JO.rule.tawjihi' && !/academic|vocational|أكاد|مهني/i.test(trackSig)) codes.push('track_vocational_vs_academic_unclear');
  return codes;
}

function normalize(input: NormalizerInput): NormalizerOutput {
  const decisions: NormalizerDecision[] = [];
  const country = input.source_country_code;
  const candidates = CREDENTIAL_PATTERNS.filter(p => p.source_country_code === country && patternMatches(p, input.award_name_raw));

  if (candidates.length === 0) {
    decisions.push({ decision_kind: 'pattern_match', reason_code: 'no_pattern_match', params: { award_name_raw: input.award_name_raw, country }, evidence_ids: [] });
    decisions.push({ decision_kind: 'review_flag', reason_code: 'manual_review_required', params: { reason: 'no_pattern_match' }, evidence_ids: [] });
    return { student_user_id: input.student_user_id, source_country_code: country, normalized_credential_kind: 'unknown', normalized_grade_pct: null, normalized_cefr_level: null, normalized_language_code: null, confidence: 0, needs_manual_review: true, matched_rule_ids: [], evidence_ids: [], decisions, normalizer_version: NORMALIZER_VERSION, trace_id: input.trace_id };
  }

  const pattern = [...candidates].sort((a, b) => b.confidence_base - a.confidence_base)[0];
  decisions.push({ decision_kind: 'pattern_match', reason_code: 'pattern_matched', params: { pattern_id: pattern.pattern_id, confidence: pattern.confidence_base }, evidence_ids: pattern.evidence_ids });

  const rule = MAPPING_RULES.find(r => r.source_country_code === country && r.applies_when.pattern_ids?.includes(pattern.pattern_id));
  if (!rule) {
    decisions.push({ decision_kind: 'review_flag', reason_code: 'manual_review_required', params: { reason: 'no_rule_for_pattern', pattern_id: pattern.pattern_id }, evidence_ids: [] });
    return { student_user_id: input.student_user_id, source_country_code: country, normalized_credential_kind: pattern.maps_to_kind, normalized_credential_subtype: pattern.maps_to_subtype, normalized_grade_pct: null, normalized_cefr_level: null, normalized_language_code: null, confidence: pattern.confidence_base * 0.5, needs_manual_review: true, matched_rule_ids: [], evidence_ids: pattern.evidence_ids, decisions, normalizer_version: NORMALIZER_VERSION, trace_id: input.trace_id };
  }

  const grade = parseGrade(input.award_score_raw, input.award_grade_raw, rule.emits.grade_normalization?.formula_id);
  if (grade.reason) decisions.push({ decision_kind: 'grade_norm', reason_code: grade.reason, params: grade.params, matched_rule_id: rule.rule_id, evidence_ids: rule.evidence_ids });

  const ambiguityCodes = detectAmbiguities(input, rule);
  for (const code of ambiguityCodes) decisions.push({ decision_kind: 'review_flag', reason_code: code, params: {}, matched_rule_id: rule.rule_id, evidence_ids: [] });

  if (input.award_year == null) decisions.push({ decision_kind: 'review_flag', reason_code: 'award_year_missing', params: {}, matched_rule_id: rule.rule_id, evidence_ids: [] });

  const reviewTriggers = new Set(rule.needs_manual_review_if ?? []);
  const allCodes = decisions.map(d => d.reason_code);
  const needsReview = allCodes.some(c => reviewTriggers.has(c)) || ambiguityCodes.length > 0 || grade.reason === 'grade_unparseable' || grade.reason === 'grade_unit_missing' || input.award_year == null;

  if (needsReview) {
    decisions.push({ decision_kind: 'review_flag', reason_code: 'manual_review_required', params: { triggers: allCodes.filter(c => c !== 'pattern_matched' && c !== 'grade_normalized') }, matched_rule_id: rule.rule_id, evidence_ids: [] });
  }

  const confidence = needsReview ? Math.min(0.7, pattern.confidence_base * 0.8) : pattern.confidence_base;

  return { student_user_id: input.student_user_id, source_country_code: country, normalized_credential_kind: rule.emits.normalized_kind, normalized_credential_subtype: rule.emits.normalized_subtype, normalized_grade_pct: grade.pct, normalized_cefr_level: null, normalized_language_code: null, confidence, needs_manual_review: needsReview, matched_rule_ids: [rule.rule_id], evidence_ids: [...pattern.evidence_ids, ...rule.evidence_ids], decisions, normalizer_version: NORMALIZER_VERSION, trace_id: input.trace_id };
}

// ─── Aggregator ────────────────────────────────────────────────

interface DocInput {
  document_id: string;
  source_country: SourceCountryCode | null;
  award_name_raw: string;
  award_year: number | null;
  award_grade_raw: string | null;
  award_score_raw: string | null;
  award_track_raw?: string | null;
  award_stream_raw?: string | null;
  content_hash: string | null;
}

interface PerDocResult {
  document_id: string;
  source_country: SourceCountryCode | null;
  output: NormalizerOutput | null;
  reason_if_skipped?: string;
  content_hash: string | null;
  award_year: number | null;
}

function buildSnapshotResult(rows: PerDocResult[]) {
  const evaluated = rows.length;
  const passing = rows.filter(r => r.output && !r.output.needs_manual_review).length;
  const review = evaluated - passing;
  const per_document = rows.map(r => ({
    document_id: r.document_id,
    summary: r.output ? `${r.output.normalized_credential_subtype ?? r.output.normalized_credential_kind}${r.output.normalized_grade_pct != null ? ' · ' + r.output.normalized_grade_pct + '%' : ''}` : 'unrecognized',
    needs_manual_review: r.output?.needs_manual_review ?? true,
    reason_codes: r.output ? Array.from(new Set(r.output.decisions.map(d => d.reason_code).filter(c => c !== 'pattern_matched' && c !== 'grade_normalized'))) : ['country_profile_missing'],
  }));
  const passingRows = rows.filter(r => r.output && !r.output.needs_manual_review && r.output.normalized_grade_pct != null);
  const pool = passingRows.length > 0 ? passingRows : rows.filter(r => r.output);
  const headlineRow = pool.length > 0 ? [...pool].sort((a, b) => (b.output!.normalized_grade_pct ?? -1) - (a.output!.normalized_grade_pct ?? -1))[0] : null;
  const headline = headlineRow ? {
    document_id: headlineRow.document_id,
    kind: headlineRow.output!.normalized_credential_kind,
    subtype: headlineRow.output!.normalized_credential_subtype,
    grade_pct: headlineRow.output!.normalized_grade_pct,
    source_country: headlineRow.source_country,
  } : null;
  return { documents_evaluated: evaluated, documents_passing: passing, documents_needing_review: review, per_document, headline_credential: headline };
}

// ─── HTTP handler ──────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId: string = userData.user.id;

    const body = await req.json();
    const docs: DocInput[] = Array.isArray(body?.docs) ? body.docs : [];
    const inputHash: string = body?.input_hash ?? '';
    const traceId: string | undefined = body?.trace_id;
    const force: boolean = !!body?.force;

    if (!inputHash) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_input_hash' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Read existing snapshot — skip recompute if hash matches and not forced.
    const { data: existing } = await supabase
      .from('student_evaluation_snapshots')
      .select('*')
      .eq('student_user_id', userId)
      .maybeSingle();

    if (!force && existing && existing.input_hash === inputHash && existing.rules_version === NORMALIZER_VERSION) {
      const { data: creds } = await supabase
        .from('student_credential_normalized')
        .select('*')
        .eq('student_user_id', userId);
      return new Response(JSON.stringify({ ok: true, recompute_reason: null, skipped: true, snapshot: existing, credentials: creds ?? [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Determine reason
    const docIds = docs.map(d => d.document_id);
    let reason: string = 'first_compute';
    if (existing) {
      if (existing.rules_version !== NORMALIZER_VERSION) reason = 'rules_version_bump';
      else {
        const prev: string[] = Array.isArray(existing.document_ids) ? existing.document_ids : [];
        const prevSet = new Set(prev); const nextSet = new Set(docIds);
        const added = docIds.filter(id => !prevSet.has(id));
        const removed = prev.filter(id => !nextSet.has(id));
        if (added.length > 0 && removed.length > 0) reason = 'document_replaced';
        else if (added.length > 0) reason = 'document_added';
        else if (removed.length > 0) reason = 'document_removed';
        else reason = force ? 'manual' : 'content_changed';
      }
    }

    // Run normalizer per doc
    const perDoc: PerDocResult[] = [];
    for (const d of docs) {
      if (!d.source_country) {
        perDoc.push({ document_id: d.document_id, source_country: null, output: null, reason_if_skipped: 'country_profile_missing', content_hash: d.content_hash, award_year: d.award_year });
        continue;
      }
      const out = normalize({
        student_user_id: userId,
        source_country_code: d.source_country,
        award_name_raw: d.award_name_raw ?? '',
        award_year: d.award_year ?? undefined,
        award_grade_raw: d.award_grade_raw ?? undefined,
        award_score_raw: d.award_score_raw ?? undefined,
        award_track_raw: d.award_track_raw ?? undefined,
        award_stream_raw: d.award_stream_raw ?? undefined,
        trace_id: traceId,
      });
      perDoc.push({ document_id: d.document_id, source_country: d.source_country, output: out, content_hash: d.content_hash, award_year: d.award_year });
    }

    // ── Replace-set: delete stale rows for this user not in current docIds ─
    if (docIds.length > 0) {
      await supabase.from('student_credential_normalized').delete().eq('student_user_id', userId).not('source_document_id', 'in', `(${docIds.map(id => `"${id.replace(/"/g, '\\"')}"`).join(',')})`);
      await supabase.from('student_award_raw').delete().eq('student_user_id', userId).not('source_document_id', 'in', `(${docIds.map(id => `"${id.replace(/"/g, '\\"')}"`).join(',')})`);
    } else {
      await supabase.from('student_credential_normalized').delete().eq('student_user_id', userId);
      await supabase.from('student_award_raw').delete().eq('student_user_id', userId);
    }

    // ── Write award_raw + normalized + decision_log ─
    const insertedNormalizedIds: Record<string, string> = {};
    for (const d of docs) {
      // 1) award_raw insert (old rows for this user/doc were deleted above,
      //    so a plain insert is safe — and avoids needing a DB unique index).
      await supabase.from('student_award_raw')
        .delete()
        .eq('student_user_id', userId)
        .eq('source_document_id', d.document_id);

      const { data: awardRow, error: awardErr } = await supabase
        .from('student_award_raw')
        .insert({
          student_user_id: userId,
          source_country_code: d.source_country ?? 'XX',
          award_name_raw: d.award_name_raw ?? '',
          award_year: d.award_year,
          award_grade_raw: d.award_grade_raw,
          award_score_raw: d.award_score_raw,
          source_document_id: d.document_id,
          trace_id: traceId,
        })
        .select('id')
        .single();
      if (awardErr) { console.error('[phase-a-normalize] award_raw insert error', awardErr); continue; }

      const pd = perDoc.find(p => p.document_id === d.document_id);
      const out = pd?.output;

      // 2) normalized upsert
      const { data: normRow, error: normErr } = await supabase
        .from('student_credential_normalized')
        .upsert({
          student_user_id: userId,
          source_award_raw_id: awardRow.id,
          source_document_id: d.document_id,
          source_country_code: d.source_country ?? 'XX',
          normalized_credential_kind: out?.normalized_credential_kind ?? 'unknown',
          normalized_credential_subtype: out?.normalized_credential_subtype ?? null,
          normalized_grade_pct: out?.normalized_grade_pct ?? null,
          normalized_cefr_level: out?.normalized_cefr_level ?? null,
          normalized_language_code: out?.normalized_language_code ?? null,
          confidence: out?.confidence ?? 0,
          needs_manual_review: out?.needs_manual_review ?? true,
          matched_rule_ids: out?.matched_rule_ids ?? [],
          evidence_ids: out?.evidence_ids ?? [],
          decisions: out?.decisions ?? [{ decision_kind: 'review_flag', reason_code: pd?.reason_if_skipped ?? 'country_profile_missing', params: {}, evidence_ids: [] }],
          content_hash: d.content_hash,
          award_year: d.award_year,
          normalizer_version: NORMALIZER_VERSION,
          trace_id: traceId,
        }, { onConflict: 'student_user_id,source_document_id' })
        .select('id')
        .single();
      if (normErr) { console.error('[phase-a-normalize] normalized upsert error', normErr); continue; }
      insertedNormalizedIds[d.document_id] = normRow.id;

      // 3) decision_log: append-only audit. Insert each decision.
      const decisions = out?.decisions ?? [{ decision_kind: 'review_flag', reason_code: pd?.reason_if_skipped ?? 'country_profile_missing', params: {}, evidence_ids: [] }];
      const decisionRows = decisions.map(dec => ({
        normalized_id: normRow.id,
        student_user_id: userId,
        source_country_code: d.source_country ?? 'XX',
        decision_kind: dec.decision_kind,
        reason_code: dec.reason_code,
        params: dec.params ?? {},
        matched_rule_id: dec.matched_rule_id ?? null,
        evidence_ids: dec.evidence_ids ?? [],
        normalizer_version: NORMALIZER_VERSION,
        trace_id: traceId ?? null,
      }));
      if (decisionRows.length > 0) {
        await supabase.from('credential_mapping_decision_log').insert(decisionRows);
      }
    }

    // ── Build + upsert snapshot ─
    const result = buildSnapshotResult(perDoc);
    const needsReview = result.documents_needing_review > 0 || result.documents_evaluated === 0;
    const nowIso = new Date().toISOString();

    const { data: snapRow, error: snapErr } = await supabase
      .from('student_evaluation_snapshots')
      .upsert({
        student_user_id: userId,
        input_hash: inputHash,
        rules_version: NORMALIZER_VERSION,
        document_ids: docIds,
        result,
        needs_manual_review: needsReview,
        last_computed_at: nowIso,
        recompute_reason: reason,
        trace_id: traceId,
      }, { onConflict: 'student_user_id' })
      .select('*')
      .single();
    if (snapErr) {
      console.error('[phase-a-normalize] snapshot upsert error', snapErr);
      return new Response(JSON.stringify({ ok: false, error: 'snapshot_upsert_failed', detail: snapErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: creds } = await supabase
      .from('student_credential_normalized')
      .select('*')
      .eq('student_user_id', userId);

    return new Response(JSON.stringify({ ok: true, recompute_reason: reason, skipped: false, snapshot: snapRow, credentials: creds ?? [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[phase-a-normalize] uncaught', e);
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', detail: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
