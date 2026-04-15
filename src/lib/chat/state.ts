/**
 * ============================================================
 * PORTAL CHAT STATE MACHINE
 * ============================================================
 * 
 * Manages chat flow state transitions:
 * CHAT → INTAKE → CONSENT → READY → SEARCHING → RESULTS
 * 
 * ============================================================
 * 3-PHASE WORKFLOW: Clarify → Consent → Start
 * ============================================================
 * 
 * Phase A (Clarify): CRM needs more info → missing_fields
 * Phase B (Consent): CRM has filters, needs user approval → awaiting_consent
 * Phase C (Start): CRM approves search → search_mode="start" + cards_query
 * 
 * Key Rule: Portal NEVER shows programs unless:
 * 1. CRM returns cards_query with valid query_id AND
 * 2. CRM explicitly sets ui_directives.search_mode === "start"
 * 
 * NO LEGACY MODE: If CRM doesn't send ui_directives, we do NOT search.
 */

import { ChatFlowState, INITIAL_CHAT_STATE } from './constants';

/**
 * CardsQuery from CRM response
 */
export interface CRMCardsQuery {
  query_id: string;
  sequence: number;
  params: Record<string, unknown>;
  limit?: number;
}

/**
 * UI Directives from CRM (optional)
 */
export interface CRMUIDirectives {
  search_mode?: 'start' | 'pending' | 'none' | 'hold';
  show_cta?: boolean;
  cta_text?: string;
  // Consent workflow fields
  phase?: 'clarify' | 'awaiting_consent' | 'ready' | 'searching';
  consent_status?: 'pending' | 'granted' | 'declined';
  filters_hash?: string;
  missing_fields?: string[];
  hold_reason?: string;
}

/**
 * Consent state for UI
 */
export interface ConsentState {
  required: boolean;
  status: 'pending' | 'granted' | 'declined';
  filters_hash: string | null;
  missing_fields: string[];
  hold_reason: string | null;
}

/**
 * Full chat state object
 */
export interface ChatState {
  flowState: ChatFlowState;
  cardsQuery: CRMCardsQuery | null;
  uiDirectives: CRMUIDirectives | null;
  searchTriggered: boolean;
  programsCount: number;
  lastQueryId: string | null;
  // Consent workflow
  consentState: ConsentState | null;
}

/**
 * Create initial chat state
 */
export function createInitialChatState(): ChatState {
  return {
    flowState: INITIAL_CHAT_STATE,
    cardsQuery: null,
    uiDirectives: null,
    searchTriggered: false,
    programsCount: 0,
    lastQueryId: null,
    consentState: null,
  };
}

/**
 * Check if CRM response indicates Consent phase
 * Returns ConsentState if consent is required, null otherwise
 */
export function detectConsentPhase(
  uiDirectives: CRMUIDirectives | null | undefined,
  rootPhase?: string,
  rootConsentStatus?: string,
  rootFiltersHash?: string
): ConsentState | null {
  // Check ui_directives first
  const phase = uiDirectives?.phase ?? rootPhase;
  const consentStatus = uiDirectives?.consent_status ?? rootConsentStatus;
  const filtersHash = uiDirectives?.filters_hash ?? rootFiltersHash;
  const missingFields = uiDirectives?.missing_fields ?? [];
  const holdReason = uiDirectives?.hold_reason ?? null;
  
  // Phase B: Consent required
  if (phase === 'awaiting_consent' || consentStatus === 'pending' || (filtersHash && consentStatus !== 'granted')) {
    console.log('[ChatState] 🔐 Consent phase detected', {
      phase,
      consent_status: consentStatus,
      filters_hash: filtersHash?.slice(0, 8),
    });
    return {
      required: true,
      status: (consentStatus as ConsentState['status']) || 'pending',
      filters_hash: filtersHash || null,
      missing_fields: missingFields,
      hold_reason: holdReason,
    };
  }
  
  // Phase A: Clarify (missing fields)
  if (phase === 'clarify' || (missingFields && missingFields.length > 0)) {
    console.log('[ChatState] ❓ Clarify phase detected', {
      phase,
      missing_fields: missingFields,
    });
    return {
      required: false, // Not consent, just clarification
      status: 'pending',
      filters_hash: null,
      missing_fields: missingFields,
      hold_reason: holdReason,
    };
  }
  
  return null;
}

/**
 * Determine if search should be triggered
 * 
 * ============================================================
 * STRICT MODE: ui_directives.search_mode ONLY
 * ============================================================
 * 
 * Portal triggers Catalog search ONLY if:
 * 1. cards_query is present with valid query_id AND
 * 2. ui_directives.search_mode === "start"
 * 
 * NOTE: root.search_mode fallback REMOVED until CRM provides Evidence
 * that it's an official contract field. This prevents silent desync.
 */
