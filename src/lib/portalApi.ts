import { supabase } from "@/integrations/supabase/client";
import { normalizeProgramFilters } from "@/lib/normalizeProgramFilters";
import type { 
  PortalApiResponse, 
  ListFilesResponse,
  ListPaymentsResponse,
  LedgerEntry,
} from "@/types/portal";
import type { ProgramSnapshot, ShortlistSyncResponse } from "@/types/shortlist";

// ============= Base caller (lightweight - uses functions.invoke only) =============
async function callPortalApi<T = unknown>(
  action: string, 
  params?: Record<string, unknown>
): Promise<PortalApiResponse<T> & T> {
  // ✅ PORTAL-Q1: Log all API calls with timestamp for diagnostics
  const timestamp = new Date().toISOString();
  console.log('[PORTAL:API:REQUEST]', {
    timestamp,
    action,
    params_keys: params ? Object.keys(params) : [],
  });
  
  const res = await supabase.functions.invoke('student-portal-api', {
    body: { action, ...params }  // ✅ FLAT body - no nesting
  });

  if (res.error) {
    console.error(`[portalApi] ${action} error:`, res.error);
    const errorCode = (res.error as any).status === 401 ? 'auth_required' : 'network_error';
    return { ok: false, error: res.error.message, error_code: errorCode } as PortalApiResponse<T> & T;
  }

  // ✅ PORTAL-Q1: Log response for diagnostics
  console.log('[PORTAL:API:RESPONSE]', {
    timestamp: new Date().toISOString(),
    action,
    ok: res.data?.ok,
    data_keys: res.data ? Object.keys(res.data) : [],
  });

  return res.data as PortalApiResponse<T> & T;
}

// ============= Wallet =============
interface WalletLedgerResult {
  ok: boolean;
  available: number;
  pending: number;
  entries: LedgerEntry[];
  total?: number;
  error?: string;
  error_code?: string;
}

export const listWalletLedger = (options?: { 
  currency?: string; 
  limit?: number; 
  offset?: number 
}): Promise<WalletLedgerResult> => callPortalApi<WalletLedgerResult>('list_wallet_ledger', options);

// ============= Payments =============
export const listPayments = () => callPortalApi<ListPaymentsResponse>('get_payments');

// ============= Files =============
// ⚠️ TEMPORARY: Clear all user files from storage
export const clearMyFiles = () => 
  callPortalApi<{ deleted_count: number; deleted: string[]; errors?: string[] }>('clear_my_files');
export const listFiles = () => callPortalApi<ListFilesResponse>('list_files');

export const signFile = (storage_bucket: string, storage_path: string) => 
  callPortalApi<{ signed_url: string }>('sign_file', { storage_bucket, storage_path });

// Register file in CRM (used for avatar sync)
export interface AddFileParams {
  file_kind: string;
  file_url: string;
  file_name: string;
  storage_bucket?: string;
  storage_path?: string;
  mime_type?: string;
  size_bytes?: number;
  description?: string;
}

export const addFile = (params: AddFileParams) => 
  callPortalApi<{ ok: boolean; file_id?: string }>('add_file', { ...params });

// ============= Profile =============
export const getProfile = () => callPortalApi('get_profile');

export const updateProfile = (payload: Record<string, unknown>) => 
  callPortalApi('update_profile', { payload });

// ============= Shortlist =============
interface ShortlistResponse {
  ok: boolean;
  data?: { shortlisted_programs: any[] };
  error?: string;
  error_code?: string;
}

export const getShortlist = () => 
  callPortalApi<ShortlistResponse>('get_shortlist');

// ============= #7.2 Shortlist API (Portal DB - limit=10) =============
// NOTE: Old shortlistAdd/shortlistRemove functions have been removed.
// Use shortlistAddNew/shortlistRemoveNew (now renamed) which use the new RPC-based API with 10-item limit.

// Legacy types kept for backward compatibility with useUnifiedShortlist
interface ShortlistDeltaResponse {
  ok: boolean;
  request_id?: string;
  rpc_ok?: boolean;
  rpc_error?: string;
  error_code?: string;
  message?: string;
  data?: unknown;
  ms?: number;
  added?: boolean;
  removed?: boolean;
  count?: number;
  limit?: number;
  limit_reached?: boolean;
}

export interface ShortlistItem {
  program_id: string;
  created_at: string;
}

