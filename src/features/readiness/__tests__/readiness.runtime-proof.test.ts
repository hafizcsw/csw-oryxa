import { describe, it, expect } from 'vitest';
import { calculateReadiness } from '@/features/readiness/engine';
import { buildProgramTruthData, buildUniversityTruthData, buildProgramDecisionData } from '@/features/readiness/truthHelpers';
import type { ReadinessProfile } from '@/features/readiness/types';
import en from '@/locales/en/common.json';
import ar from '@/locales/ar/common.json';

describe('readiness verdict runtime proofs', () => {
  const profileBase = {
    gpa: 3.6,
    gpa_scale: 4,
    english_test_type: 'ielts',
    english_test_score: 6.5,
    intake_semester: 'fall',
    subjects_completed: ['math', 'physics'],
    docs_passport: true,
    docs_transcript: true,
    docs_certificate: true,
    docs_photo: true,
    docs_recommendation: true,
    docs_cv: true,
    docs_motivation_letter: true,
  } satisfies ReadinessProfile;

  it('eligible_now when no blocking and no warning/info material gaps', () => {
    const result = calculateReadiness({ ...profileBase }, {
      source_status: 'verified',
      min_gpa: 3,
      min_ielts: 6,
      required_subjects: ['math'],
      intake_semesters: ['fall'],
    });
    expect(result.verdict).toBe('eligible_now');
  });

  it('conditionally_eligible when only non-blocking gaps exist', () => {
    const result = calculateReadiness({ ...profileBase, docs_photo: false }, {
      source_status: 'verified',
      min_gpa: 3,
      min_ielts: 6,
      intake_semesters: ['fall'],
    });
    expect(result.verdict).toBe('conditionally_eligible');
    expect(result.gaps.some((g) => g.category === 'document_missing')).toBe(true);
  });

  it('alternative_available when blocking exists and valid alternative route exists', () => {
    const result = calculateReadiness({ ...profileBase, gpa: 2.1 }, {
      source_status: 'verified',
      min_gpa: 3,
      has_foundation: true,
      min_ielts: 6,
    });
    expect(result.verdict).toBe('alternative_available');
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it('not_eligible when blocking exists and no valid alternative route', () => {
    const result = calculateReadiness({ ...profileBase, gpa: 2.1 }, {
      source_status: 'verified',
      min_gpa: 3,
      has_foundation: false,
      has_pathway: false,
      min_ielts: 6,
    });
    expect(result.verdict).toBe('not_eligible');
  });



  it('marks blocked cases with no verified alternatives as none-verified-yet', () => {
    const result = calculateReadiness({ ...profileBase, gpa: 2.0 }, {
      source_status: 'verified',
      min_gpa: 3,
      has_foundation: false,
      has_pathway: false,
      min_ielts: 6,
    });

    expect(result.alternative_routes_unavailable_reason_key).toBe('readiness.alternatives.none_verified_yet');
  });

  it('data_unavailable when target truth is missing or insufficient', () => {
    const result = calculateReadiness({ ...profileBase }, undefined);
    expect(result.verdict).toBe('data_unavailable');
    expect(result.requirement_truth_sufficient).toBe(false);
  });
});

describe('truth and decision helpers runtime proofs', () => {
  it('program truth renders supported sections when source data exists', () => {
    const truth = buildProgramTruthData({
      ielts_required: 6,
      min_gpa: 3,
      accepted_certificates: ['High School Certificate'],
      required_documents: ['Passport'],
      application_steps: ['Submit form'],
      direct_admission_available: true,
      next_intake: 'Fall 2026',
      next_intake_date: '2026-09-01',
    });

    expect(truth.source_status).toBe('partial');
    expect(truth.language_requirements?.length).toBeGreaterThan(0);
    expect(truth.routes?.length).toBeGreaterThan(0);
  });

  it('program truth degrades honestly when only partial truth exists', () => {
    const truth = buildProgramTruthData({
      next_intake: 'Fall 2026',
    });

    expect(truth.source_status).toBe('partial');
    expect(truth.routes).toBeUndefined();
    expect(truth.language_requirements).toBeUndefined();
  });

  it('university truth maps available admissions and housing only', () => {
    const truth = buildUniversityTruthData(
      { has_dorm: true, dorm_price_monthly_local: 200, currency_code: 'USD' },
      [{ degree_level: 'Bachelor', consensus_min_gpa: 2.8, consensus_min_ielts: 6 }]
    );

    expect(truth.routes?.length).toBeGreaterThan(0);
    expect(truth.routes?.[0].available).toBeUndefined();
    expect(truth.housing?.available).toBe(true);
  });

  it('decision blocks avoid fake intake defaults', () => {
    const decisions = buildProgramDecisionData({ next_intake_date: '2026-11-15' });
    expect(decisions.deadlines?.[0].intake).toBe('2026-11-15');
  });
});

describe('i18n coverage for new readiness keys (en/ar)', () => {
  it('contains target truth and pathway alternative keys in both locales', () => {
    expect(en.readiness.target_truth_missing).toBeTruthy();
    expect(ar.readiness.target_truth_missing).toBeTruthy();
    expect(en.readiness.alternatives.pathway_available).toBeTruthy();
    expect(ar.readiness.alternatives.pathway_available).toBeTruthy();
    expect(en.truth.route_unknown).toBeTruthy();
    expect(ar.truth.route_unknown).toBeTruthy();
  });
});
