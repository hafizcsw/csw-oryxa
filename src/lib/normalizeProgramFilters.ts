/**
 * ============= Website Filter Contract v2 (UNIFIED) =============
 * This normalizer now outputs V2 canonical keys to match the CRM/Chat contract.
 * 
 * ✅ 16 Canonical Filters (User-controlled):
 * - country_code, city, degree_slug, discipline_slug, study_mode
 * - instruction_languages[], tuition_usd_min, tuition_usd_max
 * - duration_months_max, has_dorm, dorm_price_monthly_usd_max
 * - monthly_living_usd_max, scholarship_available, scholarship_type
 * - intake_months[], deadline_before
 * 
 * ✅ Special: keyword (text search - supported but not in the 16)
 * 
 * 🔒 4 Locked Keys (System-only - NEVER from user input):
 * - is_active, partner_priority, do_not_offer, tuition_basis
 */

import {
  canonicalizeCountryCode,
  canonicalizeDegreeSlugOrId,
  canonicalizeDisciplineSlug,
  canonicalizeInstructionLanguages,
} from "@/lib/programFilters/canonicalize";

export type NormalizedProgramFilters = {
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
  limit: number;
  offset: number;
};

// ============= V2 Contract Allowlist =============
const ALLOWED_KEYS = new Set([
  // Keyword/text search aliases → keyword
  'keyword', 'q', 'query', 'subject',
  
  // Country aliases → country_code
  'country_code', 'country_slug', 'country',
  
  // City (direct)
  'city',
  
  // Degree aliases → degree_slug
  'degree_slug', 'degree_level', 'degree_id', 'degree',
  
  // Discipline aliases → discipline_slug
  'discipline_slug', 'discipline_id', 'discipline',
  
  // Study mode (direct)
  'study_mode',
  
  // Language aliases → instruction_languages
  'instruction_languages', 'language',
  
  // Tuition aliases → tuition_usd_min/max
  'tuition_usd_min', 'tuition_usd_max', 'max_tuition', 'fees_max', 'tuition_max_year_usd',
  
  // Duration
  'duration_months_max',
  
  // Dorm
  'has_dorm', 'dorm_price_monthly_usd_max',
  
  // Living costs
  'monthly_living_usd_max',
  
  // Scholarship
  'scholarship_available', 'scholarship_type',
  
  // Intake/deadline
  'intake_months', 'deadline_before',
  
  // Pagination
  'limit', 'offset', 'page', 'page_size',
]);

// 🔒 LOCKED KEYS - System-only, NEVER from user input
const LOCKED_KEYS = new Set([
  'is_active',
  'partner_priority', 
  'do_not_offer',
  'tuition_basis',
]);

// Keys explicitly blocked from user input (closed filters)
const BLOCKED_KEYS = new Set([
  'sort', 'sort_by', // Sorting handled separately
]);

/**
 * Normalizes filter names from any source to the V2 API contract.
 * GUARDRAIL: Strips locked keys + logs unknown keys.
 */
