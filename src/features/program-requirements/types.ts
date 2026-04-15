// ═══════════════════════════════════════════════════════════════
// Program Requirements KB — Door 4.5
// ═══════════════════════════════════════════════════════════════
// Minimal program-level requirements contract.
// Not a full global KB — a feedable lane for decision engine.
// ═══════════════════════════════════════════════════════════════

import type { SubjectFamily } from '../academic-truth/types';

// ── Requirement Types V1 ─────────────────────────────────────

export const REQUIREMENT_TYPES = [
  'subject_minimum',
  'overall_grade_minimum',
  'english_minimum',
  'credential_type_required',
  'portfolio_required',
  'test_required',
  'work_experience_required',
] as const;

export type RequirementType = typeof REQUIREMENT_TYPES[number];

// ── Review Status ────────────────────────────────────────────

export type RequirementReviewStatus =
  | 'verified'      // confirmed from official source
  | 'consensus'     // from admissions_consensus table
  | 'inferred'      // heuristic/default
  | 'unverified';   // not yet reviewed

// ── Program Requirement Record ───────────────────────────────

export interface ProgramRequirement {
  requirement_id: string;
  program_id: string;
  requirement_type: RequirementType;
  subject_family: SubjectFamily | null;
  minimum_grade_raw: string | null;
  minimum_grade_normalized: number | null;  // 0–100
  minimum_overall_grade: number | null;     // 0–4.0 scale
  accepted_credential_types: string[] | null; // bachelor, master, etc.
  english_test_type: string | null;         // ielts | toefl | etc
  minimum_english_total: number | null;
  minimum_reading: number | null;
  minimum_writing: number | null;
  minimum_listening: number | null;
  minimum_speaking: number | null;
  portfolio_required: boolean;
  test_required: boolean;
  work_experience_required: boolean;
  country_constraint: string | null;
  notes: string | null;
  confidence: number;                       // 0.0–1.0
  review_status: RequirementReviewStatus;
}

// ── Factory ──────────────────────────────────────────────────

export function createRequirement(
  programId: string,
  type: RequirementType,
  overrides?: Partial<ProgramRequirement>,
): ProgramRequirement {
  return {
    requirement_id: crypto.randomUUID(),
    program_id: programId,
    requirement_type: type,
    subject_family: null,
    minimum_grade_raw: null,
    minimum_grade_normalized: null,
    minimum_overall_grade: null,
    accepted_credential_types: null,
    english_test_type: null,
    minimum_english_total: null,
    minimum_reading: null,
    minimum_writing: null,
    minimum_listening: null,
    minimum_speaking: null,
    portfolio_required: false,
    test_required: false,
    work_experience_required: false,
    country_constraint: null,
    notes: null,
    confidence: 0.5,
    review_status: 'unverified',
    ...overrides,
  };
}
