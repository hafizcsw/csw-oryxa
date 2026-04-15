// ─── Readiness Calculation Engine ───
// Client-side eligibility calculator using requirement truth context only.

import type {
  ReadinessProfile,
  ReadinessResult,
  ReadinessVerdict,
  GapCard,
  GapCategory,
  EligibilityStep,
  DocumentChecklistItem,
  DocumentStatus,
  AlternativeRoute,
  RequirementTruthContext,
  RequirementTruthStatus,
} from './types';

let gapIdCounter = 0;
const nextGapId = () => `gap_${++gapIdCounter}`;

function isMaterialSeverity(severity: GapCard['severity']): boolean {
  return severity === 'blocking' || severity === 'warning' || severity === 'info';
}

function hasSufficientRequirementTruth(requirements?: RequirementTruthContext): boolean {
  if (!requirements) return false;
  if (requirements.source_status === 'unverified') return false;

  return Boolean(
    requirements.min_gpa != null ||
    requirements.min_ielts != null ||
    requirements.min_toefl != null ||
    (requirements.required_subjects && requirements.required_subjects.length > 0) ||
    requirements.deadline ||
    (requirements.intake_semesters && requirements.intake_semesters.length > 0) ||
    requirements.direct_route_available != null ||
    requirements.has_foundation != null ||
    requirements.has_pathway != null
  );
}

