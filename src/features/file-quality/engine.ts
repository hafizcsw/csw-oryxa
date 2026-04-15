// ─── Student File Quality Engine ───
// Pure function: profile + documents → FileQualityResult

import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';
import type {
  FileQualityResult,
  FileQualityVerdict,
  FileQualityGap,
  FileQualityGates,
  DimensionScore,
  FileQualityDimension,
} from './types';

// ─── Helpers ───

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '';
}

function gap(
  dimension: FileQualityDimension,
  severity: 'blocking' | 'improvement',
  field: string,
): FileQualityGap {
  return {
    id: `${dimension}_${field}`,
    dimension,
    severity,
    title_key: `file_quality.gaps.${dimension}.${field}.title`,
    action_key: `file_quality.gaps.${dimension}.${field}.action`,
    field,
  };
}

function docExists(docs: StudentDocument[], ...categories: string[]): boolean {
  return docs.some(d =>
    categories.includes(d.document_category ?? '') ||
    categories.some(c => d.file_type?.includes(c) || d.file_name?.toLowerCase().includes(c))
  );
}

function buildDimension(
  dimension: FileQualityDimension,
  checks: Array<{ field: string; filled: boolean; severity: 'blocking' | 'improvement' }>,
): DimensionScore {
  const total = checks.length;
  const filledCount = checks.filter(c => c.filled).length;
  const score = total > 0 ? Math.round((filledCount / total) * 100) : 0;
  const gaps: FileQualityGap[] = checks
    .filter(c => !c.filled)
    .map(c => gap(dimension, c.severity, c.field));

  return {
    score,
    label_key: `file_quality.dimensions.${dimension}`,
    filled: filledCount,
    total,
    gaps,
  };
}

// ─── Main Engine ───

export function assessFileQuality(
  profile: StudentPortalProfile | null,
  documents: StudentDocument[],
): FileQualityResult {
  if (!profile) {
    return emptyResult();
  }

  // 1. Profile completeness (25% weight)
  const profileDim = buildDimension('profile', [
    { field: 'full_name', filled: hasValue(profile.full_name), severity: 'blocking' },
    { field: 'gender', filled: hasValue(profile.gender), severity: 'blocking' },
    { field: 'birth_year', filled: hasValue(profile.birth_year) || hasValue(profile.dob), severity: 'blocking' },
    { field: 'citizenship', filled: hasValue(profile.citizenship), severity: 'blocking' },
    { field: 'country', filled: hasValue(profile.country), severity: 'blocking' },
    { field: 'preferred_major', filled: hasValue(profile.preferred_major), severity: 'improvement' },
    { field: 'preferred_degree_level', filled: hasValue(profile.preferred_degree_level), severity: 'improvement' },
    { field: 'budget_usd', filled: hasValue(profile.budget_usd), severity: 'improvement' },
    { field: 'language_preference', filled: hasValue(profile.language_preference), severity: 'improvement' },
    { field: 'passport_name', filled: hasValue(profile.passport_name), severity: 'improvement' },
  ]);

  // 2. Document completeness (25%)
  const hasPassport = docExists(documents, 'passport');
  const hasPhoto = docExists(documents, 'photo', 'personal_photo');
  const hasTranscript = docExists(documents, 'transcript', 'academic_transcript');
  const hasCertificate = docExists(documents, 'certificate', 'graduation_certificate', 'school_certificate');

  const docDim = buildDimension('documents', [
    { field: 'passport', filled: hasPassport, severity: 'blocking' },
    { field: 'photo', filled: hasPhoto, severity: 'blocking' },
    { field: 'transcript', filled: hasTranscript, severity: 'blocking' },
    { field: 'certificate', filled: hasCertificate, severity: 'improvement' },
  ]);

  // 3. Academic eligibility (20%)
  const academicDim = buildDimension('academic', [
    { field: 'gpa', filled: hasValue(profile.gpa), severity: 'improvement' },
    { field: 'degree_level', filled: hasValue(profile.preferred_degree_level), severity: 'improvement' },
    { field: 'last_education', filled: hasValue(profile.last_education_level), severity: 'improvement' },
  ]);

  // 4. Communication readiness (15%)
  const commDim = buildDimension('communication', [
    { field: 'phone', filled: hasValue(profile.phone), severity: 'blocking' },
    { field: 'email', filled: hasValue(profile.email), severity: 'blocking' },
    { field: 'language_preference', filled: hasValue(profile.language_preference), severity: 'improvement' },
  ]);

  // 5. Competitive strength (15%)
  const hasRecommendation = docExists(documents, 'recommendation', 'recommendation_letter');
  const hasCV = docExists(documents, 'cv', 'resume');
  const hasMotivation = docExists(documents, 'motivation_letter', 'personal_statement');

  const competitiveDim = buildDimension('competitive', [
    { field: 'recommendation', filled: hasRecommendation, severity: 'improvement' },
    { field: 'cv', filled: hasCV, severity: 'improvement' },
    { field: 'motivation_letter', filled: hasMotivation, severity: 'improvement' },
  ]);

  // Weighted overall
  const overall = Math.round(
    profileDim.score * 0.25 +
    docDim.score * 0.25 +
    academicDim.score * 0.20 +
    commDim.score * 0.15 +
    competitiveDim.score * 0.15
  );

  // Collect gaps
  const allGaps = [
    ...profileDim.gaps,
    ...docDim.gaps,
    ...academicDim.gaps,
    ...commDim.gaps,
    ...competitiveDim.gaps,
  ];
  const blockingGaps = allGaps.filter(g => g.severity === 'blocking');
  const improvementGaps = allGaps.filter(g => g.severity === 'improvement');

  // Gates
  const gates = computeGates(profileDim, docDim, hasPassport, hasPhoto, profile);

  // Verdict
  const verdict = computeVerdict(overall, blockingGaps);

  return {
    verdict,
    overall_score: overall,
    profile_completeness: profileDim,
    document_completeness: docDim,
    academic_eligibility: academicDim,
    communication_readiness: commDim,
    competitive_strength: competitiveDim,
    blocking_gaps: blockingGaps,
    improvement_gaps: improvementGaps,
    gates,
  };
}

