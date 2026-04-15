/**
 * ════════════════════════════════════════════════════════════════════════════
 * ██████╗  ██████╗ ███╗   ██╗████████╗██████╗  █████╗  ██████╗████████╗
 * ██╔════╝██╔═══██╗████╗  ██║╚══██╔══╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝
 * ██║     ██║   ██║██╔██╗ ██║   ██║   ██████╔╝███████║██║        ██║   
 * ██║     ██║   ██║██║╚██╗██║   ██║   ██╔══██╗██╔══██║██║        ██║   
 * ╚██████╗╚██████╔╝██║ ╚████║   ██║   ██║  ██║██║  ██║╚██████╗   ██║   
 *  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝   ╚═╝   
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * ⚠️  CONTRACT LOCKED — DO NOT EDIT KEYS HERE WITHOUT CRM CHANGE + EVIDENCE  ⚠️
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * PORTAL FILTER CONTRACT - Single Source of Truth (FIX #4)
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * This is the ONLY file that defines filter keys.
 * ALL other files MUST import from here.
 * 
 * CONTRACT:
 * - HARD16_KEYS: User-controlled filters in cards_query.params (16 keys)
 * - RANK10_KEYS: Ranking filters in cards_query.rank_filters (10 keys)
 * - LOCKED_KEYS: Server-only, NEVER from client/CRM/Portal (4 keys)
 * - TOTAL ALLOWED: 26 keys only (16 + 10)
 * 
 * CRITICAL: "keyword" is NOT in filter sets - handled separately
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * FREEZE STATUS: LOCKED (2026-02-05)
 * Any modification requires:
 * 1. CRM team approval with signed contract update
 * 2. Evidence pack showing CRM-side implementation
 * 3. Telemetry verification post-deployment
 * ════════════════════════════════════════════════════════════════════════════
 */

// ============================================================
// HARD 16 KEYS (User-controlled filters)
// ============================================================
export const HARD16_KEYS = [
  // 1-2. Location
  'country_code',
  'city',
  // 3-4. Program Type
  'degree_slug',
  'discipline_slug',
  // 5-6. Study Details
  'study_mode',
  'instruction_languages',
  // 7-8. Tuition
  'tuition_usd_min',
  'tuition_usd_max',
  // 9. Duration
  'duration_months_max',
  // 10-11. Dormitory
  'has_dorm',
  'dorm_price_monthly_usd_max',
  // 12. Living Cost
  'monthly_living_usd_max',
  // 13-14. Scholarship
  'scholarship_available',
  'scholarship_type',
  // 15-16. Timing
  'intake_months',
  'deadline_before',
] as const;

export type Hard16Key = typeof HARD16_KEYS[number];
export const HARD16_SET = new Set<string>(HARD16_KEYS);

// ============================================================
// RANK 10 KEYS (Ranking filters)
// ============================================================
export const RANK10_KEYS = [
  'institution_id',
  'ranking_system',
  'ranking_year',
  'world_rank_max',
  'national_rank_max',
  'overall_score_min',
  'teaching_score_min',
  'employability_score_min',
  'academic_reputation_score_min',
  'research_score_min',
] as const;

export type Rank10Key = typeof RANK10_KEYS[number];
export const RANK10_SET = new Set<string>(RANK10_KEYS);

// ============================================================
// ✅ RANK10 FULLY WIRED (10/10) - 2026-02-05
// ============================================================
// All 10 Rank10 keys are now WIRED.
// Data coverage is low but UI/API infrastructure is ready.
// Filters will work but may return few results until data is populated.

export const WIRED_RANK10_KEYS = [...RANK10_KEYS] as const;
export type WiredRank10Key = typeof WIRED_RANK10_KEYS[number];
export const WIRED_RANK10_SET = new Set<string>(RANK10_KEYS);

// NOT WIRED = 0 keys (all 10 are now WIRED)
export const NOT_WIRED_RANK10_KEYS = [] as const;
export type NotWiredRank10Key = typeof NOT_WIRED_RANK10_KEYS[number];
export const NOT_WIRED_RANK10_SET = new Set<string>();