/** Calculate readiness for a given profile against verified target requirements */
export function calculateReadiness(
  profile: ReadinessProfile,
  requirements?: RequirementTruthContext
): ReadinessResult {
  gapIdCounter = 0;
  const gaps: GapCard[] = [];
  const alternatives: AlternativeRoute[] = [];

  const truthSufficient = hasSufficientRequirementTruth(requirements);
  const alternativeRoutesChecked = Boolean(requirements);
  const sourceStatus: RequirementTruthStatus = requirements?.source_status ?? 'unverified';

  if (truthSufficient) {
    // 1. English test gap
    if (!profile.english_test_type || profile.english_test_type === 'none') {
      if (requirements.min_ielts != null || requirements.min_toefl != null) {
        gaps.push(createGap('english_test', 'blocking', {
          estimated_time_weeks: 8,
          estimated_cost_band: 'medium',
          route_type: 'test_prep',
          service_link: {
            service_id: requirements.min_toefl != null && requirements.min_ielts == null ? 'toefl_prep' : 'ielts_prep',
            service_type: requirements.min_toefl != null && requirements.min_ielts == null ? 'toefl_prep' : 'ielts_prep',
            label_key: requirements.min_toefl != null && requirements.min_ielts == null
              ? 'readiness.services.toefl_prep'
              : 'readiness.services.ielts_prep',
          },
        }));
      }
    } else if (requirements.min_ielts != null && profile.english_test_type === 'ielts' && profile.english_test_score != null) {
      if (profile.english_test_score < requirements.min_ielts) {
        gaps.push(createGap('english_test', 'blocking', {
          current_value: profile.english_test_score,
          required_value: requirements.min_ielts,
          estimated_time_weeks: 6,
          estimated_cost_band: 'medium',
          route_type: 'test_prep',
          service_link: {
            service_id: 'ielts_prep',
            service_type: 'ielts_prep',
            label_key: 'readiness.services.ielts_prep',
          },
        }));
      }
    } else if (requirements.min_toefl != null && profile.english_test_type === 'toefl' && profile.english_test_score != null) {
      if (profile.english_test_score < requirements.min_toefl) {
        gaps.push(createGap('english_test', 'blocking', {
          current_value: profile.english_test_score,
          required_value: requirements.min_toefl,
          estimated_time_weeks: 6,
          estimated_cost_band: 'medium',
          route_type: 'test_prep',
          service_link: {
            service_id: 'toefl_prep',
            service_type: 'toefl_prep',
            label_key: 'readiness.services.toefl_prep',
          },
        }));
      }
    }

    // 2. GPA gap
    if (requirements.min_gpa != null && profile.gpa != null) {
      const normalizedGpa = normalizeGpa(profile.gpa, profile.gpa_scale || 4);
      if (normalizedGpa < requirements.min_gpa) {
        gaps.push(createGap('gpa_below_threshold', 'blocking', {
          current_value: normalizedGpa.toFixed(2),
          required_value: requirements.min_gpa,
          route_type: requirements.has_foundation ? 'foundation' : 'alternative_university',
        }));

        if (requirements.has_foundation) {
          alternatives.push({
            type: 'same_university_pathway',
            reason_key: 'readiness.alternatives.foundation_available',
            entry_barrier_key: 'readiness.alternatives.barrier_foundation',
          });
        }
      }
    }

    // 3. Prerequisite subjects
    if (requirements.required_subjects?.length && profile.subjects_completed) {
      const missing = requirements.required_subjects.filter(s => !profile.subjects_completed?.includes(s));
      if (missing.length > 0) {
        gaps.push(createGap('prerequisite_subject', 'blocking', {
          estimated_time_weeks: 12,
          estimated_cost_band: 'medium',
          route_type: requirements.has_pathway ? 'pathway' : 'alternative_program',
          service_link: {
            service_id: 'subject_remediation',
            service_type: 'subject_remediation',
            label_key: 'readiness.services.subject_remediation',
          },
        }));

        if (requirements.has_pathway) {
          alternatives.push({
            type: 'same_university_pathway',
            reason_key: 'readiness.alternatives.pathway_available',
            entry_barrier_key: 'readiness.alternatives.barrier_foundation',
          });
        }
      }
    }



    for (const programAlt of requirements.verified_alternative_programs || []) {
      alternatives.push({
        type: 'alternative_program',
        reason_key: 'readiness.alternatives.verified_program_available',
        entry_barrier_key: 'readiness.alternatives.barrier_verified',
        program_title: programAlt.program_title,
        program_slug: programAlt.program_slug,
        university_name: programAlt.university_name,
        university_slug: programAlt.university_slug,
      });
    }

    for (const uniAlt of requirements.verified_alternative_universities || []) {
      alternatives.push({
        type: 'alternative_university',
        reason_key: 'readiness.alternatives.verified_university_available',
        entry_barrier_key: 'readiness.alternatives.barrier_verified',
        university_name: uniAlt.university_name,
        university_slug: uniAlt.university_slug,
      });
    }

    // 4. Intake mismatch
    if (requirements.intake_semesters?.length && profile.intake_semester) {
      if (!requirements.intake_semesters.includes(profile.intake_semester)) {
        gaps.push(createGap('intake_mismatch', 'info'));
      }
    }

    // 5. Deadline check
    if (requirements.deadline) {
      const deadline = new Date(requirements.deadline);
      if (deadline.getTime() < Date.now()) {
        gaps.push(createGap('deadline_missed', 'blocking'));
      }
    }
  }

  // Always compute document readiness from user profile state.
  const docChecklist = buildDocumentChecklist(profile);
  const missingDocs = docChecklist.filter(d => d.status === 'missing');
  if (missingDocs.length > 0) {
    gaps.push(createGap('document_missing', 'warning', {
      estimated_time_weeks: 2,
      estimated_cost_band: 'low',
      route_type: 'document_completion',
      service_link: {
        service_id: 'document_readiness',
        service_type: 'document_readiness',
        label_key: 'readiness.services.document_readiness',
      },
    }));
  }

  const verdict = determineVerdict({ gaps, alternatives, truthSufficient });
  const plans = buildPlans(gaps);

  return {
    verdict,
    gaps,
    plans,
    alternatives,
    document_checklist: docChecklist,
    requirement_source_status: sourceStatus,
    requirement_truth_sufficient: truthSufficient,
    alternative_routes_checked: alternativeRoutesChecked,
    alternative_routes_unavailable_reason_key: gaps.some((g) => g.severity === 'blocking') && alternatives.length === 0
      ? 'readiness.alternatives.none_verified_yet'
      : undefined,
  };
}

