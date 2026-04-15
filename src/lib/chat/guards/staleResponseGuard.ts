/**
 * ════════════════════════════════════════════════════════════════════════════
 * PORTAL STALE RESPONSE GUARD (P11)
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Drops late/stale CRM responses to prevent UI desync.
 * 
 * A response is STALE if:
 * 1. It has a different turn_id than the current active turn
 * 2. It has an older sequence than the current active query
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

import { logStaleResponseDropped } from '../telemetry';

// ============================================================
// STATE
// ============================================================

export interface ActiveTurnState {
  /** Current active turn ID (message being processed) */
  activeTurnId: string | null;
  /** Current active query ID */
  activeQueryId: string | null;
  /** Current active sequence */
  activeSequence: number;
  /** Timestamp of last update */
  updatedAt: number;
}

const state: ActiveTurnState = {
  activeTurnId: null,
  activeQueryId: null,
  activeSequence: 0,
  updatedAt: 0,
};

// ============================================================
// STATE MANAGEMENT
// ============================================================

/**
 * Set active turn when sending a message
 */
export function setActiveTurn(turnId: string): void {
  state.activeTurnId = turnId;
  state.updatedAt = Date.now();
  
  if (import.meta.env.DEV) {
    console.log('[StaleGuard] 📌 Active turn set:', turnId);
  }
}

/**
 * Set active query when search starts
 */
export function setActiveQuery(queryId: string, sequence: number): void {
  state.activeQueryId = queryId;
  state.activeSequence = sequence;
  state.updatedAt = Date.now();
  
  if (import.meta.env.DEV) {
    console.log('[StaleGuard] 📌 Active query set:', { queryId, sequence });
  }
}

/**
 * Get current state (for debugging)
 */
export function getActiveState(): Readonly<ActiveTurnState> {
  return { ...state };
}

/**
 * Reset state (new conversation)
 */
export function resetStaleGuardState(): void {
  state.activeTurnId = null;
  state.activeQueryId = null;
  state.activeSequence = 0;
  state.updatedAt = Date.now();
}

// ============================================================
// STALE DETECTION
// ============================================================

export interface StaleCheckResult {
  isStale: boolean;
  reason?: 'wrong_turn' | 'old_sequence' | 'unknown_query';
}

/**
 * Check if a CRM response is stale
 * @param responseTurnId - The turn_id from the CRM response
 */
export function isResponseStale(responseTurnId: string | undefined): StaleCheckResult {
  // No active turn = accept (first message scenario)
  if (!state.activeTurnId) {
    return { isStale: false };
  }
  
  // No turn_id in response = accept (legacy CRM)
  if (!responseTurnId) {
    return { isStale: false };
  }
  
  // Different turn_id = STALE
  if (responseTurnId !== state.activeTurnId) {
    if (import.meta.env.DEV) {
      console.warn('[StaleGuard] ⚠️ STALE response (wrong turn):', {
        response: responseTurnId,
        active: state.activeTurnId,
      });
    }
    return { isStale: true, reason: 'wrong_turn' };
  }
  
  return { isStale: false };
}

/**
 * Check if search results are stale
 * @param queryId - The query_id from results
 * @param sequence - The sequence from results
 */
export function areResultsStale(queryId: string, sequence: number): StaleCheckResult {
  // No active query = accept
  if (!state.activeQueryId) {
    return { isStale: false };
  }
  
  // Different query_id = STALE
  if (queryId !== state.activeQueryId) {
    logStaleResponseDropped(queryId, sequence, state.activeQueryId, state.activeSequence);
    
    if (import.meta.env.DEV) {
      console.warn('[StaleGuard] ⚠️ STALE results (wrong query):', {
        response: queryId,
        active: state.activeQueryId,
      });
    }
    return { isStale: true, reason: 'unknown_query' };
  }
  
  // Older sequence = STALE
  if (sequence < state.activeSequence) {
    logStaleResponseDropped(queryId, sequence, state.activeQueryId, state.activeSequence);
    
    if (import.meta.env.DEV) {
      console.warn('[StaleGuard] ⚠️ STALE results (old sequence):', {
        response: sequence,
        active: state.activeSequence,
      });
    }
    return { isStale: true, reason: 'old_sequence' };
  }
  
  return { isStale: false };
}