export function normalizeProgramFilters(input: Record<string, any>): NormalizedProgramFilters {
  const lockedKeysFound: string[] = [];
  const unknownKeysFound: string[] = [];
  
  Object.keys(input).forEach(key => {
    if (LOCKED_KEYS.has(key)) {
      lockedKeysFound.push(key);
    } else if (BLOCKED_KEYS.has(key)) {
      // Silently ignore blocked keys
    } else if (!ALLOWED_KEYS.has(key) && input[key] !== undefined && input[key] !== null && input[key] !== '') {
      unknownKeysFound.push(key);
    }
  });
  
  if (lockedKeysFound.length > 0) {
    console.error('[normalizeProgramFilters] 🔒 LOCKED keys rejected (security):', lockedKeysFound);
  }
  if (unknownKeysFound.length > 0) {
    console.warn('[normalizeProgramFilters] ⚠️ Unknown keys stripped:', unknownKeysFound);
  }

  // ============= Build V2 Canonical Payload =============
  const normalized: NormalizedProgramFilters = {
    // Keyword (text search)
    keyword: input.keyword ?? input.q ?? input.query ?? input.subject ?? undefined,
    
    // Country: aliases → country_code
    // IMPORTANT: Never pass slugs/labels as country_code.
    // If we can't map/canonicalize safely, DROP it.
    country_code: canonicalizeCountryCode(input.country_code ?? input.country_slug ?? input.country),
    
    // City (direct)
    city: input.city ?? undefined,
    
    // Degree: aliases → degree_slug (NOT degree_level!)
    // IMPORTANT: Accept only canonical degree_slug OR UUID (backend can resolve UUID → slug).
    degree_slug: canonicalizeDegreeSlugOrId(input.degree_slug ?? input.degree_level ?? input.degree_id ?? input.degree),
    
    // Discipline: aliases → discipline_slug
    // IMPORTANT: Backend does NOT resolve discipline_id → slug, so UUIDs are DROPPED.
    discipline_slug: canonicalizeDisciplineSlug(input.discipline_slug ?? input.discipline_id ?? input.discipline),
    
    // Study mode (direct)
    study_mode: input.study_mode ?? undefined,
    
    // Language: normalize to array → instruction_languages
    // IMPORTANT: Map labels like "English" → "en"; otherwise DROP.
    instruction_languages: canonicalizeInstructionLanguages(input.instruction_languages ?? input.language),
    
    // Tuition: aliases → tuition_usd_min/max
    tuition_usd_min: parseNumberOrUndefined(input.tuition_usd_min),
    tuition_usd_max: parseNumberOrUndefined(input.tuition_usd_max ?? input.max_tuition ?? input.fees_max ?? input.tuition_max_year_usd),
    
    // Duration
    duration_months_max: parseNumberOrUndefined(input.duration_months_max),
    
    // Dorm
    has_dorm: parseBooleanOrUndefined(input.has_dorm),
    dorm_price_monthly_usd_max: parseNumberOrUndefined(input.dorm_price_monthly_usd_max),
    
    // Living costs
    monthly_living_usd_max: parseNumberOrUndefined(input.monthly_living_usd_max),
    
    // Scholarship
    scholarship_available: parseBooleanOrUndefined(input.scholarship_available),
    scholarship_type: input.scholarship_type ?? undefined,
    
    // Intake/deadline
    intake_months: normalizeIntakeMonths(input.intake_months),
    deadline_before: parseDateYYYYMMDDOrUndefined(input.deadline_before),
    
    // Pagination
    limit: Number(input.limit ?? input.page_size ?? 24),
    offset: Number(input.offset ?? (input.page ? ((input.page - 1) * (input.page_size || 24)) : 0)),
  };

  // Clean undefined values (preserve 0 and false!)
  Object.keys(normalized).forEach(key => {
    const value = normalized[key as keyof NormalizedProgramFilters];
    if (value === undefined || value === null || value === '') {
      delete normalized[key as keyof NormalizedProgramFilters];
    }
  });

  // Ensure required paging defaults
  if (!normalized.limit) normalized.limit = 24;
  if (normalized.offset === undefined) normalized.offset = 0;

  console.log('[normalizeProgramFilters] ✅ V2 Output:', Object.keys(normalized));
  
  return normalized;
}

// ============= Helper Functions =============

function normalizeIntakeMonths(value: unknown): number[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const nums = value.map(v => Number(v)).filter(n => !isNaN(n) && n >= 1 && n <= 12);
    return nums.length > 0 ? nums : undefined;
  }
  return undefined;
}

function parseNumberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  // ✅ Preserve 0 as valid value
  // ✅ Drop NaN/Infinity
  return Number.isFinite(num) ? num : undefined;
}

function parseBooleanOrUndefined(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

function parseDateYYYYMMDDOrUndefined(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v) return undefined;
  // Contract expects YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

/**
 * Validates that a payload only contains V2 Contract keys.
 * Returns list of invalid keys found.
 */
export function validateContractV2Keys(input: Record<string, any>): string[] {
  const invalidKeys: string[] = [];
  
  Object.keys(input).forEach(key => {
    if (LOCKED_KEYS.has(key)) {
      invalidKeys.push(`🔒 ${key} (locked)`);
    } else if (!ALLOWED_KEYS.has(key) && input[key] !== undefined && input[key] !== null) {
      invalidKeys.push(key);
    }
  });
  
  return invalidKeys;
}

/**
 * V2 Contract filter keys for UI reference
 */
export const CONTRACT_V2_FILTERS = {
  // Text search
  KEYWORD: 'keyword',
  
  // 16 Canonical
  COUNTRY: 'country_code',
  CITY: 'city',
  DEGREE: 'degree_slug',
  DISCIPLINE: 'discipline_slug',
  STUDY_MODE: 'study_mode',
  LANGUAGES: 'instruction_languages',
  TUITION_MIN: 'tuition_usd_min',
  TUITION_MAX: 'tuition_usd_max',
  DURATION_MAX: 'duration_months_max',
  HAS_DORM: 'has_dorm',
  DORM_PRICE_MAX: 'dorm_price_monthly_usd_max',
  LIVING_MAX: 'monthly_living_usd_max',
  SCHOLARSHIP: 'scholarship_available',
  SCHOLARSHIP_TYPE: 'scholarship_type',
  INTAKE_MONTHS: 'intake_months',
  DEADLINE: 'deadline_before',
  
  // Pagination
  LIMIT: 'limit',
  OFFSET: 'offset',
} as const;

/**
 * @deprecated Use CONTRACT_V2_FILTERS instead
 */
export const CONTRACT_V1_FILTERS = CONTRACT_V2_FILTERS;