export function shouldTriggerSearch(
  cardsQuery: CRMCardsQuery | null | undefined,
  uiDirectives: CRMUIDirectives | null | undefined,
  _userClickedCTA: boolean = false // Unused in Option A (kept for API compatibility)
): boolean {
  // Rule 1: No cards_query = no search (fail-closed)
  if (!cardsQuery) {
    console.log('[ChatState] ⛔ No cards_query, search blocked');
    return false;
  }
  
  // Rule 2: No query_id = no search (fail-closed)
  if (!cardsQuery.query_id) {
    console.log('[ChatState] ⛔ cards_query missing query_id, search blocked');
    return false;
  }
  
  // Rule 3: STRICT - Only ui_directives.search_mode matters
  // NO root.search_mode fallback (requires CRM Evidence to enable)
  const searchMode = uiDirectives?.search_mode;
  
  if (searchMode === 'start') {
    console.log('[ChatState] ✅ ui_directives.search_mode=start, triggering search', {
      query_id: cardsQuery.query_id,
    });
    return true;
  }
  
  // Rule 4: HOLD - search_mode is not "start" or undefined
  console.log('[ChatState] ⛔ HOLD: search_mode is not "start"', {
    query_id: cardsQuery.query_id,
    search_mode: searchMode ?? 'undefined',
    action: 'SEARCH_BLOCKED'
  });
  
  return false;
}

/**
 * Compute next flow state based on CRM response
 */
export function computeNextState(
  currentState: ChatState,
  crmResponse: {
    cards_query?: CRMCardsQuery;
    ui_directives?: CRMUIDirectives;
    state?: string;
    phase?: string;
    consent_status?: string;
    filters_hash?: string;
  },
  userAction?: 'cta_clicked' | 'message_sent' | 'consent_granted'
): ChatState {
  const { cards_query, ui_directives, state: crmState, phase, consent_status, filters_hash } = crmResponse;
  
  // Start from current state
  let newState = { ...currentState };
  
  // Update cards_query if present
  if (cards_query) {
    newState.cardsQuery = cards_query;
    newState.lastQueryId = cards_query.query_id;
  }
  
  // Update ui_directives if present
  if (ui_directives) {
    newState.uiDirectives = ui_directives;
  }
  
  // Check for Consent/Clarify phase
  const consentState = detectConsentPhase(ui_directives, phase, consent_status, filters_hash);
  newState.consentState = consentState;
  
  // Determine flow state (STRICT: ui_directives.search_mode only)
  if (shouldTriggerSearch(cards_query, ui_directives, userAction === 'cta_clicked')) {
    newState.flowState = 'SEARCHING';
    newState.searchTriggered = true;
    newState.consentState = null; // Clear consent after search starts
  } else if (consentState?.required) {
    // Consent required - show consent UI
    newState.flowState = 'INTAKE'; // Reuse INTAKE for consent
    newState.searchTriggered = false;
  } else if (consentState?.missing_fields?.length) {
    // Clarify phase - need more info
    newState.flowState = 'INTAKE';
    newState.searchTriggered = false;
  } else if (cards_query && ui_directives?.show_cta) {
    // CRM wants us to show CTA before search
    newState.flowState = 'READY';
    newState.searchTriggered = false;
  } else if (crmState === 'awaiting_phone' || crmState === 'awaiting_otp' || crmState === 'awaiting_name') {
    newState.flowState = 'INTAKE';
  } else if (crmState === 'awaiting_consent') {
    newState.flowState = 'INTAKE';
  } else {
    newState.flowState = 'CHAT';
  }
  
  return newState;
}

/**
 * Update state after search completes
 */
export function updateStateAfterSearch(
  currentState: ChatState,
  programsCount: number
): ChatState {
  return {
    ...currentState,
    flowState: 'RESULTS',
    programsCount,
  };
}

/**
 * Reset state for new conversation
 */
export function resetChatState(): ChatState {
  return createInitialChatState();
}

/**
 * Check if programs panel should be visible
 */
export function shouldShowProgramsPanel(state: ChatState): boolean {
  return state.flowState === 'RESULTS' && state.programsCount > 0;
}

/**
 * Check if CTA should be visible
 */
export function shouldShowSearchCTA(state: ChatState): boolean {
  return state.flowState === 'READY' && 
    state.cardsQuery !== null && 
    !state.searchTriggered;
}

/**
 * Check if consent UI should be visible
 */
export function shouldShowConsentUI(state: ChatState): boolean {
  return state.consentState?.required === true && 
    state.consentState?.status === 'pending';
}

/**
 * Check if clarify message should be shown
 */
export function shouldShowClarifyMessage(state: ChatState): boolean {
  return (state.consentState?.missing_fields?.length ?? 0) > 0 && 
    !state.consentState?.required;
}
