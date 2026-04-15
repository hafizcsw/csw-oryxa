/**
 * ORX RANK — Type definitions, DB contract types, and adapter layer
 * 
 * ORX is our proprietary future-readiness ranking system.
 * This module provides:
 * 1. DB-aligned types matching the `orx_scores` table contract
 * 2. UI-facing OrxScore interface consumed by components
 * 3. Safe adapter that bridges DB rows → UI state with fallback logic
 */

// ── DB-aligned enums (match Postgres enums exactly) ──

export type OrxEntityType = 'university' | 'program' | 'country';
export type OrxStatus = 'scored' | 'evaluating' | 'insufficient';

export type OrxBadge = 
  | 'future_ready'
  | 'high_future_relevance'
  | 'ai_era_ready'
  | 'strong_industry_link'
  | 'fast_adapter'
  | 'transparent';

// ── DB row type (mirrors orx_scores table 1:1) ──

export interface OrxScoreRow {
  id: string;
  entity_type: OrxEntityType;
  entity_id: string;
  status: OrxStatus;
  score: number | null;
  rank_global: number | null;
  rank_country: number | null;
  confidence: number | null;
  country_score: number | null;
  university_score: number | null;
  program_score: number | null;
  badges: OrxBadge[];
  summary: string | null;
  methodology_version: string | null;
  evaluated_at: string | null;
  evidence_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ── UI-facing score interface (consumed by OrxRankCard etc.) ──

export interface OrxScore {
  orx_status: OrxStatus;
  orx_score: number | null;
  orx_rank_global: number | null;
  orx_rank_country: number | null;
  orx_confidence: number | null;
  orx_last_evaluated_at: string | null;
  orx_country_score: number | null;
  orx_university_score: number | null;
  orx_program_score: number | null;
  orx_badges: OrxBadge[];
  orx_summary: string | null;
  orx_methodology_version: string | null;
}

// ── Sub-signal for detailed breakdowns ──

export interface OrxSubSignal {
  key: string;
  label_key: string;
  score: number | null;
  available: boolean;
}

// ── Article type (content layer) ──

export interface OrxArticle {
  slug: string;
  title_key: string;
  excerpt_key: string;
  /** Base key prefix for body sections, e.g. 'orx.articles.whatIsOrx' */
  body_prefix: string;
  sections_count: number;
  category: 'methodology' | 'insights' | 'country' | 'university' | 'program' | 'future_jobs';
  image_url?: string;
  published_at?: string;
  read_time_minutes?: number;
}

// ── Adapter: DB row → UI OrxScore ──

/**
 * Convert a DB orx_scores row into the UI-facing OrxScore shape.
 */
export function orxRowToScore(row: OrxScoreRow): OrxScore {
  return {
    orx_status: row.status,
    orx_score: row.score,
    orx_rank_global: row.rank_global,
    orx_rank_country: row.rank_country,
    orx_confidence: row.confidence,
    orx_last_evaluated_at: row.evaluated_at,
    orx_country_score: row.country_score,
    orx_university_score: row.university_score,
    orx_program_score: row.program_score,
    orx_badges: row.badges ?? [],
    orx_summary: row.summary,
    orx_methodology_version: row.methodology_version,
  };
}

// ── Adapter: entity record → UI OrxScore (legacy compat) ──

/**
 * Safe adapter: extracts ORX data from any entity object.
 * Supports two paths:
 * 1. If entity has `_orx_row` (pre-joined OrxScoreRow), uses that directly
 * 2. Falls back to reading flat orx_* fields on entity (legacy/view path)
 * Never invents data — if fields are missing, returns 'evaluating' status.
 */
export function extractOrxScore(entity: Record<string, any> | null | undefined): OrxScore {
  if (!entity) {
    return defaultOrxScore('evaluating');
  }

  // Path 1: Pre-joined DB row attached to entity
  if (entity._orx_row) {
    return orxRowToScore(entity._orx_row as OrxScoreRow);
  }

  // Path 2: Flat fields on entity (legacy views / direct columns)
  const status = entity.orx_status as OrxStatus | undefined;
  const score = typeof entity.orx_score === 'number' ? entity.orx_score : null;

  if (!status && score === null) {
    return defaultOrxScore('evaluating');
  }

  return {
    orx_status: status || (score !== null ? 'scored' : 'evaluating'),
    orx_score: score,
    orx_rank_global: typeof entity.orx_rank_global === 'number' ? entity.orx_rank_global : null,
    orx_rank_country: typeof entity.orx_rank_country === 'number' ? entity.orx_rank_country : null,
    orx_confidence: typeof entity.orx_confidence === 'number' ? entity.orx_confidence : null,
    orx_last_evaluated_at: entity.orx_last_evaluated_at || null,
    orx_country_score: typeof entity.orx_country_score === 'number' ? entity.orx_country_score : null,
    orx_university_score: typeof entity.orx_university_score === 'number' ? entity.orx_university_score : null,
    orx_program_score: typeof entity.orx_program_score === 'number' ? entity.orx_program_score : null,
    orx_badges: Array.isArray(entity.orx_badges) ? entity.orx_badges : [],
    orx_summary: entity.orx_summary || null,
    orx_methodology_version: entity.orx_methodology_version || null,
  };
}

export function defaultOrxScore(status: OrxStatus): OrxScore {
  return {
    orx_status: status,
    orx_score: null,
    orx_rank_global: null,
    orx_rank_country: null,
    orx_confidence: null,
    orx_last_evaluated_at: null,
    orx_country_score: null,
    orx_university_score: null,
    orx_program_score: null,
    orx_badges: [],
    orx_summary: null,
    orx_methodology_version: null,
  };
}

/**
 * Get sub-signals for an entity's ORX profile.
 */
export function getOrxSubSignals(entity: Record<string, any> | null | undefined): OrxSubSignal[] {
  const orx = extractOrxScore(entity);
  return [
    { key: 'country_context', label_key: 'orx.signals.countryContext', score: orx.orx_country_score, available: orx.orx_country_score != null },
    { key: 'university_readiness', label_key: 'orx.signals.universityReadiness', score: orx.orx_university_score, available: orx.orx_university_score != null },
    { key: 'program_relevance', label_key: 'orx.signals.programRelevance', score: orx.orx_program_score, available: orx.orx_program_score != null },
    { key: 'student_signal', label_key: 'orx.signals.studentSignal', score: entity?.orx_student_signal ?? null, available: entity?.orx_student_signal != null },
  ];
}

/**
 * Badge display configuration
 */
export const ORX_BADGE_CONFIG: Record<OrxBadge, { label_key: string; color: string }> = {
  future_ready: { label_key: 'orx.badges.futureReady', color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800' },
  high_future_relevance: { label_key: 'orx.badges.highFutureRelevance', color: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800' },
  ai_era_ready: { label_key: 'orx.badges.aiEraReady', color: 'text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-950 dark:border-violet-800' },
  strong_industry_link: { label_key: 'orx.badges.strongIndustryLink', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800' },
  fast_adapter: { label_key: 'orx.badges.fastAdapter', color: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-950 dark:border-cyan-800' },
  transparent: { label_key: 'orx.badges.transparent', color: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-950 dark:border-slate-800' },
};
