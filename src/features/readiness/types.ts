// ─── Admissions Readiness Types ───
// Single source of truth for all readiness-related types

/** Student's admissions-relevant profile */
export interface ReadinessProfile {
  target_country?: string;
  target_degree?: string; // bachelor | master | phd | foundation | diploma
  budget_usd?: number;
  intake_year?: number;
  intake_semester?: string; // fall | spring | summer
  current_qualification?: string; // high_school | bachelor | master | diploma
  curriculum?: string; // american | british | ib | national | other
  gpa?: number;
  gpa_scale?: number; // 4.0 | 5.0 | 100
  subjects_completed?: string[];
  language_of_study?: string;
  english_test_type?: string; // ielts | toefl | duolingo | pte | none
  english_test_score?: number;
  other_test_type?: string; // sat | act | gre | gmat | none
  other_test_score?: number;
  scholarship_needed?: boolean;
  docs_passport?: boolean;
  docs_transcript?: boolean;
  docs_certificate?: boolean;
  docs_photo?: boolean;
  docs_recommendation?: boolean;
  docs_cv?: boolean;
  docs_motivation_letter?: boolean;
}

export type RequirementTruthStatus = 'verified' | 'partial' | 'unverified';

export interface RequirementTruthContext {
  source_status: RequirementTruthStatus;
  min_gpa?: number;
  min_ielts?: number;
  min_toefl?: number;
  required_subjects?: string[];
  has_foundation?: boolean;
  has_pathway?: boolean;
  direct_route_available?: boolean;
  deadline?: string;
  intake_semesters?: string[];
  verified_alternative_programs?: Array<{
    program_title: string;
    program_slug?: string;
    university_name?: string;
    university_slug?: string;
  }>;
  verified_alternative_universities?: Array<{
    university_name: string;
    university_slug?: string;
  }>;
}

/** Readiness verdict per program/university */
export type ReadinessVerdict =
  | 'eligible_now'
  | 'conditionally_eligible'
  | 'not_eligible'
  | 'alternative_available'
  | 'data_unavailable';

/** Gap categories */
export type GapCategory =
  | 'english_test'
  | 'academic_test'
  | 'gpa_below_threshold'
  | 'prerequisite_subject'
  | 'foundation_required'
  | 'document_missing'
  | 'deadline_missed'
  | 'intake_mismatch'
  | 'budget_mismatch'
  | 'qualification_mismatch';

/** A single gap card */
export interface GapCard {
  id: string;
  category: GapCategory;
  title_key: string; // locale key
  description_key: string; // locale key
  severity: 'blocking' | 'warning' | 'info';
  recommended_action_key: string; // locale key
  estimated_time_weeks?: number;
  estimated_cost_band?: 'free' | 'low' | 'medium' | 'high';
  route_type?: RouteType;
  service_link?: ServiceLink;
  current_value?: string | number;
  required_value?: string | number;
}

/** Route types for eligibility plans */
export type RouteType =
  | 'test_prep'
  | 'foundation'
  | 'pathway'
  | 'preparatory'
  | 'alternative_university'
  | 'alternative_program'
  | 'document_completion'
  | 'direct';

/** Eligibility plan step */
export interface EligibilityStep {
  order: number;
  gap_id: string;
  action_key: string; // locale key
  estimated_time_weeks?: number;
  estimated_cost_band?: 'free' | 'low' | 'medium' | 'high';
  route_type: RouteType;
  service_link?: ServiceLink;
}

/** Full eligibility plan */
export interface EligibilityPlan {
  steps: EligibilityStep[];
  total_estimated_weeks?: number;
  route_label_key: string; // locale key: fastest / cheapest / best_fit
}

/** Link from gap to service */
export interface ServiceLink {
  service_id: string;
  service_type: PrepServiceType;
  label_key: string; // locale key
  url?: string;
}

/** Prep service types */
export type PrepServiceType =
  | 'ielts_prep'
  | 'toefl_prep'
  | 'duolingo_prep'
  | 'pte_prep'
  | 'sat_prep'
  | 'act_prep'
  | 'gre_prep'
  | 'gmat_prep'
  | 'foundation_support'
  | 'pathway_support'
  | 'subject_remediation'
  | 'document_readiness';

/** Alternative route suggestion */
export interface AlternativeRoute {
  type: 'same_university_pathway' | 'alternative_program' | 'alternative_university';
  university_name?: string;
  university_slug?: string;
  program_title?: string;
  program_slug?: string;
  reason_key: string; // locale key
  entry_barrier_key: string; // locale key: lower | similar | foundation_available
}

/** Document checklist item */
export type DocumentStatus =
  | 'required'
  | 'uploaded'
  | 'missing'
  | 'needs_translation'
  | 'needs_notarization'
  | 'expired';

export interface DocumentChecklistItem {
  id: string;
  doc_type: string;
  label_key: string; // locale key
  status: DocumentStatus;
  file_path?: string;
  notes_key?: string; // locale key for status-specific notes
}

/** Full readiness result for a target */
export interface ReadinessResult {
  target_university_slug?: string;
  target_program_slug?: string;
  verdict: ReadinessVerdict;
  gaps: GapCard[];
  plans: {
    fastest?: EligibilityPlan;
    cheapest?: EligibilityPlan;
    best_fit?: EligibilityPlan;
  };
  alternatives: AlternativeRoute[];
  document_checklist: DocumentChecklistItem[];
  requirement_source_status: RequirementTruthStatus;
  requirement_truth_sufficient: boolean;
  alternative_routes_checked: boolean;
  alternative_routes_unavailable_reason_key?: string;
}

/** University dashboard pipeline segment */
export interface PipelineSegment {
  segment: 'ready_now' | 'conditionally_eligible' | 'trainable' | 'blocked';
  count: number;
  label_key: string;
  applicants?: Array<{
    user_id: string;
    name?: string;
    missing_items: string[];
  }>;
}

/** Common missing requirements aggregation */
export interface MissingRequirementSummary {
  requirement_key: string; // locale key
  category: GapCategory;
  count: number;
  percentage: number;
}

/** Prep service card data */
export interface PrepServiceCard {
  id: string;
  type: PrepServiceType;
  title_key: string;
  description_key: string;
  icon: string; // lucide icon name
  features_keys: string[]; // locale keys for feature list
  cta_key: string;
  available: boolean;
  coming_soon?: boolean;
  linked_gap_categories: GapCategory[];
}