// ============================================================
// RANKING CONSISTENCY RULE (ENABLED)
// ============================================================
// If any threshold key (world_rank_max, *_score_min) is present,
// ranking_system AND ranking_year MUST also be present.
// Exception: institution_id alone is allowed.
export const RANK_THRESHOLD_KEYS = [
  'world_rank_max',
  'national_rank_max',
  'overall_score_min',
  'teaching_score_min',
  'employability_score_min',
  'academic_reputation_score_min',
  'research_score_min',
] as const;
export const RANK_THRESHOLD_SET = new Set<string>(RANK_THRESHOLD_KEYS);

// Legacy aliases (for backwards compatibility in exports)
export const PARTIAL_RANK10_KEYS = NOT_WIRED_RANK10_KEYS;
export type PartialRank10Key = NotWiredRank10Key;
export const PARTIAL_RANK10_SET = NOT_WIRED_RANK10_SET;
export const SUPPORTED_RANK10_KEYS = WIRED_RANK10_KEYS;
export const SUPPORTED_RANK10_SET = WIRED_RANK10_SET;

// ============================================================
// LOCKED KEYS (Server-only - NEVER from client)
// ============================================================
export const LOCKED_KEYS = [
  'is_active',
  'partner_priority',
  'do_not_offer',
  'tuition_basis',
] as const;

export type LockedKey = typeof LOCKED_KEYS[number];
export const LOCKED_SET = new Set<string>(LOCKED_KEYS);

// ============================================================
// COMBINED ALLOWED KEYS (26 total)
// ============================================================
export const ALL_ALLOWED_KEYS = [
  ...HARD16_KEYS,
  ...RANK10_KEYS,
] as const;

export const ALL_ALLOWED_SET = new Set<string>(ALL_ALLOWED_KEYS);

// ============================================================
// KEYWORD EXCEPTION - Handled separately from filter keys
// ============================================================
// STRICT: Only "keyword" is allowed per CRM contract (2026-02-05)
// Aliases (q, query, keywords) are NO LONGER permitted - they cause STOP
export const KEYWORD_KEYS = ['keyword'] as const;
export const KEYWORD_SET = new Set<string>(KEYWORD_KEYS);

// ============================================================
// BLOCKED KEYWORD ALIASES - These trigger Contract Violation
// ============================================================
export const BLOCKED_KEYWORD_ALIASES = ['q', 'query', 'keywords'] as const;
export const BLOCKED_KEYWORD_SET = new Set<string>(BLOCKED_KEYWORD_ALIASES);

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Check if a key is a Hard 16 filter
 */
export function isHard16Key(key: string): key is Hard16Key {
  return HARD16_SET.has(key);
}

/**
 * Check if a key is a Rank 10 filter
 */
export function isRank10Key(key: string): key is Rank10Key {
  return RANK10_SET.has(key);
}

/**
 * Check if a key is NOT WIRED Rank10 (triggers STOP)
 * Evidence: 2026-02-04 Filter Wiring Verification
 */
export function isNotWiredRank10Key(key: string): key is NotWiredRank10Key {
  return NOT_WIRED_RANK10_SET.has(key);
}

/**
 * Check if a key is WIRED Rank10 (allowed)
 * Currently only: institution_id
 */
export function isWiredRank10Key(key: string): key is WiredRank10Key {
  return WIRED_RANK10_SET.has(key);
}

// Legacy aliases
export const isPartialRank10Key = isNotWiredRank10Key;
export const isSupportedRank10Key = isWiredRank10Key;

/**
 * Check if a key is LOCKED (server-only)
 */
export function isLockedKey(key: string): key is LockedKey {
  return LOCKED_SET.has(key);
}

/**
 * Check if a key is allowed in filters (26 keys only)
 */
export function isAllowedKey(key: string): boolean {
  return ALL_ALLOWED_SET.has(key);
}

// ============================================================
// FAIL-CLOSED VALIDATION RESULT
// ============================================================

export interface ContractViolationResult {
  /** Whether the request is valid (no violations) */
  valid: boolean;
  /** LOCKED keys found (causes STOP) */
  lockedKeys: string[];
  /** Unknown keys found (causes STOP) */
  unknownKeys: string[];
  /** PARTIAL Rank10 keys found (causes STOP) */
  partialKeys: string[];
  /** Human-readable error for UI */
  errorMessage?: string;
}