export interface ShortlistListResponse {
  ok: boolean;
  count: number;
  limit: number;
  items: ShortlistItem[];
  error_code?: string;
}

export interface ShortlistAddResponse {
  ok: boolean;
  added?: boolean;
  already_exists?: boolean;
  count: number;
  limit: number;
  limit_reached: boolean;
  error_code?: string;  // 'shortlist_limit_reached' when blocked
  items?: ShortlistItem[];  // Present when limit_reached
}

export interface ShortlistRemoveResponse {
  ok: boolean;
  removed?: boolean;
  count: number;
  limit: number;
  limit_reached: boolean;
  error_code?: string;
}

export interface ShortlistCompareItem {
  program_id: string;
  program_name_ar?: string;
  program_name_en?: string;
  country_code?: string;
  university_name_ar?: string;
  university_name_en?: string;
  tuition_usd_year_max?: number;
  duration_months?: number;
  instruction_languages?: string[];
  has_dorm?: boolean;
  scholarship_available?: boolean;
  discipline_slug?: string;
  degree_slug?: string;
  ranking?: number;
  monthly_living_usd?: number;
}

export interface ShortlistCompareResponse {
  ok: boolean;
  count: number;
  items: ShortlistCompareItem[];
  error_code?: string;
}

/**
 * List user's shortlist (RPC-based, max 10 items)
 */
export const shortlistList = async (): Promise<ShortlistListResponse> => {
  // ✅ FIX A (hard): never call backend as guest
  const { data: { session } } = await supabase.auth.getSession();
  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : null;
  const expired = !!(expiresAtMs && expiresAtMs <= Date.now());

  if (!session?.access_token || expired) {
    return { ok: true, count: 0, limit: 10, items: [] };
  }

  return callPortalApi<ShortlistListResponse>('shortlist_list');
};

/**
 * Add program to shortlist (RPC-based, limit enforced)
 * Returns limit_reached=true + items when at limit
 * 
 * ✅ UNIFIED: This is the ONLY add function - supports both new UI and legacy hooks
 */
export const shortlistAdd = (
  program_id: string,
  program_snapshot?: Record<string, unknown>,
  source = 'portal'
): Promise<ShortlistAddResponse & ShortlistDeltaResponse> =>
  callPortalApi<ShortlistAddResponse & ShortlistDeltaResponse>('shortlist_add', { 
    program_id, 
    program_snapshot,
    source 
  });

// Alias for new code - same function
export const shortlistAddNew = shortlistAdd;

/**
 * Remove program from shortlist (RPC-based)
 * 
 * ✅ UNIFIED: This is the ONLY remove function - supports both new UI and legacy hooks
 */
export const shortlistRemove = (
  program_id: string,
  source = 'portal'
): Promise<ShortlistRemoveResponse & ShortlistDeltaResponse> =>
  callPortalApi<ShortlistRemoveResponse & ShortlistDeltaResponse>('shortlist_remove', { 
    program_id,
    source 
  });

// Alias for new code - same function
export const shortlistRemoveNew = shortlistRemove;

/**
 * Get program data for comparison UI (authenticated - from shortlist)
 */
export const shortlistCompare = (): Promise<ShortlistCompareResponse> =>
  callPortalApi<ShortlistCompareResponse>('shortlist_compare');

// ============= Compare Programs V1 (PUBLIC - works for guests) =============
export type CompareAudience = 'customer' | 'staff';

export interface CompareProgramV1Query {
  program_ids: string[];
  locale?: string;
  audience?: CompareAudience;
}

export interface CompareRequestPayload {
  event: 'compare_request_v1';
  message: string;
  metadata: {
    program_ids: string[];
    compare_version: 'v1';
    lens: 'balanced';
    locale: string;
    source: 'portal_compare_ui';
    audience: CompareAudience;
  };
}

const PENDING_COMPARE_REQUEST_KEY = '__portalPendingCompareRequest';

type CompareRequestWindow = Window & typeof globalThis & {
  [PENDING_COMPARE_REQUEST_KEY]?: CompareRequestPayload;
};

