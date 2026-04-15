/**
 * ============================================================
 * PORTAL CRM RESPONSE CONTRACT - FIX #3
 * ============================================================
 * 
 * Defines the response structure from CRM.
 * Supports UNION of two reply formats:
 *   A) Reply Split: reply_key + reply_params
 *   B) Reply Text: reply_text
 * 
 * SECURITY: reply must be "display only" - no ops blobs.
 */

import { StageInfo, GuestState } from '@/types/chat';
import { ClientCapabilities, DEFAULT_CAPS } from './envelope';

// ============================================================
// REPLY FORMATS (Union)
// ============================================================

/**
 * Format A: Reply Split (i18n-ready)
 * Used when CRM wants Portal to localize the message.
 */
export interface ReplySplit {
  reply_key: string;
  reply_params?: Record<string, string | number>;
  reply?: string; // Optional fallback text
}

/**
 * Format B: Reply Text (pre-rendered)
 * Used when CRM sends already-localized text.
 */
export interface ReplyText {
  reply_text: string;
}

/**
 * Reply union type
 */
export type ReplyContent = ReplySplit | ReplyText;

// ============================================================
// UI DIRECTIVES
// ============================================================

export interface UIDirectives {
  /** Search trigger control */
  search_mode?: 'start' | 'hold';
  /** CRM build stamp for debugging */
  crm_build?: string;
  /** Phase indicator for Clarify/Consent/Start workflow */
  phase?: 'clarify' | 'awaiting_consent' | 'ready' | 'searching';
  /** Consent status from CRM */
  consent_status?: 'pending' | 'granted' | 'declined';
  /** Filter hash for consent validation */
  filters_hash?: string;
  /** Missing fields for Clarify phase */
  missing_fields?: string[];
  /** Hold reason from CRM */
  hold_reason?: string;
  /** Additional directives */
  [key: string]: unknown;
}

// ============================================================
// CARDS QUERY
// ============================================================

export interface CardsQuery {
  /** Unique query identifier */
  query_id: string;
  /** Sequence number for stale detection */
  sequence: number;
  /** Filter parameters (HARD16 + keyword) */
  params: Record<string, unknown>;
  /** Ranking filters (RANK10) */
  rank_filters?: Record<string, unknown>;
  /** Result limit */
  limit?: number;
}

// ============================================================
// EFFECTIVE CAPABILITIES (from CRM)
// ============================================================

/**
 * Effective capabilities - returned by CRM.
 * Portal MUST use these, not client-sent caps.
 */
export interface EffectiveCaps {
  /** Cards display allowed */
  cards: boolean;
  /** Tables supported */
  tables: boolean;
  /** Markdown level: none | limited | full */
  markdown: 'none' | 'limited' | 'full';
  /** Max chars per message */
  max_chars: number;
}

// ============================================================
// CRM RESPONSE
// ============================================================

export interface CRMResponse {
  ok: boolean;
  
  // Reply content (Union: ReplySplit | ReplyText)
  reply_key?: string;
  reply_params?: Record<string, string | number>;
  reply_text?: string;
  reply?: string; // Legacy fallback
  
  // UI Control
  ui_directives?: UIDirectives;
  
  // Cards query for Portal to fetch
  cards_query?: CardsQuery;
  
  // Effective capabilities (Portal MUST use these - FIX #2)
  effective_caps?: EffectiveCaps;
  
  // State & Auth
  state?: 'idle' | 'thinking' | 'awaiting_phone' | 'awaiting_otp' | 'awaiting_name' | 'searching' | 'awaiting_consent';
  customer_id?: string;
  session_id?: string;
  
  // Consent workflow fields
  phase?: 'clarify' | 'awaiting_consent' | 'ready' | 'searching';
  consent_status?: 'pending' | 'granted' | 'declined';
  filters_hash?: string;
  missing_fields?: string[];
  stage?: string;
  
  // Portal-specific
  ap_version?: string;
  stage_info?: StageInfo | null;
  guest_state?: GuestState | null;
  
  // Legacy fields
  messages?: Array<{
    from: 'user' | 'bot';
    type: 'text' | 'action' | 'universities';
    content: string;
    timestamp?: Date | string;
  }>;
  universities?: unknown[];
  need_phone?: boolean;
  need_name?: boolean;
  need_otp?: boolean;
  show_programs?: boolean;
  student_portal_token?: string;
}

// ============================================================
// RESPONSE PARSER
// ============================================================

export interface ParsedReply {
  /** Reply type: 'key' (needs i18n) or 'text' (direct display) */
  type: 'key' | 'text';
  /** For type='key': the translation key */
  key?: string;
  /** For type='key': parameters for interpolation */
  params?: Record<string, string | number>;
  /** For type='text': the text to display */
  text?: string;
}

/**
 * Parse CRM response reply content
 * Handles both ReplySplit and ReplyText formats
 */
export function parseReply(response: CRMResponse): ParsedReply | null {
  // Format A: Reply Split
  if (response.reply_key) {
    return {
      type: 'key',
      key: response.reply_key,
      params: response.reply_params,
    };
  }
  
  // Format B: Reply Text
  if (response.reply_text) {
    return {
      type: 'text',
      text: response.reply_text,
    };
  }
  
  // Legacy: reply field
  if (response.reply) {
    return {
      type: 'text',
      text: response.reply,
    };
  }
  
  return null;
}

/**
 * Get effective capabilities from CRM response.
 * If CRM doesn't return caps, use safe defaults (FIX #2).
 */
export function getEffectiveCaps(response: CRMResponse): EffectiveCaps {
  if (response.effective_caps) {
    return response.effective_caps;
  }
  
  // Safe defaults when CRM doesn't specify
  return {
    cards: DEFAULT_CAPS.cards,
    tables: DEFAULT_CAPS.supports_tables,
    markdown: DEFAULT_CAPS.supports_markdown === true ? 'full' 
      : DEFAULT_CAPS.supports_markdown === 'limited' ? 'limited' 
      : 'none',
    max_chars: DEFAULT_CAPS.max_message_chars,
  };
}

/**
 * Validate that reply content is safe (no ops blobs)
 */
export function validateReplyContent(response: CRMResponse): boolean {
  // Check reply_text is not an object
  if (response.reply_text && typeof response.reply_text !== 'string') {
    console.warn('[ResponseValidator] ⚠️ reply_text is not a string');
    return false;
  }
  
  // Check reply is not an object
  if (response.reply && typeof response.reply !== 'string') {
    console.warn('[ResponseValidator] ⚠️ reply is not a string');
    return false;
  }
  
  // Check reply_params values are primitives
  if (response.reply_params) {
    for (const [key, value] of Object.entries(response.reply_params)) {
      if (typeof value === 'object' && value !== null) {
        console.warn(`[ResponseValidator] ⚠️ reply_params.${key} is an object`);
        return false;
      }
    }
  }
  
  return true;
}
