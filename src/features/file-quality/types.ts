// ─── Student File Quality Types ───
// Canonical student qualification assessment

export type FileQualityVerdict =
  | 'apply_ready'
  | 'near_ready'
  | 'needs_work'
  | 'incomplete';

export interface DimensionScore {
  score: number; // 0–100
  label_key: string; // i18n key
  filled: number;
  total: number;
  gaps: FileQualityGap[];
}

export interface FileQualityGap {
  id: string;
  dimension: FileQualityDimension;
  severity: 'blocking' | 'improvement';
  title_key: string;
  action_key: string;
  field?: string;
}

export type FileQualityDimension =
  | 'profile'
  | 'documents'
  | 'academic'
  | 'communication'
  | 'competitive';

export interface FileQualityGates {
  can_apply: boolean;
  can_message_university: boolean;
  apply_blocked_reasons: string[]; // i18n keys
}

export interface FileQualityResult {
  verdict: FileQualityVerdict;
  overall_score: number; // 0–100

  profile_completeness: DimensionScore;
  document_completeness: DimensionScore;
  academic_eligibility: DimensionScore;
  communication_readiness: DimensionScore;
  competitive_strength: DimensionScore;

  blocking_gaps: FileQualityGap[];
  improvement_gaps: FileQualityGap[];

  gates: FileQualityGates;
}