function createGap(
  category: GapCategory,
  severity: GapCard['severity'],
  extra?: Partial<GapCard>
): GapCard {
  return {
    id: nextGapId(),
    category,
    title_key: `readiness.gaps.${category}.title`,
    description_key: `readiness.gaps.${category}.description`,
    severity,
    recommended_action_key: `readiness.gaps.${category}.action`,
    ...extra,
  };
}

function determineVerdict({
  gaps,
  alternatives,
  truthSufficient,
}: {
  gaps: GapCard[];
  alternatives: AlternativeRoute[];
  truthSufficient: boolean;
}): ReadinessVerdict {
  if (!truthSufficient) return 'data_unavailable';

  const blocking = gaps.filter(g => g.severity === 'blocking');
  const materialNonBlocking = gaps.filter(g => g.severity !== 'blocking' && isMaterialSeverity(g.severity));

  if (blocking.length === 0) {
    if (materialNonBlocking.length === 0) return 'eligible_now';
    return 'conditionally_eligible';
  }

  if (alternatives.length > 0) return 'alternative_available';
  return 'not_eligible';
}

function normalizeGpa(gpa: number, scale: number): number {
  if (scale === 4) return gpa;
  if (scale === 5) return (gpa / 5) * 4;
  if (scale === 100) return (gpa / 100) * 4;
  return gpa;
}

function buildDocumentChecklist(profile: ReadinessProfile): DocumentChecklistItem[] {
  const docs: Array<{ key: string; field: keyof ReadinessProfile; type: string }> = [
    { key: 'passport', field: 'docs_passport', type: 'passport' },
    { key: 'transcript', field: 'docs_transcript', type: 'transcript' },
    { key: 'certificate', field: 'docs_certificate', type: 'certificate' },
    { key: 'photo', field: 'docs_photo', type: 'photo' },
    { key: 'recommendation', field: 'docs_recommendation', type: 'recommendation' },
    { key: 'cv', field: 'docs_cv', type: 'cv' },
    { key: 'motivation_letter', field: 'docs_motivation_letter', type: 'motivation_letter' },
  ];

  return docs.map((d, i) => {
    const uploaded = profile[d.field] as boolean | undefined;
    const status: DocumentStatus = uploaded ? 'uploaded' : 'missing';
    return {
      id: `doc_${i}`,
      doc_type: d.type,
      label_key: `readiness.documents.${d.key}`,
      status,
    };
  });
}

function buildPlans(gaps: GapCard[]): ReadinessResult['plans'] {
  const blockingGaps = gaps.filter(g => g.severity === 'blocking');
  if (blockingGaps.length === 0) return {};

  const fastestSteps: EligibilityStep[] = [...blockingGaps]
    .sort((a, b) => (a.estimated_time_weeks || 99) - (b.estimated_time_weeks || 99))
    .map((g, i) => ({
      order: i + 1,
      gap_id: g.id,
      action_key: g.recommended_action_key,
      estimated_time_weeks: g.estimated_time_weeks,
      estimated_cost_band: g.estimated_cost_band,
      route_type: g.route_type || 'direct',
      service_link: g.service_link,
    }));

  const costOrder = { free: 0, low: 1, medium: 2, high: 3 };
  const cheapestSteps: EligibilityStep[] = [...blockingGaps]
    .sort((a, b) => (costOrder[a.estimated_cost_band || 'high']) - (costOrder[b.estimated_cost_band || 'high']))
    .map((g, i) => ({
      order: i + 1,
      gap_id: g.id,
      action_key: g.recommended_action_key,
      estimated_time_weeks: g.estimated_time_weeks,
      estimated_cost_band: g.estimated_cost_band,
      route_type: g.route_type || 'direct',
      service_link: g.service_link,
    }));

  return {
    fastest: {
      steps: fastestSteps,
      total_estimated_weeks: fastestSteps.reduce((sum, s) => sum + (s.estimated_time_weeks || 0), 0),
      route_label_key: 'readiness.plans.fastest',
    },
    cheapest: {
      steps: cheapestSteps,
      total_estimated_weeks: cheapestSteps.reduce((sum, s) => sum + (s.estimated_time_weeks || 0), 0),
      route_label_key: 'readiness.plans.cheapest',
    },
  };
}
