// ═══════════════════════════════════════════════════════════════
// Door 2 — Country Eligibility Engine (after-secondary, country-level)
// ═══════════════════════════════════════════════════════════════
// Pure function. No DB, no I/O. Reads:
//   - ApplicantTruth (from canonical baseline)
//   - 10 country truth packs
// Returns 10-country matrix with reasons + evidence + matched rules.
// ═══════════════════════════════════════════════════════════════
import type { ApplicantTruth } from './applicant-normalize';
import { COUNTRY_PACKS } from './packs';
import {
  TARGET_COUNTRIES,
  type CountryCode,
  type CountryEligibility,
  type CountryMatrix,
  type CountryStatus,
  type DecisionReason,
  type EntryPathKind,
  type EntryPathwayRule,
  type LanguageRule,
  type ReasonCode,
  type TargetCountryProfile,
} from './types';

function reason(
  code: ReasonCode,
  ruleId: string,
  evidenceIds: string[],
  severity: DecisionReason['severity'],
  params: Record<string, unknown> = {},
): DecisionReason {
  return { reason_code: code, params, matched_rule_id: ruleId, evidence_ids: evidenceIds, severity };
}

function checkPathwayEligibility(
  pathway: EntryPathwayRule,
  applicant: ApplicantTruth,
): { ok: boolean; reasons: DecisionReason[] } {
  const reasons: DecisionReason[] = [];

  if (!pathway.available) {
    reasons.push(reason('path_unavailable_in_country', pathway.rule_id, pathway.evidence_ids, 'blocker', {
      path: pathway.path_kind,
    }));
    return { ok: false, reasons };
  }

  if (pathway.requires_secondary_completed && !applicant.secondary_completed) {
    reasons.push(reason('no_secondary_completion', pathway.rule_id, pathway.evidence_ids, 'blocker'));
  }

  if (
    pathway.min_secondary_grade_pct != null &&
    applicant.secondary_grade_pct != null &&
    applicant.secondary_grade_pct < pathway.min_secondary_grade_pct
  ) {
    reasons.push(reason('secondary_grade_below_min', pathway.rule_id, pathway.evidence_ids, 'blocker', {
      required: pathway.min_secondary_grade_pct,
      observed: applicant.secondary_grade_pct,
    }));
  }

  if (
    pathway.accepted_secondary_kinds &&
    applicant.secondary_kind &&
    !pathway.accepted_secondary_kinds.includes(applicant.secondary_kind)
  ) {
    reasons.push(reason('secondary_kind_not_accepted', pathway.rule_id, pathway.evidence_ids, 'blocker', {
      observed: applicant.secondary_kind,
      accepted: pathway.accepted_secondary_kinds,
    }));
  }

  if (pathway.citizenship_constraints) {
    const cz = applicant.citizenship?.toUpperCase();
    if (cz && pathway.citizenship_constraints.blocked?.includes(cz)) {
      reasons.push(reason('citizenship_blocked', pathway.rule_id, pathway.evidence_ids, 'blocker', { citizenship: cz }));
    }
    if (cz && pathway.citizenship_constraints.allowed_only && !pathway.citizenship_constraints.allowed_only.includes(cz)) {
      reasons.push(reason('citizenship_not_allowed', pathway.rule_id, pathway.evidence_ids, 'blocker', { citizenship: cz }));
    }
  }

  return { ok: reasons.length === 0, reasons };
}

function meetsEnglishMin(rule: LanguageRule, applicant: ApplicantTruth): boolean {
  if (!rule.english_test_min) return false;
  const t = (applicant.english_test_type || '').toLowerCase();
  const s = applicant.english_total_score;
  if (s == null) return false;
  if (t === 'ielts' && rule.english_test_min.ielts != null) return s >= rule.english_test_min.ielts;
  if (t === 'toefl' && rule.english_test_min.toefl_ibt != null) return s >= rule.english_test_min.toefl_ibt;
  if (t === 'duolingo' && rule.english_test_min.duolingo != null) return s >= rule.english_test_min.duolingo;
  if (t === 'pte' && rule.english_test_min.pte != null) return s >= rule.english_test_min.pte;
  return false;
}