export interface CompareProgramV1Item {
  program_id: string;
  program_name: string;
  program_name_ar?: string;
  program_name_en?: string;
  university_id: string;
  university_name: string;
  university_name_ar?: string;
  university_name_en?: string;
  university_logo?: string;
  country_code: string;
  country_name: string;
  city?: string;
  degree_slug: string;
  degree_name?: string;
  discipline_slug?: string;
  discipline_name?: string;
  study_mode?: string;
  instruction_languages?: string[];
  tuition_usd_year_min?: number;
  tuition_usd_year_max?: number;
  tuition_is_free?: boolean;
  currency_code?: string;
  duration_months?: number;
  has_dorm?: boolean;
  dorm_price_monthly_usd?: number;
  monthly_living_usd?: number;
  scholarship_available?: boolean;
  scholarship_type?: string;
  intake_months?: number[];
  deadline_date?: string;
  ranking?: number;
  portal_url?: string;
}

export interface CompareProgramsV1Response {
  ok: boolean;
  version: 'compare_v1';
  locale: string;
  audience: string;
  programs: CompareProgramV1Item[];
  missing_fields: Record<string, string[]>;
  not_found_ids: string[];
  request_id: string;
  error_code?: string;
  error?: string;
}

/**
 * Compare programs by IDs - Facts API (PUBLIC - works for guests)
 * Returns deterministic program data without AI recommendations
 * 
 * @param query.program_ids - Array of 2-10 program UUIDs
 * @param query.locale - Locale code for localized names (default: server-side)
 * @param query.audience - 'customer' or 'staff' (default: 'customer')
 */
export const compareProgramsV1 = (query: CompareProgramV1Query): Promise<CompareProgramsV1Response> =>
  callPortalApi<CompareProgramsV1Response>('compare_programs_v1', { 
    program_ids: query.program_ids,
    locale: query.locale,
    audience: query.audience
  });

export const buildCompareRequestPayload = ({
  programIds,
  locale,
  message,
  audience = 'customer',
}: {
  programIds: string[];
  locale: string;
  message: string;
  audience?: CompareAudience;
}): CompareRequestPayload => ({
  event: 'compare_request_v1',
  message,
  metadata: {
    program_ids: programIds,
    compare_version: 'v1',
    lens: 'balanced',
    locale,
    source: 'portal_compare_ui',
    audience,
  },
});

export const queueCompareRequestPayload = (payload: CompareRequestPayload) => {
  if (typeof window === 'undefined') return;
  const compareWindow = window as CompareRequestWindow;
  compareWindow[PENDING_COMPARE_REQUEST_KEY] = payload;
  window.dispatchEvent(new CustomEvent('compare-request-ready', { detail: payload }));
};

export const consumeQueuedCompareRequestPayload = (): CompareRequestPayload | null => {
  if (typeof window === 'undefined') return null;
  const compareWindow = window as CompareRequestWindow;
  const payload = compareWindow[PENDING_COMPARE_REQUEST_KEY] ?? null;
  delete compareWindow[PENDING_COMPARE_REQUEST_KEY];
  return payload;
};

/**
 * Sync shortlist with snapshots (V3 - Portal KB Source of Truth)
 * @param items - Array of ProgramSnapshot with full program details from UI
 * @param source - Source identifier for tracking
 * @param allowClear - If true, allow clearing all items from CRM (explicit user action)
 */
/**
 * ✅ LOCK-2 FIX: Sync shortlist with explicit Authorization header
 */
