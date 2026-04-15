/**
 * ============================================================
 * PORTAL CONTRACTS - Central Export
 * ============================================================
 * 
 * All contract definitions in one place.
 * Import from here for any contract-related functionality.
 */

// Filter Contract (Evidence: 2026-02-05 ALL 26 KEYS WIRED ✅)
export {
  // HARD16 Keys (16/16 WIRED ✅)
  HARD16_KEYS,
  HARD16_SET,
  type Hard16Key,
  isHard16Key,
  
  // RANK10 Keys (10/10 WIRED ✅)
  RANK10_KEYS,
  RANK10_SET,
  type Rank10Key,
  isRank10Key,
  
  // WIRED RANK10 (ALL 10 WIRED - 2026-02-05)
  WIRED_RANK10_KEYS,
  WIRED_RANK10_SET,
  type WiredRank10Key,
  isWiredRank10Key,
  
  // NOT WIRED RANK10 (0 keys - 100% coverage)
  NOT_WIRED_RANK10_KEYS,
  NOT_WIRED_RANK10_SET,
  type NotWiredRank10Key,
  isNotWiredRank10Key,
  
  // Ranking Consistency Rule (ENFORCED ✅)
  RANK_THRESHOLD_KEYS,
  RANK_THRESHOLD_SET,
  
  // LOCKED Keys (server-only)
  LOCKED_KEYS,
  LOCKED_SET,
  type LockedKey,
  isLockedKey,
  
  // KEYWORD Exception (not filters - search terms)
  KEYWORD_KEYS,
  KEYWORD_SET,
  
  // Combined
  ALL_ALLOWED_KEYS,
  ALL_ALLOWED_SET,
  isAllowedKey,
  
  // Validation (FAIL-CLOSED)
  type ContractViolationResult,
  validateFilterKeys,
  
  // Legacy aliases (backwards compatibility)
  PARTIAL_RANK10_KEYS,
  PARTIAL_RANK10_SET,
  type PartialRank10Key,
  isPartialRank10Key,
  SUPPORTED_RANK10_KEYS,
  SUPPORTED_RANK10_SET,
  isSupportedRank10Key,
} from './filters';

// Filter Map (Entity Targets & Operator Semantics)
export {
  // Types
  type EntityTarget,
  type OperatorSemantics,
  type FilterMapping,
  
  // Maps
  HARD16_FILTER_MAP,
  RANK10_FILTER_MAP,
  LOCKED_FILTER_MAP,
  ALL_FILTER_MAP,
  
  // Helpers
  getFilterMapping,
  isFilterWired,
  filterRequiresJoin,
  getFiltersByEntity,
  
  // Status
  WIRING_STATUS,
} from './filter_map';

export {
  type CardsQueryPayload,
  buildCardsQueryPayload,
} from './cardsQueryPayload';


export {
  type SanitizedProgramFilters,
  sanitizeProgramFilters,
} from './programFilters';

export {
  // Constants
  CHANNELS,
  ENTRY_FN,
  CLIENT_BUILD,
  DEFAULT_CAPS,
  // Types
  type ChannelType,
  type CanonicalRequest,
  type ClientCapabilities,
  // Builders
  getChannel,
  createStamps,
  generateTraceId,
  generateTurnId,
} from './envelope';

// Response Contract (FIX #3)
export {
  // Types
  type ReplySplit,
  type ReplyText,
  type ReplyContent,
  type UIDirectives,
  type CardsQuery,
  type EffectiveCaps,
  type CRMResponse,
  type ParsedReply,
  // Parsers
  parseReply,
  getEffectiveCaps,
  validateReplyContent,
} from './response';
