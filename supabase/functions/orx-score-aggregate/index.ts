/**
 * orx-score-aggregate v1 — Full ORX scoring pipeline.
 *
 * Modes:
 *   POST { entity_type, entity_id }              → single entity layer aggregate
 *   POST { entity_type, entity_id, composite: true } → composite score (pulls C+U+P layers)
 *   POST { action: "rank", entity_type }          → recompute ranks for all scored entities of type
 *   POST { action: "batch", entities: [...] }     → batch aggregate + composite + rank
 *   POST { action: "calibration_run" }            → run calibration harness
 *
 * Security: service-role or admin only.
 * Methodology: v1.1
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Methodology v1.1 constants ──

const METHODOLOGY_VERSION = '1.1';

const LAYER_WEIGHTS = { country: 0.20, university: 0.35, program: 0.45 };

const SIGNAL_FAMILIES: Record<string, { key: string; weight: number; max_cap?: number }[]> = {
  country: [
    { key: 'ai_ecosystem', weight: 0.25 },
    { key: 'government_ai_readiness', weight: 0.20 },
    { key: 'digital_infrastructure', weight: 0.20 },
    { key: 'talent_skills_environment', weight: 0.20 },
    { key: 'policy_maturity', weight: 0.15 },
  ],
  university: [
    { key: 'curriculum_update_velocity', weight: 0.20 },
    { key: 'ai_integration', weight: 0.20 },
    { key: 'applied_learning', weight: 0.18 },
    { key: 'flexible_learning', weight: 0.12 },
    { key: 'transparency_data_freshness', weight: 0.10 },
    { key: 'student_signal', weight: 0.10, max_cap: 0.50 },
    { key: 'research_compute', weight: 0.10 },
  ],
  program: [
    { key: 'future_skill_alignment', weight: 0.25 },
    { key: 'curriculum_freshness', weight: 0.20 },
    { key: 'ai_workflow_exposure', weight: 0.18 },
    { key: 'transferability', weight: 0.15 },
    { key: 'applied_industry_signal', weight: 0.12 },
    { key: 'student_value_signal', weight: 0.10, max_cap: 0.50 },
  ],
};

const STUDENT_SIGNALS = ['student_signal', 'student_value_signal'];

const REQUIRED_CORE_FAMILIES: Record<string, string[]> = {
  university: ['curriculum_update_velocity', 'ai_integration'],
  program: ['future_skill_alignment', 'curriculum_freshness'],
  country: ['ai_ecosystem'],
};

const SCORED_THRESHOLDS = {
  min_confidence: 40,
  min_evidence_count: 5,
  min_high_trust_sources: 1,
  min_independent_sources: 2,
  min_signal_families: 3,
};

const TRUST_WEIGHTS: Record<string, number> = { high: 1.0, medium: 0.7, low: 0.4 };

const DECAY_BRACKETS = [
  { max_months: 6, mult: 1.0 },
  { max_months: 12, mult: 0.9 },
  { max_months: 18, mult: 0.75 },
  { max_months: 24, mult: 0.6 },
  { max_months: 36, mult: 0.4 },
];

const BADGE_RULES: { badge: string; check: (scores: Record<string, number>, overall: number) => boolean }[] = [
  { badge: 'future_ready', check: (_, o) => o >= 75 },
  { badge: 'ai_era_ready', check: (s) => (s['ai_integration'] ?? 0) >= 70 && (s['ai_workflow_exposure'] ?? 0) >= 70 },
  { badge: 'strong_industry_link', check: (s) => (s['applied_learning'] ?? 0) >= 75 && (s['applied_industry_signal'] ?? 0) >= 75 },
  { badge: 'fast_adapter', check: (s) => (s['curriculum_update_velocity'] ?? 0) >= 80 },
  { badge: 'transparent', check: (s) => (s['transparency_data_freshness'] ?? 0) >= 80 },
];

// ── Missing-layer fallback rules (Methodology v1.1) ──
// When a layer score is missing for composite calculation:
// - country missing: use neutral 50 (country context unknown, don't penalize or reward)
// - university missing: use 0 (cannot credit university without evidence)
// - program missing: use 0 (cannot credit program without evidence)
// Confidence is penalized by 20% per missing layer to reflect uncertainty.

const MISSING_LAYER_DEFAULTS: Record<string, { fallback: number; confidence_penalty: number; label: string }> = {
  country:    { fallback: 50, confidence_penalty: 0.20, label: 'neutral_default' },
  university: { fallback: 0,  confidence_penalty: 0.20, label: 'no_evidence' },
  program:    { fallback: 0,  confidence_penalty: 0.20, label: 'no_evidence' },
};

// ── Helpers ──

function monthsAgo(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

function decayMultiplier(dateStr: string | null): number {
  if (!dateStr) return 0.6;
  const months = monthsAgo(dateStr);
  if (months > 36) return 0;
  for (const b of DECAY_BRACKETS) {
    if (months <= b.max_months) return b.mult;
  }
  return 0;
}

interface EvidenceRow {
  id: string;
  entity_type: string;
  entity_id: string;
  layer: string;
  signal_family: string;
  source_type: string;
  source_domain: string;
  trust_level: string;
  contextual_only: boolean;
  freshness_date: string | null;
  observed_at: string;
  extraction_confidence: number | null;
  evidence_status: string;
  content_hash: string;
}

interface LayerAggResult {
  status: 'scored' | 'evaluating' | 'insufficient';
  layer_score: number | null;
  confidence: number;
  badges: string[];
  signal_scores: Record<string, number>;
  evidence_summary: Record<string, unknown>;
}

function aggregateLayer(entityType: string, evidence: EvidenceRow[]): LayerAggResult {
  const primary = evidence.filter(e => !e.contextual_only);
  const all = evidence;
  const totalCount = all.length;
  const primaryCount = primary.length;
  const uniqueDomains = new Set(all.map(e => e.source_domain));
  const independentCount = uniqueDomains.size;
  const highTrustCount = primary.filter(e => e.trust_level === 'high').length;
  const familiesCovered = new Set(primary.map(e => e.signal_family));
  const familyCount = familiesCovered.size;
  const sourceTypes = new Set(all.map(e => e.source_type));
  const requiredCores = REQUIRED_CORE_FAMILIES[entityType] || [];
  const coresMet = requiredCores.every(f => familiesCovered.has(f));

  // Confidence
  const confCount = Math.min(primaryCount / 10, 1) * 100;
  const confDiversity = Math.min(sourceTypes.size / 5, 1) * 100;
  const confIndependence = Math.min(independentCount / 4, 1) * 100;
  const avgDecay = all.length > 0
    ? all.reduce((sum, e) => sum + decayMultiplier(e.freshness_date || e.observed_at), 0) / all.length
    : 0;
  const confFreshness = avgDecay * 100;
  const expectedFamilies = (SIGNAL_FAMILIES[entityType] || []).length;
  const confCompleteness = expectedFamilies > 0 ? (familyCount / expectedFamilies) * 100 : 0;
  const confConflict = 100;

  const confidence = Math.round(
    confCount * 0.20 + confDiversity * 0.20 + confIndependence * 0.20 +
    confFreshness * 0.15 + confCompleteness * 0.15 + confConflict * 0.10
  );

  // Status
  const meetsScored =
    confidence >= SCORED_THRESHOLDS.min_confidence &&
    primaryCount >= SCORED_THRESHOLDS.min_evidence_count &&
    highTrustCount >= SCORED_THRESHOLDS.min_high_trust_sources &&
    independentCount >= SCORED_THRESHOLDS.min_independent_sources &&
    familyCount >= SCORED_THRESHOLDS.min_signal_families &&
    coresMet;

  let status: 'scored' | 'evaluating' | 'insufficient';
  if (meetsScored) status = 'scored';
  else if (familyCount <= 2 && confidence <= 39) status = 'insufficient';
  else status = 'evaluating';

  // Signal family scores
  const signalScores: Record<string, number> = {};
  const families = SIGNAL_FAMILIES[entityType] || [];

  for (const fam of families) {
    const famEvidence = primary.filter(e => e.signal_family === fam.key);
    if (famEvidence.length === 0) { signalScores[fam.key] = 0; continue; }

    const domainContribs: Record<string, number> = {};
    for (const ev of famEvidence) {
      const tw = TRUST_WEIGHTS[ev.trust_level] || 0.4;
      const decay = decayMultiplier(ev.freshness_date || ev.observed_at);
      const ec = (ev.extraction_confidence ?? 80) / 100; // DB stores 0-100, normalize to 0-1
      const contrib = tw * decay * ec;
      domainContribs[ev.source_domain] = (domainContribs[ev.source_domain] || 0) + contrib;
    }

    const totalRaw = Object.values(domainContribs).reduce((a, b) => a + b, 0);
    const maxPerDomain = totalRaw * 0.40;
    let cappedTotal = 0;
    for (const val of Object.values(domainContribs)) {
      cappedTotal += Math.min(val, maxPerDomain);
    }

    const rawScore = (cappedTotal / Math.sqrt(famEvidence.length)) * 100;
    let finalScore = Math.min(Math.round(rawScore), 100);

    if (STUDENT_SIGNALS.includes(fam.key) && fam.max_cap) {
      finalScore = Math.round(finalScore * fam.max_cap);
    }
    signalScores[fam.key] = finalScore;
  }

  // Layer score
  let layerScore: number | null = null;
  if (status === 'scored') {
    layerScore = 0;
    for (const fam of families) {
      layerScore += (signalScores[fam.key] || 0) * fam.weight;
    }
    layerScore = Math.round(layerScore);
  }

  // Badges
  const badges: string[] = [];
  if (status === 'scored' && layerScore !== null) {
    for (const rule of BADGE_RULES) {
      if (rule.check(signalScores, layerScore)) badges.push(rule.badge);
    }
  }

  return {
    status,
    layer_score: layerScore,
    confidence,
    badges,
    signal_scores: signalScores,
    evidence_summary: {
      total_evidence: totalCount,
      primary_evidence: primaryCount,
      contextual_evidence: totalCount - primaryCount,
      independent_domains: independentCount,
      high_trust_count: highTrustCount,
      families_covered: Array.from(familiesCovered),
      source_types: Array.from(sourceTypes),
      cores_met: coresMet,
      confidence_breakdown: {
        count: Math.round(confCount),
        diversity: Math.round(confDiversity),
        independence: Math.round(confIndependence),
        freshness: Math.round(confFreshness),
        completeness: Math.round(confCompleteness),
        conflict: Math.round(confConflict),
      },
      aggregation_version: 'v1',
    },
  };
}

// ── Composite score engine ──

interface CompositeResult {
  composite_score: number;
  composite_confidence: number;
  composite_status: 'scored' | 'evaluating' | 'insufficient';
  layers: {
    country: { score: number; source: 'computed' | 'fallback'; confidence: number };
    university: { score: number; source: 'computed' | 'fallback'; confidence: number };
    program: { score: number; source: 'computed' | 'fallback'; confidence: number };
  };
  missing_layers: string[];
  badges: string[];
}

function computeComposite(
  countryScore: { layer_score: number | null; confidence: number; status: string; badges: string[] } | null,
  universityScore: { layer_score: number | null; confidence: number; status: string; badges: string[] } | null,
  programScore: { layer_score: number | null; confidence: number; status: string; badges: string[] } | null,
): CompositeResult {
  const missing: string[] = [];
  let confidencePenalty = 0;

  // Resolve each layer
  const resolveLayer = (
    name: string,
    result: { layer_score: number | null; confidence: number; status: string } | null,
  ): { score: number; source: 'computed' | 'fallback'; confidence: number } => {
    const fb = MISSING_LAYER_DEFAULTS[name];
    if (!result || result.status !== 'scored' || result.layer_score === null) {
      missing.push(name);
      confidencePenalty += fb.confidence_penalty;
      return { score: fb.fallback, source: 'fallback', confidence: 0 };
    }
    return { score: result.layer_score, source: 'computed', confidence: result.confidence };
  };

  const cLayer = resolveLayer('country', countryScore);
  const uLayer = resolveLayer('university', universityScore);
  const pLayer = resolveLayer('program', programScore);

  // Composite = weighted sum
  const composite = Math.round(
    cLayer.score * LAYER_WEIGHTS.country +
    uLayer.score * LAYER_WEIGHTS.university +
    pLayer.score * LAYER_WEIGHTS.program
  );

  // Composite confidence = weighted avg of layer confidences, penalized for missing
  const rawConfidence = (
    cLayer.confidence * LAYER_WEIGHTS.country +
    uLayer.confidence * LAYER_WEIGHTS.university +
    pLayer.confidence * LAYER_WEIGHTS.program
  );
  const compositeConfidence = Math.round(Math.max(0, rawConfidence * (1 - confidencePenalty)));

  // Status: scored only if ≥2 layers are computed (not fallback) and composite confidence ≥ 30
  const computedCount = [cLayer, uLayer, pLayer].filter(l => l.source === 'computed').length;
  let compositeStatus: 'scored' | 'evaluating' | 'insufficient';
  if (computedCount >= 2 && compositeConfidence >= 30) {
    compositeStatus = 'scored';
  } else if (computedCount === 0) {
    compositeStatus = 'insufficient';
  } else {
    compositeStatus = 'evaluating';
  }

  // Merge badges from all scored layers
  const allBadges = new Set<string>();
  for (const r of [countryScore, universityScore, programScore]) {
    if (r && r.status === 'scored') {
      for (const b of r.badges) allBadges.add(b);
    }
  }
  // Check composite-level badges
  if (composite >= 75) allBadges.add('future_ready');
  if (composite >= 60) allBadges.add('high_future_relevance');

  return {
    composite_score: composite,
    composite_confidence: compositeConfidence,
    composite_status: compositeStatus,
    layers: { country: cLayer, university: uLayer, program: pLayer },
    missing_layers: missing,
    badges: Array.from(allBadges),
  };
}

// ── Rank engine ──
// Rules:
// 1. Only 'scored' entities are ranked
// 2. Order by composite score DESC, then confidence DESC (tie-break)
// 3. Ties in score+confidence get same rank (dense rank)
// 4. Deterministic: re-run produces same output for same data

async function computeRanks(admin: any, entityType: string): Promise<{ ranked: number; excluded: number }> {
  // Fetch all scored entities
  const { data: rows, error } = await admin
    .from('orx_scores')
    .select('id, entity_id, entity_type, score, confidence, status')
    .eq('entity_type', entityType)
    .eq('status', 'scored')
    .not('score', 'is', null)
    .order('score', { ascending: false })
    .order('confidence', { ascending: false });

  if (error) throw new Error(`Rank fetch error: ${error.message}`);
  if (!rows || rows.length === 0) return { ranked: 0, excluded: 0 };

  // Dense rank: same score+confidence = same rank
  let currentRank = 0;
  let lastScore = -1;
  let lastConf = -1;

  const updates: { id: string; rank_global: number }[] = [];
  for (const row of rows) {
    if (row.score !== lastScore || row.confidence !== lastConf) {
      currentRank++;
      lastScore = row.score;
      lastConf = row.confidence;
    }
    updates.push({ id: row.id, rank_global: currentRank });
  }

  // Write ranks
  for (const u of updates) {
    await admin.from('orx_scores').update({ rank_global: u.rank_global }).eq('id', u.id);
  }

  // Clear rank for non-scored entities
  const { count: excludedCount } = await admin
    .from('orx_scores')
    .update({ rank_global: null, rank_country: null })
    .eq('entity_type', entityType)
    .neq('status', 'scored')
    .select('id', { count: 'exact', head: true });

  return { ranked: updates.length, excluded: excludedCount || 0 };
}

async function computeCountryRanks(admin: any, entityType: string): Promise<Record<string, number>> {
  // For country-level ranks, we need to group by country.
  // For universities: look up country from universities table
  // For programs: look up country via program → university → country
  // For countries: country_rank = global_rank (same thing)

  if (entityType === 'country') {
    // Country entities: country_rank = global_rank
    const { data: rows } = await admin
      .from('orx_scores')
      .select('id, rank_global')
      .eq('entity_type', 'country')
      .eq('status', 'scored');
    
    const result: Record<string, number> = {};
    for (const r of (rows || [])) {
      await admin.from('orx_scores').update({ rank_country: r.rank_global }).eq('id', r.id);
      result[r.id] = r.rank_global;
    }
    return result;
  }

  if (entityType === 'university') {
    // Get scored universities with their country
    const { data: scored } = await admin
      .from('orx_scores')
      .select('id, entity_id, score, confidence')
      .eq('entity_type', 'university')
      .eq('status', 'scored')
      .not('score', 'is', null)
      .order('score', { ascending: false })
      .order('confidence', { ascending: false });

    if (!scored || scored.length === 0) return {};

    // Fetch country codes for these universities
    const entityIds = scored.map((s: any) => s.entity_id);
    const { data: unis } = await admin
      .from('universities')
      .select('id, country_code')
      .in('id', entityIds);

    const uniCountry: Record<string, string> = {};
    for (const u of (unis || [])) {
      uniCountry[u.id] = u.country_code;
    }

    // Group by country, rank within each group
    const byCountry: Record<string, typeof scored> = {};
    for (const s of scored) {
      const cc = uniCountry[s.entity_id] || 'unknown';
      if (!byCountry[cc]) byCountry[cc] = [];
      byCountry[cc].push(s);
    }

    const result: Record<string, number> = {};
    for (const [, group] of Object.entries(byCountry)) {
      let rank = 0, lastScore = -1, lastConf = -1;
      for (const row of group) {
        if (row.score !== lastScore || row.confidence !== lastConf) {
          rank++;
          lastScore = row.score;
          lastConf = row.confidence;
        }
        await admin.from('orx_scores').update({ rank_country: rank }).eq('id', row.id);
        result[row.id] = rank;
      }
    }
    return result;
  }

  return {};
}

// ── Launch gating model ──

interface GatingStatus {
  entity_id: string;
  entity_type: string;
  gates: {
    methodology_defined: boolean;
    score_generated: boolean;
    rank_eligible: boolean;
    calibration_passed: boolean;  // always false until manual approval
    launch_blocked: boolean;      // true until calibration_passed
  };
  blocking_reasons: string[];
}

function computeGating(scoreRow: any): GatingStatus {
  const gates = {
    methodology_defined: scoreRow.methodology_version === METHODOLOGY_VERSION,
    score_generated: scoreRow.status === 'scored' && scoreRow.score !== null,
    rank_eligible: scoreRow.status === 'scored' && scoreRow.rank_global !== null,
    calibration_passed: false, // manual gate — never auto-set
    launch_blocked: true,      // blocked until calibration_passed
  };

  const blocking: string[] = [];
  if (!gates.methodology_defined) blocking.push('methodology_version mismatch');
  if (!gates.score_generated) blocking.push('no scored result');
  if (!gates.rank_eligible) blocking.push('not rank-eligible');
  if (!gates.calibration_passed) blocking.push('calibration not passed (manual gate)');

  return {
    entity_id: scoreRow.entity_id,
    entity_type: scoreRow.entity_type,
    gates,
    blocking_reasons: blocking,
  };
}

// ── Calibration harness ──

interface CalibrationFixture {
  id: string;
  entity_type: string;
  entity_id: string;
  label: string;
  expected_band: 'high' | 'medium' | 'low' | 'insufficient';
  evidence_profile: string;
}

const CALIBRATION_FIXTURES: CalibrationFixture[] = [
  {
    id: 'cal-strong-uni',
    entity_type: 'university',
    entity_id: '__cal_strong_uni__',
    label: 'Strong university — rich evidence, multiple domains, high trust',
    expected_band: 'high',
    evidence_profile: 'strong',
  },
  {
    id: 'cal-medium-uni',
    entity_type: 'university',
    entity_id: '__cal_medium_uni__',
    label: 'Medium university — moderate evidence, mixed trust',
    expected_band: 'medium',
    evidence_profile: 'medium',
  },
  {
    id: 'cal-weak-uni',
    entity_type: 'university',
    entity_id: '__cal_weak_uni__',
    label: 'Weak university — minimal evidence, few sources',
    expected_band: 'low',
    evidence_profile: 'weak',
  },
  {
    id: 'cal-insufficient-uni',
    entity_type: 'university',
    entity_id: '__cal_insuf_uni__',
    label: 'Insufficient university — almost no evidence',
    expected_band: 'insufficient',
    evidence_profile: 'insufficient',
  },
  {
    id: 'cal-strong-country',
    entity_type: 'country',
    entity_id: '__cal_strong_ctry__',
    label: 'Strong country — good AI ecosystem evidence',
    expected_band: 'high',
    evidence_profile: 'strong',
  },
  {
    id: 'cal-strong-program',
    entity_type: 'program',
    entity_id: '__cal_strong_prog__',
    label: 'Strong program — future-aligned with industry signals',
    expected_band: 'high',
    evidence_profile: 'strong',
  },
];

function generateCalibrationEvidence(fixture: CalibrationFixture): any[] {
  const now = new Date().toISOString();
  const recentDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 2 months ago
  const olderDate = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(); // 10 months ago

  const families = SIGNAL_FAMILIES[fixture.entity_type] || [];
  const evidence: any[] = [];

  if (fixture.evidence_profile === 'strong') {
    // 8-10 evidence items across all families, multiple domains, high trust
    for (let i = 0; i < families.length; i++) {
      const fam = families[i];
      evidence.push({
        entity_type: fixture.entity_type,
        entity_id: fixture.entity_id,
        layer: fixture.entity_type,
        signal_family: fam.key,
        source_type: 'official_website',
        source_url: `https://cal-source-${i}-a.edu/evidence`,
        source_domain: `cal-source-${i}-a.edu`,
        source_title: `Cal evidence ${fam.key} A`,
        trust_level: 'high',
        contextual_only: false,
        content_hash: `cal_${fixture.id}_${fam.key}_a_${Date.now()}`,
        observed_at: now,
        freshness_date: recentDate,
        evidence_status: 'accepted',
        extraction_confidence: 90,
        methodology_version: METHODOLOGY_VERSION,
      });
      // Second source for independence
      evidence.push({
        entity_type: fixture.entity_type,
        entity_id: fixture.entity_id,
        layer: fixture.entity_type,
        signal_family: fam.key,
        source_type: 'accreditation_body',
        source_url: `https://cal-source-${i}-b.org/report`,
        source_domain: `cal-source-${i}-b.org`,
        source_title: `Cal evidence ${fam.key} B`,
        trust_level: 'high',
        contextual_only: false,
        content_hash: `cal_${fixture.id}_${fam.key}_b_${Date.now()}`,
        observed_at: now,
        freshness_date: recentDate,
        evidence_status: 'accepted',
        extraction_confidence: 85,
        methodology_version: METHODOLOGY_VERSION,
      });
    }
  } else if (fixture.evidence_profile === 'medium') {
    // 5-6 items across some families
    const useFamilies = families.slice(0, 4);
    for (let i = 0; i < useFamilies.length; i++) {
      evidence.push({
        entity_type: fixture.entity_type,
        entity_id: fixture.entity_id,
        layer: fixture.entity_type,
        signal_family: useFamilies[i].key,
        source_type: i < 2 ? 'official_website' : 'verified_student',
        source_url: `https://cal-med-${i}.edu/page`,
        source_domain: `cal-med-${i}.edu`,
        source_title: null,
        trust_level: i < 2 ? 'high' : 'medium',
        contextual_only: false,
        content_hash: `cal_${fixture.id}_${useFamilies[i].key}_${Date.now()}`,
        observed_at: now,
        freshness_date: olderDate,
        evidence_status: 'accepted',
        extraction_confidence: 70,
        methodology_version: METHODOLOGY_VERSION,
      });
    }
    // Add one more for count threshold
    evidence.push({
      entity_type: fixture.entity_type,
      entity_id: fixture.entity_id,
      layer: fixture.entity_type,
      signal_family: useFamilies[0].key,
      source_type: 'course_catalog',
      source_url: `https://cal-med-extra.edu/catalog`,
      source_domain: `cal-med-extra.edu`,
      source_title: null,
      trust_level: 'high',
      contextual_only: false,
      content_hash: `cal_${fixture.id}_extra_${Date.now()}`,
      observed_at: now,
      freshness_date: olderDate,
      evidence_status: 'accepted',
      extraction_confidence: 75,
      methodology_version: METHODOLOGY_VERSION,
    });
  } else if (fixture.evidence_profile === 'weak') {
    // 3 items, limited families, some low trust
    for (let i = 0; i < 3; i++) {
      evidence.push({
        entity_type: fixture.entity_type,
        entity_id: fixture.entity_id,
        layer: fixture.entity_type,
        signal_family: families[i % families.length].key,
        source_type: i === 0 ? 'official_website' : 'news_press',
        source_url: `https://cal-weak-${i}.com/article`,
        source_domain: `cal-weak-${i}.com`,
        source_title: null,
        trust_level: i === 0 ? 'high' : 'low',
        contextual_only: i > 0,
        content_hash: `cal_${fixture.id}_weak_${i}_${Date.now()}`,
        observed_at: now,
        freshness_date: olderDate,
        evidence_status: 'accepted',
        extraction_confidence: 50,
        methodology_version: METHODOLOGY_VERSION,
      });
    }
  } else {
    // insufficient: 1 item
    evidence.push({
      entity_type: fixture.entity_type,
      entity_id: fixture.entity_id,
      layer: fixture.entity_type,
      signal_family: families[0].key,
      source_type: 'news_press',
      source_url: `https://cal-insuf.com/mention`,
      source_domain: `cal-insuf.com`,
      source_title: null,
      trust_level: 'low',
      contextual_only: true,
      content_hash: `cal_${fixture.id}_insuf_${Date.now()}`,
      observed_at: now,
      freshness_date: olderDate,
      evidence_status: 'accepted',
      extraction_confidence: 30,
      methodology_version: METHODOLOGY_VERSION,
    });
  }

  return evidence;
}

// ── Auth helper ──

async function checkAuth(req: Request, supabaseUrl: string, serviceRoleKey: string): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader === `Bearer ${serviceRoleKey}`) return null; // service-role OK

  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = claimsData.claims.sub;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleRow } = await adminClient
    .from('user_roles').select('role')
    .eq('user_id', userId).eq('role', 'admin').maybeSingle();

  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return null;
}

// ── Single entity aggregate + optional composite ──

async function handleSingleAggregate(admin: any, body: any): Promise<Response> {
  const { entity_type, entity_id, composite } = body;

  if (!['university', 'program', 'country'].includes(entity_type)) {
    return new Response(JSON.stringify({ error: 'entity_type must be university/program/country' }), {
      status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!entity_id || typeof entity_id !== 'string') {
    return new Response(JSON.stringify({ error: 'entity_id is required' }), {
      status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch accepted evidence for this entity
  const { data: evidence, error: fetchErr } = await admin
    .from('orx_evidence')
    .select('id, entity_type, entity_id, layer, signal_family, source_type, source_domain, trust_level, contextual_only, freshness_date, observed_at, extraction_confidence, evidence_status, content_hash')
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .eq('evidence_status', 'accepted')
    .eq('methodology_version', METHODOLOGY_VERSION);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: 'Failed to fetch evidence', detail: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const layerResult = aggregateLayer(entity_type, (evidence || []) as unknown as EvidenceRow[]);
  const now = new Date().toISOString();

  // If composite requested, pull/compute all three layers
  let compositeResult: CompositeResult | null = null;
  if (composite) {
    // We need layer scores for all three layers associated with this entity
    // For a university: we need country score (from orx_scores) + this university + program scores
    // For simplicity in v1: composite uses whatever layer scores exist in orx_scores for related entities

    const layers: Record<string, { layer_score: number | null; confidence: number; status: string; badges: string[] }> = {
      country: { layer_score: null, confidence: 0, status: 'evaluating', badges: [] },
      university: { layer_score: null, confidence: 0, status: 'evaluating', badges: [] },
      program: { layer_score: null, confidence: 0, status: 'evaluating', badges: [] },
    };

    // Current entity gets the fresh aggregation
    layers[entity_type] = {
      layer_score: layerResult.layer_score,
      confidence: layerResult.confidence,
      status: layerResult.status,
      badges: layerResult.badges,
    };

    // Pull other layers from orx_scores if they exist
    // Use related_entity_ids from body if provided, else skip
    const relatedIds: Record<string, string> = body.related_entities || {};
    for (const lt of ['country', 'university', 'program']) {
      if (lt === entity_type) continue;
      const relId = relatedIds[lt];
      if (!relId) continue;

      const { data: existing } = await admin
        .from('orx_scores')
        .select('score, confidence, status, badges, country_score, university_score, program_score')
        .eq('entity_type', lt)
        .eq('entity_id', relId)
        .maybeSingle();

      if (existing && existing.status === 'scored') {
        const lScore = lt === 'country' ? existing.country_score
          : lt === 'university' ? existing.university_score
          : existing.program_score;
        layers[lt] = {
          layer_score: lScore ?? existing.score,
          confidence: existing.confidence || 0,
          status: existing.status,
          badges: existing.badges || [],
        };
      }
    }

    compositeResult = computeComposite(layers.country, layers.university, layers.program);
  }

  // Determine final score and status
  const finalScore = compositeResult ? compositeResult.composite_score : layerResult.layer_score;
  const finalStatus = compositeResult ? compositeResult.composite_status : layerResult.status;
  const finalConfidence = compositeResult ? compositeResult.composite_confidence : layerResult.confidence;
  const finalBadges = compositeResult ? compositeResult.badges : layerResult.badges;

  // Upsert orx_scores
  const scoreRow = {
    entity_type,
    entity_id,
    status: finalStatus,
    score: finalScore,
    confidence: finalConfidence,
    country_score: entity_type === 'country' ? layerResult.layer_score
      : compositeResult?.layers.country.source === 'computed' ? compositeResult.layers.country.score : null,
    university_score: entity_type === 'university' ? layerResult.layer_score
      : compositeResult?.layers.university.source === 'computed' ? compositeResult.layers.university.score : null,
    program_score: entity_type === 'program' ? layerResult.layer_score
      : compositeResult?.layers.program.source === 'computed' ? compositeResult.layers.program.score : null,
    badges: finalBadges,
    summary: null,
    methodology_version: METHODOLOGY_VERSION,
    evaluated_at: now,
    evidence_summary: {
      ...layerResult.evidence_summary,
      composite: compositeResult ? {
        layers: compositeResult.layers,
        missing_layers: compositeResult.missing_layers,
        formula: 'C*0.20 + U*0.35 + P*0.45',
      } : null,
    },
    updated_at: now,
  };

  const { data: upserted, error: upsertErr } = await admin
    .from('orx_scores')
    .upsert(scoreRow, { onConflict: 'entity_type,entity_id' })
    .select()
    .single();

  if (upsertErr) {
    return new Response(JSON.stringify({ error: 'Score write failed', detail: upsertErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // History
  const historyRow = {
    entity_type, entity_id,
    score: finalScore, confidence: finalConfidence,
    country_score: scoreRow.country_score,
    university_score: scoreRow.university_score,
    program_score: scoreRow.program_score,
    badges: finalBadges,
    methodology_version: METHODOLOGY_VERSION,
    evaluated_at: now,
    evidence_summary: scoreRow.evidence_summary,
  };
  const { data: history } = await admin.from('orx_score_history').insert(historyRow).select('id').single();

  // Gating
  const gating = computeGating(upserted);

  return new Response(JSON.stringify({
    outcome: finalStatus,
    aggregation_version: 'v1',
    methodology_version: METHODOLOGY_VERSION,
    score: upserted,
    history_id: history?.id || null,
    signal_scores: layerResult.signal_scores,
    evidence_summary: scoreRow.evidence_summary,
    composite: compositeResult,
    gating,
  }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Calibration runner ──

async function handleCalibrationRun(admin: any): Promise<Response> {
  const results: any[] = [];

  for (const fixture of CALIBRATION_FIXTURES) {
    // Clean up any prior calibration data for this entity
    await admin.from('orx_evidence').delete().eq('entity_id', fixture.entity_id);
    await admin.from('orx_score_history').delete().eq('entity_id', fixture.entity_id);
    await admin.from('orx_scores').delete().eq('entity_id', fixture.entity_id);

    // Generate and insert calibration evidence
    const evidence = generateCalibrationEvidence(fixture);
    const { error: insErr } = await admin.from('orx_evidence').insert(evidence);
    if (insErr) {
      results.push({ fixture: fixture.id, error: `Evidence insert failed: ${insErr.message}` });
      continue;
    }

    // Aggregate
    const { data: ev } = await admin
      .from('orx_evidence')
      .select('id, entity_type, entity_id, layer, signal_family, source_type, source_domain, trust_level, contextual_only, freshness_date, observed_at, extraction_confidence, evidence_status, content_hash')
      .eq('entity_id', fixture.entity_id)
      .eq('evidence_status', 'accepted');

    const agg = aggregateLayer(fixture.entity_type, (ev || []) as unknown as EvidenceRow[]);

    // Write score
    const now = new Date().toISOString();
    await admin.from('orx_scores').upsert({
      entity_type: fixture.entity_type,
      entity_id: fixture.entity_id,
      status: agg.status,
      score: agg.layer_score,
      confidence: agg.confidence,
      country_score: fixture.entity_type === 'country' ? agg.layer_score : null,
      university_score: fixture.entity_type === 'university' ? agg.layer_score : null,
      program_score: fixture.entity_type === 'program' ? agg.layer_score : null,
      badges: agg.badges,
      methodology_version: METHODOLOGY_VERSION,
      evaluated_at: now,
      evidence_summary: agg.evidence_summary,
      updated_at: now,
    }, { onConflict: 'entity_type,entity_id' });

    // History
    await admin.from('orx_score_history').insert({
      entity_type: fixture.entity_type,
      entity_id: fixture.entity_id,
      score: agg.layer_score,
      confidence: agg.confidence,
      methodology_version: METHODOLOGY_VERSION,
      evaluated_at: now,
      evidence_summary: agg.evidence_summary,
    });

    const bandMatch =
      (fixture.expected_band === 'high' && agg.status === 'scored' && (agg.layer_score ?? 0) >= 50) ||
      (fixture.expected_band === 'medium' && agg.status === 'scored' && (agg.layer_score ?? 0) >= 20 && (agg.layer_score ?? 0) < 70) ||
      (fixture.expected_band === 'low' && (agg.status === 'evaluating' || (agg.layer_score ?? 0) < 30)) ||
      (fixture.expected_band === 'insufficient' && agg.status !== 'scored');

    results.push({
      fixture_id: fixture.id,
      label: fixture.label,
      expected_band: fixture.expected_band,
      actual_status: agg.status,
      actual_score: agg.layer_score,
      actual_confidence: agg.confidence,
      evidence_count: evidence.length,
      band_match: bandMatch,
      signal_scores: agg.signal_scores,
    });
  }

  // Compute ranks across calibration universities
  const globalRanks = await computeRanks(admin, 'university');
  const countryRanks = await computeCountryRanks(admin, 'university');

  // Fetch final scored state for calibration entities
  const { data: finalScores } = await admin
    .from('orx_scores')
    .select('entity_id, entity_type, status, score, confidence, rank_global, rank_country')
    .in('entity_id', CALIBRATION_FIXTURES.map(f => f.entity_id));

  // Gating for each
  const gatingResults = (finalScores || []).map((s: any) => computeGating(s));

  return new Response(JSON.stringify({
    action: 'calibration_run',
    methodology_version: METHODOLOGY_VERSION,
    fixture_count: CALIBRATION_FIXTURES.length,
    results,
    global_ranks: globalRanks,
    country_ranks_computed: Object.keys(countryRanks).length,
    final_scores: finalScores,
    gating: gatingResults,
    _note: 'Calibration entities use __cal_ prefix IDs. Not real production data.',
  }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authErr = await checkAuth(req, supabaseUrl, serviceRoleKey);
  if (authErr) return authErr;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const action = body.action;

  // ── Route by action ──

  if (action === 'rank') {
    const et = body.entity_type;
    if (!['university', 'program', 'country'].includes(et)) {
      return new Response(JSON.stringify({ error: 'entity_type required for rank action' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const globalResult = await computeRanks(admin, et);
    const countryResult = await computeCountryRanks(admin, et);
    return new Response(JSON.stringify({
      action: 'rank',
      entity_type: et,
      global_ranks: globalResult,
      country_ranks_computed: Object.keys(countryResult).length,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (action === 'batch') {
    const entities = body.entities;
    if (!Array.isArray(entities) || entities.length === 0 || entities.length > 50) {
      return new Response(JSON.stringify({ error: 'entities must be array (1-50)' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const batchResults: any[] = [];
    for (const ent of entities) {
      const res = await handleSingleAggregate(admin, ent);
      const resBody = await res.json();
      batchResults.push({ entity_type: ent.entity_type, entity_id: ent.entity_id, result: resBody });
    }

    // Recompute ranks for affected types
    const affectedTypes = [...new Set(entities.map((e: any) => e.entity_type))];
    const rankResults: Record<string, any> = {};
    for (const et of affectedTypes) {
      rankResults[et] = {
        global: await computeRanks(admin, et),
        country: await computeCountryRanks(admin, et),
      };
    }

    return new Response(JSON.stringify({
      action: 'batch',
      count: batchResults.length,
      results: batchResults,
      ranks: rankResults,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (action === 'calibration_run') {
    return handleCalibrationRun(admin);
  }

  if (action === 'gating') {
    const { entity_type: et, entity_id: eid } = body;
    const { data: scoreRow } = await admin
      .from('orx_scores')
      .select('*')
      .eq('entity_type', et)
      .eq('entity_id', eid)
      .maybeSingle();

    if (!scoreRow) {
      return new Response(JSON.stringify({
        gating: computeGating({ entity_id: eid, entity_type: et, status: 'evaluating', methodology_version: null, score: null, rank_global: null }),
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ gating: computeGating(scoreRow) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Default: single entity aggregate
  return handleSingleAggregate(admin, body);
});
