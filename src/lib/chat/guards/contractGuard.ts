/**
 * ============================================================
 * PORTAL CONTRACT GUARD - Fail-Closed Validation
 * ============================================================
 * 
 * Validates cards_query before search execution.
 * ANY violation = NO SEARCH + NO ACK + Telemetry event
 */

import {
  validateFilterKeys,
  isLockedKey,
  type CardsQuery,
  type UIDirectives,
} from '../contracts';

// ============================================================
// VIOLATION TYPES
// ============================================================

export type ViolationType =
  | 'MISSING_QUERY_ID'
  | 'MISSING_SEQUENCE'
  | 'MISSING_PARAMS'
  | 'LOCKED_KEY_DETECTED'
  | 'UNKNOWN_KEY_DETECTED'
  | 'INVALID_SEARCH_MODE'
  | 'STALE_RESPONSE';

export interface ContractViolation {
  type: ViolationType;
  details: string;
  keys?: string[];
}

export interface GuardResult {
  /** Whether the request is valid */
  valid: boolean;
  /** Violations if invalid */
  violations: ContractViolation[];
  /** Sanitized cards_query if valid */
  sanitizedQuery: CardsQuery | null;
}

// ============================================================
// GUARD FUNCTIONS
// ============================================================

/**
 * Validate search trigger conditions
 * Search starts ONLY if:
 * 1. ui_directives.search_mode === 'start'
 * 2. cards_query exists
 * 3. cards_query passes validation
 */
export function validateSearchTrigger(
  uiDirectives: UIDirectives | undefined,
  cardsQuery: CardsQuery | undefined
): { canSearch: boolean; reason?: string } {
  // Check search_mode
  if (!uiDirectives?.search_mode) {
    return { canSearch: false, reason: 'search_mode not set' };
  }
  
  if (uiDirectives.search_mode !== 'start') {
    return { canSearch: false, reason: `search_mode is '${uiDirectives.search_mode}', not 'start'` };
  }
  
  // Check cards_query exists
  if (!cardsQuery) {
    return { canSearch: false, reason: 'cards_query missing' };
  }
  
  return { canSearch: true };
}

/**
 * Full contract validation for cards_query
 * Returns violations list - empty means valid
 */
export function validateCardsQuery(query: CardsQuery | undefined): GuardResult {
  const violations: ContractViolation[] = [];
  
  if (!query) {
    return { valid: false, violations: [{ type: 'MISSING_PARAMS', details: 'cards_query is null/undefined' }], sanitizedQuery: null };
  }
  
  // 1. Check required fields
  if (!query.query_id) {
    violations.push({ type: 'MISSING_QUERY_ID', details: 'query_id is required' });
  }
  
  if (query.sequence === undefined || query.sequence === null) {
    violations.push({ type: 'MISSING_SEQUENCE', details: 'sequence is required' });
  }
  
  if (!query.params || typeof query.params !== 'object') {
    violations.push({ type: 'MISSING_PARAMS', details: 'params object is required' });
  }
  
  // If basic validation failed, return early
  if (violations.length > 0) {
    return { valid: false, violations, sanitizedQuery: null };
  }
  
  // 2. Validate filter keys
  const filterResult = validateFilterKeys(query.params, query.rank_filters);
  
  if (filterResult.lockedKeys.length > 0) {
    violations.push({
      type: 'LOCKED_KEY_DETECTED',
      details: `LOCKED keys detected: ${filterResult.lockedKeys.join(', ')}`,
      keys: filterResult.lockedKeys,
    });
  }
  
  if (filterResult.unknownKeys.length > 0) {
    violations.push({
      type: 'UNKNOWN_KEY_DETECTED',
      details: `Unknown keys detected: ${filterResult.unknownKeys.join(', ')}`,
      keys: filterResult.unknownKeys,
    });
  }
  
  // 3. Build sanitized query (strip unknown/locked keys)
  const sanitizedParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query.params)) {
    if (!isLockedKey(key) && value !== null && value !== undefined) {
      sanitizedParams[key] = value;
    }
  }
  
  const sanitizedRankFilters: Record<string, unknown> | undefined = query.rank_filters
    ? Object.fromEntries(
        Object.entries(query.rank_filters).filter(([k, v]) => !isLockedKey(k) && v !== null && v !== undefined)
      )
    : undefined;
  
  const sanitizedQuery: CardsQuery = {
    query_id: query.query_id,
    sequence: query.sequence,
    params: sanitizedParams,
    rank_filters: sanitizedRankFilters,
    limit: query.limit,
  };
  
  return {
    valid: violations.length === 0,
    violations,
    sanitizedQuery,
  };
}

// ============================================================
// STALE GUARD
// ============================================================

export interface StaleGuardState {
  /** Current active query */
  activeQueryId: string | null;
  /** Current sequence */
  activeSequence: number;
  /** Abort controller for cancellation */
  abortController: AbortController | null;
}

/**
 * Create initial stale guard state
 */
export function createStaleGuardState(): StaleGuardState {
  return {
    activeQueryId: null,
    activeSequence: 0,
    abortController: null,
  };
}

/**
 * Check if a response is stale (newer query already active)
 */
export function isStaleResponse(
  state: StaleGuardState,
  queryId: string,
  sequence: number
): boolean {
  // Different query - stale
  if (state.activeQueryId && state.activeQueryId !== queryId) {
    return true;
  }
  
  // Same query but older sequence - stale
  if (sequence < state.activeSequence) {
    return true;
  }
  
  return false;
}

/**
 * Update stale guard state for new query
 */
export function updateStaleGuardState(
  state: StaleGuardState,
  queryId: string,
  sequence: number
): StaleGuardState {
  // Abort previous request if exists
  if (state.abortController) {
    state.abortController.abort();
  }
  
  return {
    activeQueryId: queryId,
    activeSequence: sequence,
    abortController: new AbortController(),
  };
}

// ============================================================
// TELEMETRY EVENTS
// ============================================================

export const GUARD_EVENTS = {
  CONTRACT_VIOLATION: 'PORTAL_CONTRACT_VIOLATION',
  STALE_CRM_RESPONSE: 'PORTAL_STALE_CRM_RESPONSE_DROPPED',
  STALE_RESULTS: 'PORTAL_STALE_RESULTS_DROPPED',
  SEARCH_START: 'PORTAL_SEARCH_START_RECEIVED',
  SEARCH_BLOCKED: 'PORTAL_SEARCH_BLOCKED',
} as const;

/**
 * Create telemetry event for contract violation
 */
export function createViolationEvent(
  violations: ContractViolation[],
  queryId?: string
): Record<string, unknown> {
  return {
    event: GUARD_EVENTS.CONTRACT_VIOLATION,
    query_id: queryId,
    violation_count: violations.length,
    violation_types: violations.map(v => v.type),
    violations: violations.map(v => ({
      type: v.type,
      details: v.details,
      keys: v.keys,
    })),
    timestamp: new Date().toISOString(),
  };
}
