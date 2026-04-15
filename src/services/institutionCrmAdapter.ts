/**
 * Institution CRM Adapter
 * 
 * Abstraction layer between admin UI and institution data source.
 * Currently reads from portal Supabase tables (institution_claims) as interim.
 * When CRM contracts are available, swap implementation here — no UI changes needed.
 * 
 * IMPORTANT: This is the ONLY place admin institution views should fetch data from.
 * No direct table reads in components.
 */
import { supabase } from '@/integrations/supabase/client';
import type { InstitutionAccessState, ClaimStatus } from '@/types/institution';

// ─── CRM Contract Types ─────────────────────────────────────────────

export interface CrmInstitutionSummary {
  id: string;
  institutionName: string;
  country: string | null;
  city: string | null;
  officialEmail: string;
  claimStatus: ClaimStatus;
  accessState: InstitutionAccessState;
  submittedAt: string | null;
  updatedAt: string;
  userId: string;
  institutionId: string | null;
  role: string | null;
  allowedModules: string[];
  reviewerNotes: string | null;
  /** Derived fields — placeholders until CRM provides them */
  pendingChangesCount: number;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  lastActivity: string | null;
}

export interface CrmInstitutionDetail extends CrmInstitutionSummary {
  website: string | null;
  department: string | null;
  jobTitle: string | null;
  evidencePaths: string[];
  notes: string | null;
  missingItems: string[];
  claimType: string;
}

export interface CrmListOptions {
  statusFilter?: string;
  query?: string;
  limit?: number;
}

// ─── Mappers (portal → CRM contract) ────────────────────────────────

function mapClaimStatusToAccessState(status: string): InstitutionAccessState {
  const map: Record<string, InstitutionAccessState> = {
    approved: 'verified',
    submitted: 'claim_submitted',
    under_review: 'under_review',
    more_info_requested: 'more_info_requested',
    rejected: 'rejected',
    draft: 'claim_draft',
  };
  return map[status] || 'no_institution_link';
}

function mapRow(row: any): CrmInstitutionSummary {
  return {
    id: row.id,
    institutionName: row.institution_name,
    country: row.country,
    city: row.city,
    officialEmail: row.official_email,
    claimStatus: row.status as ClaimStatus,
    accessState: mapClaimStatusToAccessState(row.status),
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    institutionId: row.institution_id,
    role: row.role,
    allowedModules: Array.isArray(row.allowed_modules) ? row.allowed_modules : [],
    reviewerNotes: row.reviewer_notes,
    // Derived — placeholders
    pendingChangesCount: 0,
    riskLevel: row.status === 'rejected' ? 'high' : row.status === 'more_info_requested' ? 'medium' : 'low',
    lastActivity: row.updated_at || row.submitted_at,
  };
}

function mapRowToDetail(row: any): CrmInstitutionDetail {
  return {
    ...mapRow(row),
    website: row.website,
    department: row.department,
    jobTitle: row.job_title,
    evidencePaths: Array.isArray(row.evidence_paths) ? row.evidence_paths : [],
    notes: row.notes,
    missingItems: Array.isArray(row.missing_items) ? row.missing_items : [],
    claimType: row.claim_type || 'claim',
  };
}

// ─── CRM Adapter Functions ───────────────────────────────────────────

/**
 * List institutions for the admin hub.
 * Source: institution_claims (interim — will be CRM contract)
 */
export async function listInstitutions(opts: CrmListOptions = {}): Promise<{
  data: CrmInstitutionSummary[];
  error: string | null;
}> {
  try {
    let q = supabase
      .from('institution_claims')
      .select('*')
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .limit(opts.limit || 100);

    if (opts.statusFilter && opts.statusFilter !== 'all') {
      q = q.eq('status', opts.statusFilter);
    }

    if (opts.query && opts.query.length >= 2) {
      q = q.or(`institution_name.ilike.%${opts.query}%,official_email.ilike.%${opts.query}%,country.ilike.%${opts.query}%`);
    }

    const { data, error } = await q;
    if (error) return { data: [], error: error.message };
    return { data: (data || []).map(mapRow), error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get a single institution record by claim ID or institution_id.
 * Source: institution_claims (interim — will be CRM contract)
 * Returns null if no institution record exists (NOT falling back to universities).
 */
export async function getInstitutionById(id: string): Promise<{
  data: CrmInstitutionDetail | null;
  error: string | null;
}> {
  try {
    // Try exact match on id first, then institution_id
    const { data, error } = await supabase
      .from('institution_claims')
      .select('*')
      .or(`id.eq.${id},institution_id.eq.${id}`)
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null }; // No institution record — NOT a fallback scenario
    return { data: mapRowToDetail(data), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
