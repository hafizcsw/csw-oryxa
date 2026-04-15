/**
 * Adapter: CRM-backed StudentPortalProfile + Documents → ReadinessProfile
 * 
 * This is the ONLY place that maps CRM truth into the readiness engine's input format.
 * No localStorage. No self-reported data. CRM is the single source.
 */
import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';
import type { ReadinessProfile } from './types';

function docExists(docs: StudentDocument[], ...categories: string[]): boolean {
  return docs.some(d =>
    categories.includes(d.document_category ?? '') ||
    categories.some(c => d.file_name?.toLowerCase().includes(c))
  );
}

/**
 * Convert CRM profile + uploaded documents into a ReadinessProfile
 * that the readiness engine can evaluate against RequirementTruthContext.
 */
export function adaptCrmToReadinessProfile(
  profile: StudentPortalProfile | null,
  documents: StudentDocument[],
): ReadinessProfile {
  if (!profile) return {};

  const gpaRaw = profile.gpa ? parseFloat(profile.gpa) : undefined;

  return {
    target_country: profile.country ?? undefined,
    target_degree: profile.preferred_degree_level ?? undefined,
    budget_usd: profile.budget_usd ?? undefined,
    gpa: !isNaN(gpaRaw!) ? gpaRaw : undefined,
    gpa_scale: 4, // CRM stores on 4.0 scale

    // CRM does not currently store test scores — leave undefined.
    // When CRM adds these fields, wire them here. No localStorage fallback.
    english_test_type: undefined,
    english_test_score: undefined,
    other_test_type: undefined,
    other_test_score: undefined,

    scholarship_needed: undefined,

    // Document truth comes from actual uploaded files, not self-reported booleans
    docs_passport: docExists(documents, 'passport'),
    docs_transcript: docExists(documents, 'transcript', 'academic_transcript'),
    docs_certificate: docExists(documents, 'certificate', 'graduation_certificate', 'school_certificate'),
    docs_photo: docExists(documents, 'photo', 'personal_photo'),
    docs_recommendation: docExists(documents, 'recommendation', 'recommendation_letter'),
    docs_cv: docExists(documents, 'cv', 'resume'),
    docs_motivation_letter: docExists(documents, 'motivation_letter', 'personal_statement'),
  };
}