function checkLanguage(
  pathKind: EntryPathKind,
  profile: TargetCountryProfile,
  applicant: ApplicantTruth,
): { reasons: DecisionReason[]; matched_rule_ids: string[]; evidence_ids: string[] } {
  const reasons: DecisionReason[] = [];
  const matched: string[] = [];
  const evidence: string[] = [];

  const applicableRules = profile.language_rules.filter((r) => r.applies_to_paths.includes(pathKind));
  if (applicableRules.length === 0) return { reasons, matched_rule_ids: matched, evidence_ids: evidence };

  // exemption check across ANY applicable rule
  const exemptionHit = applicableRules.find((r) =>
    (r.exemption_basis || []).some((b) =>
      (b === 'english_medium_secondary' && applicant.english_medium_secondary) ||
      (b === 'majority_english_country' && applicant.majority_english_country)
    ),
  );
  if (exemptionHit) {
    matched.push(exemptionHit.rule_id);
    evidence.push(...exemptionHit.evidence_ids);
    return { reasons, matched_rule_ids: matched, evidence_ids: evidence };
  }

  // try each applicable rule (english OR local)
  let anySatisfied = false;
  for (const r of applicableRules) {
    matched.push(r.rule_id);
    evidence.push(...r.evidence_ids);
    if (r.language === 'english' || r.language === 'either') {
      if (meetsEnglishMin(r, applicant)) { anySatisfied = true; break; }
    }
    if (r.language === 'local' || r.language === 'either') {
      if (r.local_language_code && applicant.local_language_signals.includes(r.local_language_code)) {
        anySatisfied = true; break;
      }
    }
  }

  if (!anySatisfied) {
    // Decide which reason is most informative
    const englishRule = applicableRules.find((r) => r.language === 'english' || r.language === 'either');
    const localRule = applicableRules.find((r) => r.language === 'local');
    if (englishRule) {
      if (applicant.english_total_score == null || applicant.english_test_type == null) {
        reasons.push(reason('language_test_missing', englishRule.rule_id, englishRule.evidence_ids, 'gap', {
          required: englishRule.english_test_min,
        }));
      } else {
        reasons.push(reason('language_score_below_min', englishRule.rule_id, englishRule.evidence_ids, 'gap', {
          test: applicant.english_test_type,
          observed: applicant.english_total_score,
          required: englishRule.english_test_min,
        }));
      }
    }
    if (localRule && !englishRule) {
      reasons.push(reason('local_language_required', localRule.rule_id, localRule.evidence_ids, 'gap', {
        language: localRule.local_language_code,
        test: localRule.local_test_min,
      }));
    }
  }

  return { reasons, matched_rule_ids: matched, evidence_ids: evidence };
}

function evaluateCountry(
  profile: TargetCountryProfile,
  applicant: ApplicantTruth,
): CountryEligibility {
  const eligible: EntryPathKind[] = [];
  const blocked: EntryPathKind[] = [];
  const blockingGaps: DecisionReason[] = [];
  const blockers: DecisionReason[] = [];
  const info: DecisionReason[] = [];
  const matchedRuleIds: string[] = [];
  const evidenceIds: string[] = [];

  // truth-insufficient short-circuit
  const truthInsufficient = !applicant.secondary_completed && applicant.secondary_grade_pct == null
    && applicant.english_total_score == null;

  for (const pathway of profile.pathways) {
    matchedRuleIds.push(pathway.rule_id);
    evidenceIds.push(...pathway.evidence_ids);

    const { ok: pathwayOk, reasons: pathwayReasons } = checkPathwayEligibility(pathway, applicant);
    const lang = checkLanguage(pathway.path_kind, profile, applicant);
    matchedRuleIds.push(...lang.matched_rule_ids);
    evidenceIds.push(...lang.evidence_ids);

    const pathwayBlockers = pathwayReasons.filter((r) => r.severity === 'blocker');
    const langGaps = lang.reasons.filter((r) => r.severity === 'gap');

    if (pathwayBlockers.length > 0) {
      blocked.push(pathway.path_kind);
      blockers.push(...pathwayBlockers);
    } else if (langGaps.length > 0) {
      // path is structurally open but conditional on language gap
      eligible.push(pathway.path_kind);
      blockingGaps.push(...langGaps);
    } else {
      eligible.push(pathway.path_kind);
    }
  }

  // dedupe + clean blocked set (a path might appear in both if multiple checks)
  const eligibleSet = new Set(eligible);
  const finalBlocked = blocked.filter((p) => !eligibleSet.has(p));

  let status: CountryStatus;
  if (truthInsufficient) {
    status = 'unknown';
    info.push(reason('truth_insufficient', `${profile.country_code}.engine.truth_check`, [], 'info'));
  } else if (eligibleSet.size === 0) {
    status = 'blocked';
  } else if (blockingGaps.length > 0) {
    status = 'conditional';
  } else {
    status = 'eligible';
  }

  // confidence: simple heuristic from truth completeness
  let conf = 0.4;
  if (applicant.secondary_completed) conf += 0.2;
  if (applicant.secondary_grade_pct != null) conf += 0.15;
  if (applicant.english_total_score != null) conf += 0.15;
  if (applicant.citizenship) conf += 0.1;
  conf = Math.min(1, conf);

  return {
    country_code: profile.country_code,
    status,
    eligible_entry_paths: Array.from(eligibleSet),
    blocked_entry_paths: finalBlocked,
    blocking_gaps: blockingGaps,
    blockers,
    info_reasons: info,
    matched_rule_ids: Array.from(new Set(matchedRuleIds)),
    evidence_ids: Array.from(new Set(evidenceIds)),
    confidence: Number(conf.toFixed(2)),
    pack_version: profile.pack_version,
  };
}

export function computeCountryMatrix(applicant: ApplicantTruth): CountryMatrix {
  const results = TARGET_COUNTRIES.map((cc: CountryCode) =>
    evaluateCountry(COUNTRY_PACKS[cc], applicant),
  );

  return {
    applicant_summary: {
      student_id: applicant.student_id,
      citizenship: applicant.citizenship,
      secondary_completed: applicant.secondary_completed,
      secondary_kind: applicant.secondary_kind,
      secondary_grade_pct: applicant.secondary_grade_pct,
      english_test_type: applicant.english_test_type,
      english_total_score: applicant.english_total_score,
      local_language_signals: applicant.local_language_signals,
    },
    results,
    generated_at: new Date().toISOString(),
  };
}
