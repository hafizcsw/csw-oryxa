/**
 * ════════════════════════════════════════════════════════════════════════════
 * PORTAL CHAT MODULE - Unified Exports
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * This is the single entry point for all chat-related functionality.
 * ORDER #0: Single Gateway Architecture
 * 
 * GUARDS: Contract (P10) + Idempotency (P09) + Stale (P11) + Security (P20)
 * TELEMETRY: PII-free logging (P19)
 * SEARCH: AbortController + cache (P21)
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

// ============================================================
// CONTRACTS (Single Source of Truth - FIX #4)
// ============================================================
export * from './contracts';

// ============================================================
// GUARDS (Contract + Idempotency + Stale)
// ============================================================
export * from './guards';

// Gateway (Single CRM communication point)
export { 
  sendChatMessage, 
  sendChatEvent, 
  sendChatAck,
  isAllowedEndpoint,
  isBlockedEndpoint,
  getGatewayEndpoint,
  BLOCKED_ENDPOINTS,
  type GatewayMessagePayload,
  type GatewayEventPayload,
  type GatewayAckPayload,
  type GatewayResponse,
} from './gateway';

// Constants (Legacy - use contracts instead)
export {
  SYSTEM_CONSTANTS,
  ACK_NAMES,
  INITIAL_CHAT_STATE,
  type ChatFlowState,
} from './constants';

// Validator (Fail-Closed enforcement - replaces old Sanitizer)
export {
  validateCardsQueryParams,
  VALIDATOR_EVENTS,
  type FilterValidationResult,
} from './sanitizer';

// State Machine (Chat → Intake → Consent → Ready → Search → Results)
export {
  createInitialChatState,
  shouldTriggerSearch,
  computeNextState,
  updateStateAfterSearch,
  resetChatState,
  shouldShowProgramsPanel,
  shouldShowSearchCTA,
  // Consent workflow
  detectConsentPhase,
  shouldShowConsentUI,
  shouldShowClarifyMessage,
  type CRMCardsQuery,
  type CRMUIDirectives,
  type ChatState,
  type ConsentState,
} from './state';

// Session Management
export {
  getOrCreateGuestSessionId,
  getOrCreateWebSessionId,
  getCurrentSessionId,
  getOrCreateThreadKey,
  getActiveThreadKey,
  setActiveThreadKey,
  getSessionType,
  setSessionType,
  getCustomerId,
  persistIdsFromResponse,
  createNewConversation,
  resetSession,
  clearAllSessionData,
  getSessionIdentifiers,
} from './session';

// History Management
export {
  loadThreadMessages,
  saveThreadMessages,
  upsertThread,
  deriveTitle,
  createNewThread,
  type HistoryMessage,
} from './history';

// Fast Router (ACK message selection)
export { fastRoute, type RouteResult } from './fastRouter';