export const syncShortlistWithSnapshots = async (
  items: ProgramSnapshot[], 
  source = 'portal_web_shortlist',
  allowClear = false
): Promise<ShortlistSyncResponse> => {
  // ✅ LOCK-2: Get session and verify before calling
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    console.warn('[syncShortlist] ❌ No session, returning auth_required');
    return { ok: false, error_code: 'auth_required' } as ShortlistSyncResponse;
  }

  const requestId = `shortlist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  console.log('[syncShortlist] 📤 V3 Request (LOCK-2):', {
    request_id: requestId,
    count: items.length,
    source,
    allow_clear: allowClear,
    has_auth: !!session.access_token,
    items_preview: items.slice(0, 3).map(i => ({
      id: i.program_ref_id?.slice(0, 8),
      name: i.snapshot?.program_name_en || i.snapshot?.program_name_ar,
      uni: i.snapshot?.university_name_en || i.snapshot?.university_name_ar,
    })),
  });
  
  // ✅ LOCK-2: Explicitly pass Authorization header
  const { data, error } = await supabase.functions.invoke('student-portal-api', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {
      action: 'sync_shortlist',
      items,
      source,
      request_id: requestId,
      allow_clear: allowClear,
    },
  });
  
  if (error) {
    console.error('[syncShortlist] ❌ Error:', error);
    return { ok: false, error: error.message, error_code: 'invoke_error' } as ShortlistSyncResponse;
  }
  
  // ✅ P0 Debug: Log response
  console.log('[syncShortlist] 📥 V3 Response:', {
    ok: data?.ok,
    synced_to_crm: data?.synced_to_crm,
    stored_count: data?.stored_count,
    rejected: data?.rejected_items?.length || 0,
    error: data?.error,
  });
  
  return data as ShortlistSyncResponse;
};

/**
 * Clear all shortlist from CRM + Portal (P0 Fix)
 */
export const clearShortlist = async (): Promise<{ ok: boolean; request_id: string; portal_cleared: boolean; crm_cleared: boolean; crm_error?: string }> => {
  const request_id = `clear_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log('[clearShortlist] 🗑️ Clearing all shortlist...', { request_id });
  
  const result = await callPortalApi<{ ok: boolean; request_id: string; portal_cleared: boolean; crm_cleared: boolean; crm_error?: string }>('clear_shortlist', { request_id });
  
  console.log('[clearShortlist] 📥 Response:', result);
  
  return result;
};

/**
 * @deprecated ❌ P0-LOCK-4: V1 sync is BLOCKED
 * Use syncShortlistWithSnapshots instead
 */
export const syncShortlist = (_program_ids: string[], _source = 'portal_web_shortlist') => {
  console.error('[syncShortlist] ❌ V1 BLOCKED - Use syncShortlistWithSnapshots instead');
  // ✅ P0-LOCK-4: Return error instead of making V1 call
  return Promise.resolve({ ok: false, error_code: 'v1_blocked_use_v3' });
};

// ============= Programs Search (V2 Contract) =============
export interface SearchProgramsFilters {
  // Text search
  keyword?: string;
  
  // 16 Canonical filters (V2)
  country_code?: string;
  city?: string;
  degree_slug?: string;
  discipline_slug?: string;
  study_mode?: string;
  instruction_languages?: string[];
  tuition_usd_min?: number;
  tuition_usd_max?: number;
  duration_months_max?: number;
  has_dorm?: boolean;
  dorm_price_monthly_usd_max?: number;
  monthly_living_usd_max?: number;
  scholarship_available?: boolean;
  scholarship_type?: string;
  intake_months?: number[];
  deadline_before?: string;
  
  // Pagination
  limit?: number;
  offset?: number;
}

interface SearchProgramsResponse {
  ok: boolean;
  items: any[];
  total?: number | null;
  has_next?: boolean;
  next_offset?: number;
  error?: string;
  error_code?: string;
}

export const searchPrograms = (filters: Record<string, any>) => {
  const normalized = normalizeProgramFilters(filters);
  return callPortalApi<SearchProgramsResponse>('search_programs', normalized as Record<string, unknown>);
};

// ============= Programs Search v2 (Order #7) =============
export interface SearchProgramsFiltersV2 {
  keyword?: string;
  country_slug?: string;
  degree_slug?: string;
  subject_slug?: string;
  language?: string[];  // Array for multiple languages
  tuition_min?: number;
  tuition_max?: number;
  limit?: number;       // Max 50
  offset?: number;
  sort_by?: 'ranking' | 'tuition_asc' | 'tuition_desc' | 'name';
}

interface SearchProgramsResponseV2 {
  ok: boolean;
  items: unknown[];
  total?: number | null;
  has_next?: boolean;
  next_offset?: number;
  error?: string;
  error_code?: string;
  version: 'v2';
}

// 🆕 Fix #6: Feature flag for v2
const USE_SEARCH_V2 = import.meta.env.VITE_PROGRAM_SEARCH_V2 === 'true';

export const searchProgramsV2 = (filters: SearchProgramsFiltersV2) => {
  // Enforce limit max 50
  const sanitizedFilters = {
    ...filters,
    limit: Math.min(filters.limit || 20, 50),
    version: 'v2'
  };
  return callPortalApi<SearchProgramsResponseV2>('search_programs', sanitizedFilters as Record<string, unknown>);
};

// Export flag for UI usage
export const isSearchV2Enabled = () => USE_SEARCH_V2;
