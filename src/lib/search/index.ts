/**
 * ============================================================
 * PORTAL SEARCH MODULE - Barrel Export
 * ============================================================
 * 
 * Single entry point for all search-related functionality.
 * 
 * Usage:
 * import { searchPrograms, validateCardsQueryParams } from '@/lib/search';
 */

// Constants
export { 
  CANONICAL_16_KEYS, 
  LOCKED_KEYS, 
  TEXT_SEARCH_KEY,
  SYSTEM_CONSTANTS,
} from './constants';

// Validators (Fail-Closed - replaces old Sanitizers)
export {
  validateCardsQueryParams,
  VALIDATOR_EVENTS,
  isAllowedKey,
  isLockedKey,
  type FilterValidationResult,
  HARD16_KEYS,
  HARD16_SET,
  RANK10_KEYS,
  RANK10_SET,
  LOCKED_SET,
  PARTIAL_RANK10_SET,
  isHard16Key,
  isRank10Key,
  isPartialRank10Key,
  validateFilterKeys,
} from './sanitizeCardsQueryParams';

// Catalog Search
export {
  searchPrograms,
  validateSearchParams,
  type CatalogSearchParams,
  type CatalogSearchResult,
} from './catalogSearch';
