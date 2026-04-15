import { describe, it, expect } from 'vitest';
import { assessFileQuality } from '@/features/file-quality/engine';
import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';

function makeProfile(overrides: Partial<StudentPortalProfile> = {}): StudentPortalProfile {
  return {
    customer_id: 'test-1',
    full_name: 'Test User',
    email: 'test@example.com',
    phone: '+1234567890',
    national_id: null,
    city: null,
    country: 'Turkey',
    avatar_url: null,
    stage: null,
    substage: null,
    progress: null,
    docs_count: 0,
    applications_count: 0,
    shortlisted_count: 0,
    payment_total_required: 0,
    payment_total_paid: 0,
    shortlisted_programs: [],
    gender: 'male',
    birth_year: '2000',
    citizenship: 'TR',
    preferred_major: 'Engineering',
    preferred_degree_level: 'bachelor',
    budget_usd: 10000,
    language_preference: 'en',
    passport_name: 'Test User',
    gpa: '3.5',
    last_education_level: 'high_school',
    ...overrides,
  };
}

function makeDoc(category: string, id = category): StudentDocument {
  return {
    id,
    file_name: `${category}.pdf`,
    file_type: 'application/pdf',
    file_size: 1024,
    file_path: `/files/${category}.pdf`,
    storage_path: `files/${category}.pdf`,
    document_category: category,
    status: 'pending',
    admin_notes: null,
    uploaded_at: new Date().toISOString(),
  };
}

describe('assessFileQuality', () => {
  it('returns incomplete for null profile', () => {
    const result = assessFileQuality(null, []);
    expect(result.verdict).toBe('incomplete');
    expect(result.overall_score).toBe(0);
    expect(result.gates.can_apply).toBe(false);
  });

  it('returns apply_ready for complete profile + docs', () => {
    const docs = [
      makeDoc('passport'),
      makeDoc('photo'),
      makeDoc('transcript'),
      makeDoc('certificate'),
      makeDoc('recommendation'),
      makeDoc('cv'),
      makeDoc('motivation_letter'),
    ];
    const result = assessFileQuality(makeProfile(), docs);
    expect(result.verdict).toBe('apply_ready');
    expect(result.overall_score).toBeGreaterThanOrEqual(80);
    expect(result.gates.can_apply).toBe(true);
    expect(result.gates.can_message_university).toBe(true);
    expect(result.blocking_gaps).toHaveLength(0);
  });

  it('returns needs_work for partial profile no docs', () => {
    const result = assessFileQuality(makeProfile({
      gender: null,
      birth_year: null,
      citizenship: null,
      country: null,
    }), []);
    expect(result.verdict).toBe('needs_work');
    expect(result.gates.can_apply).toBe(false);
    expect(result.blocking_gaps.length).toBeGreaterThan(0);
  });

  it('gate: can_message_university when email + basic profile', () => {
    const result = assessFileQuality(makeProfile(), []);
    expect(result.gates.can_message_university).toBe(true);
  });

  it('gate: cannot apply without passport', () => {
    const docs = [makeDoc('photo'), makeDoc('transcript'), makeDoc('certificate')];
    const result = assessFileQuality(makeProfile(), docs);
    expect(result.gates.can_apply).toBe(false);
    expect(result.gates.apply_blocked_reasons).toContain('file_quality.gate_reasons.passport_missing');
  });

  it('dimensions have correct structure', () => {
    const result = assessFileQuality(makeProfile(), []);
    expect(result.profile_completeness.label_key).toBe('file_quality.dimensions.profile');
    expect(result.document_completeness.total).toBe(4);
    expect(result.academic_eligibility.total).toBe(3);
    expect(result.communication_readiness.total).toBe(3);
    expect(result.competitive_strength.total).toBe(3);
  });

  it('improvement gaps are non-blocking', () => {
    const result = assessFileQuality(makeProfile({ preferred_major: null }), []);
    const majorGap = result.improvement_gaps.find(g => g.field === 'preferred_major');
    expect(majorGap).toBeDefined();
    expect(majorGap?.severity).toBe('improvement');
  });
});
