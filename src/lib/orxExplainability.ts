/**
 * ORX Explainability Contract — deterministic extraction of top reasons,
 * missing layers, confidence notes, and freshness notes from published data.
 *
 * NEVER invents data. Returns "limited" explanation when insufficient info.
 */

import type { OrxScore } from '@/types/orx';

export interface OrxExplanation {
  topStrengths: string[];      // i18n keys
  missingLayers: string[];     // i18n keys
  confidenceNote: string;      // i18n key
  freshnessNote: string | null;// i18n key or null
  hasStructuredExplanation: boolean;
}

const LAYER_KEYS = [
  { field: 'orx_country_score' as const, key: 'orx.explain.layer.country' },
  { field: 'orx_university_score' as const, key: 'orx.explain.layer.university' },
  { field: 'orx_program_score' as const, key: 'orx.explain.layer.program' },
];

/**
 * Extract a deterministic explanation from existing OrxScore fields.
 * No hallucination — only derives from available numeric/enum data.
 */
export function extractOrxExplanation(orx: OrxScore): OrxExplanation {
  if (orx.orx_status !== 'scored' || orx.orx_score === null) {
    return {
      topStrengths: [],
      missingLayers: [],
      confidenceNote: 'orx.explain.confidence.unavailable',
      freshnessNote: null,
      hasStructuredExplanation: false,
    };
  }

  // ── Top strengths: layers scoring >= 60 ──
  const topStrengths: string[] = [];
  if (orx.orx_country_score !== null && orx.orx_country_score >= 60) {
    topStrengths.push('orx.explain.strength.strongCountry');
  }
  if (orx.orx_university_score !== null && orx.orx_university_score >= 60) {
    topStrengths.push('orx.explain.strength.strongUniversity');
  }
  if (orx.orx_program_score !== null && orx.orx_program_score >= 60) {
    topStrengths.push('orx.explain.strength.strongProgram');
  }

  // Badge-derived strengths
  if (orx.orx_badges.includes('future_ready')) {
    topStrengths.push('orx.explain.strength.futureReady');
  }
  if (orx.orx_badges.includes('ai_era_ready')) {
    topStrengths.push('orx.explain.strength.aiReady');
  }
  if (orx.orx_badges.includes('strong_industry_link')) {
    topStrengths.push('orx.explain.strength.industryLinked');
  }

  // ── Missing layers ──
  const missingLayers: string[] = [];
  for (const layer of LAYER_KEYS) {
    if (orx[layer.field] === null) {
      missingLayers.push(layer.key);
    }
  }

  // ── Confidence note ──
  let confidenceNote: string;
  if (orx.orx_confidence === null) {
    confidenceNote = 'orx.explain.confidence.unavailable';
  } else if (orx.orx_confidence >= 70) {
    confidenceNote = 'orx.explain.confidence.high';
  } else if (orx.orx_confidence >= 40) {
    confidenceNote = 'orx.explain.confidence.moderate';
  } else {
    confidenceNote = 'orx.explain.confidence.low';
  }

  // ── Freshness note ──
  let freshnessNote: string | null = null;
  if (orx.orx_last_evaluated_at) {
    const evalDate = new Date(orx.orx_last_evaluated_at);
    const diffMs = Date.now() - evalDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 90) {
      freshnessNote = 'orx.explain.freshness.recent';
    } else if (diffDays <= 365) {
      freshnessNote = 'orx.explain.freshness.withinYear';
    } else {
      freshnessNote = 'orx.explain.freshness.older';
    }
  }

  const hasStructuredExplanation = topStrengths.length > 0 || missingLayers.length > 0;

  return {
    topStrengths: topStrengths.slice(0, 4), // max 4
    missingLayers,
    confidenceNote,
    freshnessNote,
    hasStructuredExplanation,
  };
}
