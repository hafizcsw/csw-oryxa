import { describe, it, expect } from 'vitest';
import { adaptCrmToReadinessProfile } from '@/features/readiness/profileAdapter';
import { calculateReadiness } from '@/features/readiness/engine';
import { assessFileQuality } from '@/features/file-quality/engine';
import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';
import type { RequirementTruthContext } from '@/features/readiness/types';

// ─── Fixtures ───

const crmProfile: StudentPortalProfile = {
  customer_id: 'crm-001',
  full_name: 'Ahmad Test',
  email: 'ahmad@test.com',
  phone: '+971500000000',
  national_id: '123456',
  city: 'Dubai',
  country: 'AE',
  avatar_url: null,
  stage: 'applied',
  substage: null,
  progress: 50,
  docs_count: 4,
  applications_count: 1,
  shortlisted_count: 2,
  payment_total_required: 5000,
  payment_total_paid: 2500,
  shortlisted_programs: [],
  gender: 'male',
  birth_year: '2000',
  citizenship: 'AE',
  preferred_major: 'Computer Science',
  preferred_degree_level: 'bachelor',
  last_education_level: 'high_school',
  budget_usd: 15000,
  language_preference: 'en',
  gpa: '3.6',
  passport_name: 'Ahmad Test',
};

const crmDocs: StudentDocument[] = [
  { id: 'd1', file_name: 'passport.pdf', file_type: 'application/pdf', file_size: 100, file_path: '/p', storage_path: '/p', document_category: 'passport', status: 'approved', admin_notes: null, uploaded_at: '2025-01-01' },
  { id: 'd2', file_name: 'transcript.pdf', file_type: 'application/pdf', file_size: 100, file_path: '/t', storage_path: '/t', document_category: 'transcript', status: 'approved', admin_notes: null, uploaded_at: '2025-01-01' },
  { id: 'd3', file_name: 'photo.jpg', file_type: 'image/jpeg', file_size: 50, file_path: '/ph', storage_path: '/ph', document_category: 'photo', status: 'approved', admin_notes: null, uploaded_at: '2025-01-01' },
  { id: 'd4', file_name: 'certificate.pdf', file_type: 'application/pdf', file_size: 100, file_path: '/c', storage_path: '/c', document_category: 'certificate', status: 'approved', admin_notes: null, uploaded_at: '2025-01-01' },
];

const verifiedRequirements: RequirementTruthContext = {
  source_status: 'verified',
  min_gpa: 3.0,
  min_ielts: 6.0,
  required_subjects: [],
  intake_semesters: ['fall'],
};

// ─── Tests ───

describe('CRM-backed readiness input (profileAdapter)', () => {
  it('converts CRM profile + docs into ReadinessProfile without localStorage', () => {
    const rp = adaptCrmToReadinessProfile(crmProfile, crmDocs);

    expect(rp.target_country).toBe('AE');
    expect(rp.target_degree).toBe('bachelor');
    expect(rp.gpa).toBe(3.6);
    expect(rp.budget_usd).toBe(15000);
    // Docs come from uploaded files, not self-reported booleans
    expect(rp.docs_passport).toBe(true);
    expect(rp.docs_transcript).toBe(true);
    expect(rp.docs_photo).toBe(true);
    expect(rp.docs_certificate).toBe(true);
    // CRM doesn't yet store test scores
    expect(rp.english_test_type).toBeUndefined();
  });

  it('returns empty profile when CRM profile is null', () => {
    const rp = adaptCrmToReadinessProfile(null, []);
    expect(rp).toEqual({});
  });
});

describe('target-aware eligibility result', () => {
  it('produces data_unavailable when no requirements provided', () => {
    const rp = adaptCrmToReadinessProfile(crmProfile, crmDocs);
    const result = calculateReadiness(rp, undefined);

    expect(result.verdict).toBe('data_unavailable');
    expect(result.requirement_truth_sufficient).toBe(false);
  });

  it('identifies english_test gap when CRM has no test data and target requires IELTS', () => {
    const rp = adaptCrmToReadinessProfile(crmProfile, crmDocs);
    const result = calculateReadiness(rp, verifiedRequirements);

    // GPA 3.6 > 3.0 min → no GPA gap
    // No english_test_type → blocking gap
    expect(result.gaps.some(g => g.category === 'english_test')).toBe(true);
    expect(result.gaps.find(g => g.category === 'english_test')?.severity).toBe('blocking');
    // Verdict: not eligible or alternative (due to blocking gap)
    expect(['not_eligible', 'alternative_available']).toContain(result.verdict);
  });

  it('is conditionally_eligible when GPA passes and only non-blocking gaps remain', () => {
    // Simulate a profile where english test is provided (via supplementary merge)
    const rp = {
      ...adaptCrmToReadinessProfile(crmProfile, crmDocs),
      english_test_type: 'ielts',
      english_test_score: 7.0,
    };
    // Remove one doc to create a warning gap
    const docsMinusCV = crmDocs; // no CV uploaded → document_missing warning
    const result = calculateReadiness(rp, verifiedRequirements);

    // Has docs_cv = false → warning gap, but GPA and IELTS pass
    expect(result.gaps.some(g => g.category === 'document_missing')).toBe(true);
    expect(result.verdict).toBe('conditionally_eligible');
  });
});

describe('completeness vs eligibility vs fit distinction', () => {
  it('file-quality (completeness) and readiness (eligibility) produce independent signals', () => {
    const fq = assessFileQuality(crmProfile, crmDocs);
    const rp = adaptCrmToReadinessProfile(crmProfile, crmDocs);
    const readiness = calculateReadiness(rp, verifiedRequirements);

    // Completeness: profile is fairly complete (has name, gender, etc.)
    expect(fq.overall_score).toBeGreaterThan(30);
    expect(fq.verdict).not.toBe('incomplete');

    // Eligibility: blocked due to missing english test
    expect(readiness.gaps.some(g => g.category === 'english_test' && g.severity === 'blocking')).toBe(true);

    // These are DIFFERENT systems with DIFFERENT verdicts
    expect(fq.verdict).not.toBe(readiness.verdict);
  });

  it('gates reflect file-quality, not eligibility', () => {
    const fq = assessFileQuality(crmProfile, crmDocs);

    // Gates are based on file completeness, not target eligibility
    expect(typeof fq.gates.can_apply).toBe('boolean');
    expect(typeof fq.gates.can_message_university).toBe('boolean');
    // Has passport + photo + decent profile → should be able to apply
    expect(fq.gates.can_message_university).toBe(true);
  });
});

describe('gate output in student-facing surface', () => {
  it('can_apply requires passport + photo + profile completeness', () => {
    const fq = assessFileQuality(crmProfile, crmDocs);
    // Profile has name, gender, birth_year, citizenship, country → profile score >= 70
    // Docs have passport + photo + transcript + cert → doc score >= 60
    expect(fq.gates.can_apply).toBe(true);
    expect(fq.gates.apply_blocked_reasons).toHaveLength(0);
  });

  it('blocks apply when passport missing', () => {
    const docsNoPassport = crmDocs.filter(d => d.document_category !== 'passport');
    const fq = assessFileQuality(crmProfile, docsNoPassport);

    expect(fq.gates.can_apply).toBe(false);
    expect(fq.gates.apply_blocked_reasons.some(r => r.includes('passport'))).toBe(true);
  });
});