/**
 * Validate filter keys - FAIL-CLOSED behavior
 * Returns violations list - ANY violation = STOP (no search, no ACK)
 * 
 * RANKING CONSISTENCY RULE:
 * If any threshold key (world_rank_max, *_score_min) is present,
 * ranking_system AND ranking_year MUST also be present.
 * Exception: institution_id alone is allowed.
 */
export function validateFilterKeys(
  params: Record<string, unknown> | null | undefined,
  rankFilters?: Record<string, unknown> | null
): ContractViolationResult {
  const lockedKeys: string[] = [];
  const unknownKeys: string[] = [];
  const partialKeys: string[] = [];
  
  // Check params (Hard16 + keyword aliases allowed)
  if (params && typeof params === 'object') {
    for (const key of Object.keys(params)) {
      if (isLockedKey(key)) {
        lockedKeys.push(key);
      } else if (KEYWORD_SET.has(key)) {
        // KEYWORD EXCEPTION: keyword/keywords/q/query are allowed
        // They are NOT filters - they are search terms handled separately
        continue;
      } else if (BLOCKED_KEYWORD_SET.has(key)) {
        // BLOCKED ALIAS: q/query/keywords are NO LONGER allowed (2026-02-05)
        unknownKeys.push(`blocked_alias:${key}`);
      } else if (!isHard16Key(key)) {
        // NOT a canonical Hard16 key = unknown = STOP
        unknownKeys.push(key);
      }
    }
  }
  
  // Check rank_filters (All 10 WIRED - 2026-02-05)
  if (rankFilters && typeof rankFilters === 'object') {
    const rankKeys = Object.keys(rankFilters);
    
    for (const key of rankKeys) {
      if (isLockedKey(key)) {
        lockedKeys.push(key);
      } else if (!isRank10Key(key)) {
        // Not in RANK10 definition = unknown
        unknownKeys.push(`rank:${key}`);
      }
      // All RANK10 keys pass through now
    }
    
    // RANKING CONSISTENCY RULE - ENABLED
    // If any threshold key is present, ranking_system + ranking_year must also be present
    const hasThreshold = rankKeys.some(k => RANK_THRESHOLD_SET.has(k));
    const hasSystemYear = rankKeys.includes('ranking_system') && rankKeys.includes('ranking_year');
    const isOnlyInstitutionId = rankKeys.length === 1 && rankKeys[0] === 'institution_id';
    
    if (hasThreshold && !hasSystemYear && !isOnlyInstitutionId) {
      // Threshold keys require context (ranking_system + ranking_year)
      partialKeys.push('missing_ranking_context');
    }
  }
  
  const hasViolations = lockedKeys.length > 0 || unknownKeys.length > 0 || partialKeys.length > 0;
  
  return {
    valid: !hasViolations,
    lockedKeys,
    unknownKeys,
    partialKeys,
    errorMessage: hasViolations ? buildErrorMessage(lockedKeys, unknownKeys, partialKeys) : undefined,
  };
}

/**
 * Build error message for contract violations
 * Returns i18n key, not raw Arabic text
 */
function buildErrorMessage(
  lockedKeys: string[],
  unknownKeys: string[],
  partialKeys: string[]
): string {
  const parts: string[] = [];
  
  if (lockedKeys.length > 0) {
    parts.push(`locked_keys: ${lockedKeys.join(', ')}`);
  }
  if (unknownKeys.length > 0) {
    parts.push(`unknown_keys: ${unknownKeys.join(', ')}`);
  }
  if (partialKeys.length > 0) {
    parts.push(`unsupported_rank_keys: ${partialKeys.join(', ')}`);
  }
  
  return `contract_violation: ${parts.join('; ')}`;
}

// ============================================================
// NO ALIAS MAPPINGS - Portal does NOT normalize
// ============================================================
// REMOVED: ALIAS_TO_CANONICAL and getCanonicalKey()
// Portal does NOT correct invalid inputs - it STOPs on any non-canonical key
