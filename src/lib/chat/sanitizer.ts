/**
 * ============================================================
 * PORTAL FILTER VALIDATOR - Fail-Closed Contract Enforcement
 * ============================================================
 * 
 * CRITICAL CHANGE: This is NO LONGER a "sanitizer" that strips keys.
 * It is now a VALIDATOR that enforces Fail-Closed behavior.
 * 
 * NEW CONTRACT:
 * - Any LOCKED key = STOP (no search, no ACK)
 * - Any UNKNOWN key = STOP (no search, no ACK)
 * - Any PARTIAL Rank10 key = STOP (no search, no ACK)
 * - NO alias normalization (Portal does NOT invent CRM rules)
 * 
 * OLD BEHAVIOR (REMOVED):
 * - Stripping invalid keys and continuing ❌
 * - Alias normalization (country → country_code) ❌
 */

import {
  HARD16_SET,
  LOCKED_SET,
  validateFilterKeys,
} from './contracts';

// Re-export ContractViolationResult type
export type { ContractViolationResult } from './contracts/filters';

// ============================================================
// TELEMETRY EVENT NAMES
// ============================================================

export const VALIDATOR_EVENTS = {
  CONTRACT_VIOLATION: 'PORTAL_CONTRACT_VIOLATION',
  LOCKED_KEY_DETECTED: 'PORTAL_LOCKED_KEY_DETECTED',
  UNKNOWN_KEY_DETECTED: 'PORTAL_UNKNOWN_FILTER_KEY_BLOCKED',
  PARTIAL_RANK10_DETECTED: 'PORTAL_UNSUPPORTED_RANK10_KEY_BLOCKED',
} as const;

// ============================================================
// VALIDATION RESULT TYPE
// ============================================================

export interface FilterValidationResult {
  /** Whether the request can proceed */
  canProceed: boolean;
  /** Validated params (only if canProceed = true) */
  validatedParams: Record<string, unknown> | null;
  /** Validated rank_filters (only if canProceed = true) */
  validatedRankFilters: Record<string, unknown> | null;
  /** Contract violations (if any) */
  violations: import('./contracts/filters').ContractViolationResult | null;
  /** Telemetry event to send */
  telemetryEvent: string | null;
  /** Telemetry payload */
  telemetryPayload: Record<string, unknown> | null;
}

// ============================================================
// FAIL-CLOSED VALIDATOR (Replaces old sanitizer)
// ============================================================

/**
 * Validate cards_query.params - FAIL-CLOSED enforcement
 * 
 * @param params - Raw params from CRM cards_query
 * @param rankFilters - Optional rank_filters from CRM
 * @returns Validation result with canProceed flag
 * 
 * BEHAVIOR:
 * - If ANY violation detected: canProceed = false, telemetry event generated
 * - If valid: canProceed = true, cleaned params returned (nulls removed)
 */
export function validateCardsQueryParams(
  params: Record<string, unknown> | null | undefined,
  rankFilters?: Record<string, unknown> | null
): FilterValidationResult {
  // Empty params = valid but empty
  if (!params || typeof params !== 'object') {
    return {
      canProceed: true,
      validatedParams: {},
      validatedRankFilters: rankFilters ? cleanNullValues(rankFilters) : null,
      violations: null,
      telemetryEvent: null,
      telemetryPayload: null,
    };
  }
  
  // Validate against contract
  const violations = validateFilterKeys(params, rankFilters);
  
  // ANY violation = STOP
  if (!violations.valid) {
    const telemetryPayload = buildTelemetryPayload(violations);
    
    console.error('[Validator] ❌ CONTRACT VIOLATION - STOP', {
      lockedKeys: violations.lockedKeys,
      unknownKeys: violations.unknownKeys,
      partialKeys: violations.partialKeys,
    });
    
    return {
      canProceed: false,
      validatedParams: null,
      validatedRankFilters: null,
      violations,
      telemetryEvent: VALIDATOR_EVENTS.CONTRACT_VIOLATION,
      telemetryPayload,
    };
  }
  
  // Valid - clean null/undefined values only
  const cleanedParams = cleanNullValues(params);
  const cleanedRankFilters = rankFilters ? cleanNullValues(rankFilters) : null;
  
  return {
    canProceed: true,
    validatedParams: cleanedParams,
    validatedRankFilters: cleanedRankFilters,
    violations: null,
    telemetryEvent: null,
    telemetryPayload: null,
  };
}

/**
 * Clean null/undefined/empty values (does NOT strip keys)
 */
function cleanNullValues(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Build telemetry payload for contract violation
 */
function buildTelemetryPayload(violations: import('./contracts/filters').ContractViolationResult): Record<string, unknown> {
  return {
    event: VALIDATOR_EVENTS.CONTRACT_VIOLATION,
    timestamp: new Date().toISOString(),
    locked_keys: violations.lockedKeys,
    unknown_keys: violations.unknownKeys,
    partial_keys: violations.partialKeys,
    total_violations: 
      violations.lockedKeys.length + 
      violations.unknownKeys.length + 
      violations.partialKeys.length,
  };
}

/**
 * Check if a key is allowed in cards_query.params (Hard16 only)
 */
export function isAllowedKey(key: string): boolean {
  return HARD16_SET.has(key);
}

/**
 * Check if a key is locked (server-only)
 */
export function isLockedKey(key: string): boolean {
  return LOCKED_SET.has(key);
}
