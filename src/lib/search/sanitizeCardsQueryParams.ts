/**
 * ============================================================
 * PORTAL SEARCH VALIDATOR - Fail-Closed Enforcement
 * ============================================================
 * 
 * Re-exports validation functions from chat module.
 * This is the ONLY way to process cards_query.params for Catalog.
 * 
 * CRITICAL CHANGE (v2):
 * - NO MORE "sanitize" (stripping) - replaced with "validate" (stop)
 * - ANY violation = STOP (no search, no ACK)
 * - NO alias normalization
 * 
 * Guarantees:
 * 1. Only 16 Hard16 Keys in params
 * 2. Only 4 Supported Rank10 Keys in rank_filters
 * 3. LOCKED keys (is_active, tuition_basis, etc.) = STOP
 * 4. UNKNOWN keys = STOP
 * 5. PARTIAL Rank10 keys = STOP
 */

export { 
  validateCardsQueryParams,
  VALIDATOR_EVENTS,
  isAllowedKey,
  isLockedKey,
  type FilterValidationResult,
} from '@/lib/chat/sanitizer';

// Re-export contract types
export {
  HARD16_KEYS,
  HARD16_SET,
  RANK10_KEYS,
  RANK10_SET,
  LOCKED_KEYS,
  LOCKED_SET,
  PARTIAL_RANK10_SET,
  SUPPORTED_RANK10_SET,
  isHard16Key,
  isRank10Key,
  isLockedKey as isLockedKeyContract,
  isPartialRank10Key,
  validateFilterKeys,
} from '@/lib/chat/contracts/filters';