function computeVerdict(overall: number, blockingGaps: FileQualityGap[]): FileQualityVerdict {
  if (overall >= 80 && blockingGaps.length === 0) return 'apply_ready';
  if (overall >= 60 && blockingGaps.length <= 2) return 'near_ready';
  if (overall >= 30) return 'needs_work';
  return 'incomplete';
}

function computeGates(
  profileDim: DimensionScore,
  docDim: DimensionScore,
  hasPassport: boolean,
  hasPhoto: boolean,
  profile: StudentPortalProfile,
): FileQualityGates {
  const reasons: string[] = [];

  if (profileDim.score < 70) reasons.push('file_quality.gate_reasons.profile_incomplete');
  if (docDim.score < 60) reasons.push('file_quality.gate_reasons.documents_incomplete');
  if (!hasPassport) reasons.push('file_quality.gate_reasons.passport_missing');
  if (!hasPhoto) reasons.push('file_quality.gate_reasons.photo_missing');

  const can_apply = profileDim.score >= 70 && docDim.score >= 60 && hasPassport && hasPhoto;
  const can_message_university = profileDim.score >= 40 && hasValue(profile.email);

  return { can_apply, can_message_university, apply_blocked_reasons: reasons };
}

function emptyResult(): FileQualityResult {
  const emptyDim: DimensionScore = { score: 0, label_key: '', filled: 0, total: 0, gaps: [] };
  return {
    verdict: 'incomplete',
    overall_score: 0,
    profile_completeness: { ...emptyDim, label_key: 'file_quality.dimensions.profile' },
    document_completeness: { ...emptyDim, label_key: 'file_quality.dimensions.documents' },
    academic_eligibility: { ...emptyDim, label_key: 'file_quality.dimensions.academic' },
    communication_readiness: { ...emptyDim, label_key: 'file_quality.dimensions.communication' },
    competitive_strength: { ...emptyDim, label_key: 'file_quality.dimensions.competitive' },
    blocking_gaps: [],
    improvement_gaps: [],
    gates: { can_apply: false, can_message_university: false, apply_blocked_reasons: ['file_quality.gate_reasons.no_profile'] },
  };
}
