/**
 * ============================================================
 * PORTAL CHAT CONSTANTS - Re-export from Contracts
 * ============================================================
 * 
 * DEPRECATED: Use src/lib/chat/contracts directly
 * This file exists for backward compatibility only.
 */

// Re-export filter keys from contracts (Single Source of Truth)
export {
  HARD16_KEYS,
  HARD16_SET as CANONICAL_16_KEYS,
  LOCKED_KEYS,
  LOCKED_SET,
} from './contracts';

// TEXT_SEARCH_KEY is defined locally (keyword is NOT in filter sets)
export const TEXT_SEARCH_KEY = 'keyword' as const;

/**
 * System-level constants (injected by API, not by Portal)
 * These are NOT added to cards_query.params
 */
export const SYSTEM_CONSTANTS = {
  tuition_basis: 'year' as const,
} as const;

/**
 * Chat State Machine States
 */
export type ChatFlowState = 
  | 'CHAT'       // محادثة فقط
  | 'INTAKE'     // البوت يسأل لجمع الفلاتر
  | 'READY'      // جاهز للبحث (CTA "ابدأ البحث")
  | 'SEARCHING'  // Portal يطلب Catalog
  | 'RESULTS';   // عرض البطاقات

/**
 * Initial state for new sessions
 */
export const INITIAL_CHAT_STATE: ChatFlowState = 'CHAT';

/**
 * ACK names for CRM acknowledgment
 */
export const ACK_NAMES = {
  CARDS_RENDERED: 'cards_rendered',
  TAB_OPENED: 'tab_opened',
  SCROLLED_TO: 'scrolled_to',
  FIELD_HIGHLIGHTED: 'field_highlighted',
  NOTICE_SHOWN: 'notice_shown',
  MODAL_OPENED: 'modal_opened',
  DOCUMENT_FOCUSED: 'document_focused',
  CTA_FOCUSED: 'cta_focused',
  DATA_REFRESHED: 'data_refreshed',
  PROFILE_SAVED: 'profile_saved',
  PROGRAM_SELECTED: 'program_selected',
  SHORTLIST_TOGGLED: 'shortlist_toggled',
} as const;
