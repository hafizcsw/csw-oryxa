/**
 * ============================================================
 * PORTAL ENVELOPE CONTRACT (Fakhamat) - FIX #1
 * ============================================================
 * 
 * Defines the exact request structure Portal sends to CRM.
 * Channel is a CONSTANT - never changes based on conditions.
 */

import { BUILD_ID } from '@/lib/program/validators';

// ============================================================
// CHANNEL CONSTANTS (LOCKED - NEVER CHANGE)
// ============================================================

/**
 * Channel values based on user authentication state.
 * These are the ONLY valid values.
 */
export const CHANNELS = {
  /** Authenticated user channel */
  WEB_PORTAL: 'web_portal',
  /** Guest user channel */
  WEB_CHAT: 'web_chat',
} as const;

export type ChannelType = typeof CHANNELS[keyof typeof CHANNELS];

/**
 * Entry function identifier for this Portal
 */
export const ENTRY_FN = 'portal-chat-ui' as const;

/**
 * Client build stamp for telemetry
 */
export const CLIENT_BUILD = `portal-${BUILD_ID}` as const;

// ============================================================
// REQUEST ENVELOPE TYPES
// ============================================================

/**
 * Canonical request structure for CRM communication
 */
export interface CanonicalRequest {
  /** Message type: message | event | ack */
  type: 'message' | 'event' | 'ack';
  
  // ============================================================
  // STAMPS (Fixed metadata)
  // ============================================================
  stamps: {
    /** Fixed channel based on auth state */
    channel: ChannelType;
    /** Entry point identifier */
    entry_fn: typeof ENTRY_FN;
    /** Client build version */
    client_build: string;
  };
  
  // ============================================================
  // IDENTIFIERS
  // ============================================================
  /** Turn ID - same for message + retry (immutable per message) */
  turn_id: string;
  /** Session ID - stable across conversation */
  session_id: string;
  /** Customer ID if known */
  customer_id: string | null;
  /** Trace ID - NEW for each send (including retry) */
  trace_id: string;
  
  // ============================================================
  // MESSAGE CONTENT
  // ============================================================
  /** Message text */
  message_text: string;
  
  // ============================================================
  // CLIENT CAPABILITIES (Hints only - NOT authoritative)
  // ============================================================
  channel_caps: ClientCapabilities;
}

/**
 * Client capabilities - HINT ONLY, not authoritative.
 * CRM returns effective_caps which Portal MUST use.
 */
export interface ClientCapabilities {
  /** Can display program cards */
  cards: boolean;
  /** Can render tables */
  supports_tables: boolean;
  /** Markdown rendering support level */
  supports_markdown: boolean | 'limited';
  /** Maximum message length displayable */
  max_message_chars: number;
}

/**
 * Default capabilities (safe defaults - assume limited)
 */
export const DEFAULT_CAPS: ClientCapabilities = {
  cards: true,
  supports_tables: false,
  supports_markdown: 'limited',
  max_message_chars: 4000,
};

// ============================================================
// BUILDERS
// ============================================================

/**
 * Get channel based on authentication state
 */
export function getChannel(isAuthenticated: boolean): ChannelType {
  return isAuthenticated ? CHANNELS.WEB_PORTAL : CHANNELS.WEB_CHAT;
}

/**
 * Create stamps object (fixed metadata)
 */
export function createStamps(isAuthenticated: boolean): CanonicalRequest['stamps'] {
  return {
    channel: getChannel(isAuthenticated),
    entry_fn: ENTRY_FN,
    client_build: CLIENT_BUILD,
  };
}

/**
 * Generate a new trace ID
 */
export function generateTraceId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a turn ID (stable for message + retries)
 */
export function generateTurnId(): string {
  return `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
