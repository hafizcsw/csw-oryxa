/**
 * Institution Portal Types
 */

export type InstitutionAccessState =
  | 'no_institution_link'
  | 'claim_draft'
  | 'claim_submitted'
  | 'under_review'
  | 'more_info_requested'
  | 'rejected'
  | 'verified'
  | 'restricted'
  | 'suspended';

export type InstitutionRole =
  | 'owner'
  | 'admin'
  | 'admissions_staff'
  | 'program_editor'
  | 'content_editor'
  | 'finance_editor'
  | 'readonly';

export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'more_info_requested'
  | 'approved'
  | 'rejected';

export type ChangeSetStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'rolled_back';

export type ApplicationStatus =
  | 'under_review'
  | 'more_docs_needed'
  | 'conditional'
  | 'accepted'
  | 'rejected'
  | 'closed';

export interface InstitutionAccessResponse {
  ok: boolean;
  access_state: InstitutionAccessState;
  institution_id?: string;
  institution_name?: string;
  role?: InstitutionRole;
  allowed_modules?: string[];
  claim_id?: string;
  error?: string;
}

export interface InstitutionClaim {
  id: string;
  institution_name: string;
  official_email: string;
  website: string;
  country: string;
  city: string;
  job_title: string;
  department: string;
  evidence_paths: string[];
  notes?: string;
  status: ClaimStatus;
  submitted_at?: string;
  reviewer_notes?: string;
  missing_items?: string[];
}

export interface InstitutionSearchResult {
  id: string;
  name: string;
  country: string;
  city: string;
  logo_url?: string;
  claimed: boolean;
}

export interface InstitutionApplication {
  id: string;
  applicant_name: string;
  program: string;
  nationality: string;
  received_date: string;
  status: ApplicationStatus;
  completeness: number;
  assigned_staff?: string;
}
