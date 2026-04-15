// ═══════════════════════════════════════════════════════════════
// Requirements Adapter — Door 4.5
// ═══════════════════════════════════════════════════════════════
// Reads program requirements from existing DB tables:
//   - admission_rules_program (program-level requirement_set)
//   - admissions_consensus (consensus GPA/IELTS/TOEFL mins)
// Maps them to ProgramRequirement[] for the decision engine.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type { ProgramRequirement, RequirementReviewStatus } from './types';
import { createRequirement } from './types';

/**
 * Fetch program requirements from existing DB tables.
 * Returns ProgramRequirement[] built from:
 *  1. admission_rules_program (if exists, highest fidelity)
 *  2. admissions_consensus (fallback, aggregated observations)
 */
export async function fetchProgramRequirements(
  programId: string,
): Promise<ProgramRequirement[]> {
  const requirements: ProgramRequirement[] = [];

  // 1. Try program-level rules first
  const { data: ruleData } = await supabase
    .from('admission_rules_program')
    .select('requirement_set, is_active')
    .eq('program_id', programId)
    .eq('is_active', true)
    .maybeSingle();

  if (ruleData?.requirement_set) {
    const parsed = parseProgramRuleSet(programId, ruleData.requirement_set as any, 'verified');
    requirements.push(...parsed);
  }

  // 2. Fallback to consensus
  if (requirements.length === 0) {
    const { data: consensus } = await supabase
      .from('admissions_consensus')
      .select('consensus_min_gpa, consensus_min_ielts, consensus_min_toefl, confidence_score')
      .eq('program_id', programId)
      .eq('is_stale', false)
      .maybeSingle();

    if (consensus) {
      const conf = consensus.confidence_score ?? 0.5;

      if (consensus.consensus_min_gpa != null) {
        requirements.push(createRequirement(programId, 'overall_grade_minimum', {
          minimum_overall_grade: consensus.consensus_min_gpa,
          confidence: conf,
          review_status: 'consensus',
        }));
      }

      if (consensus.consensus_min_ielts != null) {
        requirements.push(createRequirement(programId, 'english_minimum', {
          english_test_type: 'ielts',
          minimum_english_total: consensus.consensus_min_ielts,
          confidence: conf,
          review_status: 'consensus',
        }));
      }

      if (consensus.consensus_min_toefl != null) {
        requirements.push(createRequirement(programId, 'english_minimum', {
          english_test_type: 'toefl',
          minimum_english_total: consensus.consensus_min_toefl,
          confidence: conf,
          review_status: 'consensus',
        }));
      }
    }
  }

  return requirements;
}

/**
 * Parse a JSON requirement_set into ProgramRequirement[].
 * requirement_set shape is flexible/JSON — we extract what we can.
 */
function parseProgramRuleSet(
  programId: string,
  ruleSet: Record<string, any>,
  reviewStatus: RequirementReviewStatus,
): ProgramRequirement[] {
  const reqs: ProgramRequirement[] = [];

  if (ruleSet.min_gpa != null) {
    reqs.push(createRequirement(programId, 'overall_grade_minimum', {
      minimum_overall_grade: Number(ruleSet.min_gpa),
      confidence: 0.9,
      review_status: reviewStatus,
    }));
  }

  if (ruleSet.min_ielts != null) {
    reqs.push(createRequirement(programId, 'english_minimum', {
      english_test_type: 'ielts',
      minimum_english_total: Number(ruleSet.min_ielts),
      minimum_reading: ruleSet.min_ielts_reading != null ? Number(ruleSet.min_ielts_reading) : null,
      minimum_writing: ruleSet.min_ielts_writing != null ? Number(ruleSet.min_ielts_writing) : null,
      minimum_listening: ruleSet.min_ielts_listening != null ? Number(ruleSet.min_ielts_listening) : null,
      minimum_speaking: ruleSet.min_ielts_speaking != null ? Number(ruleSet.min_ielts_speaking) : null,
      confidence: 0.9,
      review_status: reviewStatus,
    }));
  }

  if (ruleSet.min_toefl != null) {
    reqs.push(createRequirement(programId, 'english_minimum', {
      english_test_type: 'toefl',
      minimum_english_total: Number(ruleSet.min_toefl),
      confidence: 0.9,
      review_status: reviewStatus,
    }));
  }

  if (ruleSet.required_subjects && Array.isArray(ruleSet.required_subjects)) {
    for (const subj of ruleSet.required_subjects) {
      const family = typeof subj === 'string' ? subj : subj.family;
      const minGrade = typeof subj === 'object' ? subj.min_grade : null;
      reqs.push(createRequirement(programId, 'subject_minimum', {
        subject_family: family,
        minimum_grade_normalized: minGrade != null ? Number(minGrade) : null,
        confidence: 0.8,
        review_status: reviewStatus,
      }));
    }
  }

  if (ruleSet.credential_types && Array.isArray(ruleSet.credential_types)) {
    reqs.push(createRequirement(programId, 'credential_type_required', {
      accepted_credential_types: ruleSet.credential_types,
      confidence: 0.9,
      review_status: reviewStatus,
    }));
  }

  if (ruleSet.portfolio_required) {
    reqs.push(createRequirement(programId, 'portfolio_required', {
      portfolio_required: true,
      confidence: 0.9,
      review_status: reviewStatus,
    }));
  }

  return reqs;
}
