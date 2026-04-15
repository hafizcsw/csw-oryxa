/**
 * ════════════════════════════════════════════════════════════════════════════
 * PORTAL TELEMETRY - PII-Free Event Logging (P19)
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * PRIVACY CONTRACT:
 * - NEVER send message_text, email, phone, or raw user content
 * - ONLY permitted: msg_len, flags, IDs, event names
 * 
 * This is the ONLY way to send Portal-specific telemetry.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================
// EVENT NAMES (Contract)
// ============================================================

export const PORTAL_EVENTS = {
  // Message lifecycle
  MESSAGE_SENT: 'PORTAL_MESSAGE_SENT',
  SEND_BLOCKED_DUP: 'PORTAL_SEND_BLOCKED_DUP',
  SEND_BLOCKED_RATE: 'PORTAL_SEND_BLOCKED_RATE',
  SEND_BLOCKED_SIZE: 'PORTAL_SEND_BLOCKED_SIZE',
  
  // CRM Response handling
  CRM_RESPONSE_RECEIVED: 'PORTAL_CRM_RESPONSE_RECEIVED',
  CRM_RESPONSE_DROPPED_STALE: 'PORTAL_CRM_RESPONSE_DROPPED_STALE',
  
  // Contract enforcement
  CONTRACT_VIOLATION: 'PORTAL_CONTRACT_VIOLATION',
  
  // Search lifecycle
  SEARCH_START_RECEIVED: 'PORTAL_SEARCH_START_RECEIVED',
  SEARCH_BLOCKED_HOLD: 'PORTAL_SEARCH_BLOCKED_HOLD',
  SEARCH_BLOCKED_CONTRACT: 'PORTAL_SEARCH_BLOCKED_CONTRACT',
  SEARCH_EXECUTED: 'PORTAL_SEARCH_EXECUTED',
  SEARCH_ABORTED: 'PORTAL_SEARCH_ABORTED',
  SEARCH_RESULTS_STALE: 'PORTAL_SEARCH_RESULTS_STALE',
  
  // ACK lifecycle
  ACK_SENT: 'PORTAL_ACK_SENT',
  ACK_SKIPPED_CONTRACT: 'PORTAL_ACK_SKIPPED_CONTRACT',
  ACK_FAILED: 'PORTAL_ACK_FAILED',

  // Reply guard
  REPLY_GUARD_BLOCKED: 'PORTAL_REPLY_GUARD_BLOCKED',
  REPLY_GUARD_PASSED: 'PORTAL_REPLY_GUARD_PASSED',
  PAGINATION_LOAD_MORE: 'PORTAL_PAGINATION_LOAD_MORE',
} as const;

export type PortalEventName = typeof PORTAL_EVENTS[keyof typeof PORTAL_EVENTS];

// ============================================================
// PAYLOAD TYPES (PII-Free)
// ============================================================

export interface BasePayload {
  timestamp: string;
  session_id?: string;
  turn_id?: string;
  trace_id?: string;
}

export interface MessagePayload extends BasePayload {
  msg_len: number;
  has_email: boolean;
  has_phone: boolean;
  retry_count?: number;
}

export interface SearchPayload extends BasePayload {
  query_id: string;
  sequence: number;
  filter_count: number;
  limit?: number;
}

export interface ContractViolationPayload extends BasePayload {
  violation_type: string;
  locked_keys?: string[];
  unknown_keys?: string[];
  partial_keys?: string[];
}

export interface AckPayload extends BasePayload {
  ack_name: string;
  query_id?: string;
  sequence?: number;
  count?: number;
  success: boolean;
}

export type PortalTelemetryPayload = 
  | MessagePayload 
  | SearchPayload 
  | ContractViolationPayload 
  | AckPayload
  | BasePayload;

// ============================================================
// PII DETECTION (Fail-Safe)
// ============================================================

const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /\+?[0-9]{10,15}/g,
};

/**
 * Check if text contains PII indicators
 * Returns flags instead of actual content
 */
export function detectPII(text: string): { has_email: boolean; has_phone: boolean } {
  return {
    has_email: PII_PATTERNS.email.test(text),
    has_phone: PII_PATTERNS.phone.test(text),
  };
}

/**
 * GUARDRAIL: Strip any potential PII from payload
 * Double-check before sending
 */
function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const blocked = ['text', 'message', 'message_text', 'content', 'email', 'phone', 'name'];
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(payload)) {
    if (blocked.includes(key.toLowerCase())) {
      // Replace with flag only
      if (typeof value === 'string') {
        sanitized[`${key}_len`] = value.length;
      }
      continue;
    }
    sanitized[key] = value;
  }
  
  return sanitized;
}

// ============================================================
// CORE TELEMETRY FUNCTION
// ============================================================

/**
 * Send Portal telemetry event
 * GUARANTEED PII-free
 */
export async function sendPortalEvent(
  event: PortalEventName,
  payload: PortalTelemetryPayload
): Promise<void> {
  try {
    // Sanitize payload (fail-safe)
    const safePayload = sanitizePayload(payload as unknown as Record<string, unknown>);
    
    // Build event data
    const eventData = {
      name: event,
      visitor_id: localStorage.getItem('visitor_id') || localStorage.getItem('malak_visitor_id') || '',
      properties: {
        ...safePayload,
        portal_event: true,
        timestamp: payload.timestamp || new Date().toISOString(),
      },
    };
    
    if (import.meta.env.DEV) {
      console.log('[PortalTelemetry] 📊', event, safePayload);
    }
    
    // Fire and forget
    supabase.functions.invoke('log-event', { body: eventData })
      .catch(e => {
        if (import.meta.env.DEV) {
          console.warn('[PortalTelemetry] Send failed:', e);
        }
      });
      
  } catch (e) {
    // Never throw - telemetry should not break the app
    if (import.meta.env.DEV) {
      console.warn('[PortalTelemetry] Error:', e);
    }
  }
}

// ============================================================
// CONVENIENCE HELPERS
// ============================================================

/**
 * Log message sent event
 */
export function logMessageSent(
  text: string,
  turnId: string,
  traceId: string,
  sessionId?: string,
  retryCount?: number
): void {
  const pii = detectPII(text);
  
  sendPortalEvent(PORTAL_EVENTS.MESSAGE_SENT, {
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    turn_id: turnId,
    trace_id: traceId,
    msg_len: text.length,
    has_email: pii.has_email,
    has_phone: pii.has_phone,
    retry_count: retryCount,
  });
}

/**
 * Log duplicate send blocked
 */
export function logDuplicateBlocked(turnId: string, traceId: string): void {
  sendPortalEvent(PORTAL_EVENTS.SEND_BLOCKED_DUP, {
    timestamp: new Date().toISOString(),
    turn_id: turnId,
    trace_id: traceId,
  });
}

/**
 * Log rate limit blocked
 */
export function logRateLimitBlocked(sessionId?: string): void {
  sendPortalEvent(PORTAL_EVENTS.SEND_BLOCKED_RATE, {
    timestamp: new Date().toISOString(),
    session_id: sessionId,
  });
}

/**
 * Log oversize blocked
 */
export function logOversizeBlocked(msgLen: number, maxLen: number): void {
  sendPortalEvent(PORTAL_EVENTS.SEND_BLOCKED_SIZE, {
    timestamp: new Date().toISOString(),
    msg_len: msgLen,
  } as MessagePayload);
}

/**
 * Log contract violation
 */
export function logContractViolation(
  violationType: string,
  queryId?: string,
  details?: {
    lockedKeys?: string[];
    unknownKeys?: string[];
    partialKeys?: string[];
  }
): void {
  sendPortalEvent(PORTAL_EVENTS.CONTRACT_VIOLATION, {
    timestamp: new Date().toISOString(),
    violation_type: violationType,
    query_id: queryId,
    locked_keys: details?.lockedKeys,
    unknown_keys: details?.unknownKeys,
    partial_keys: details?.partialKeys,
  } as ContractViolationPayload & { query_id?: string });
}

/**
 * Log stale response dropped
 */
export function logStaleResponseDropped(
  queryId: string,
  sequence: number,
  activeQueryId: string,
  activeSequence: number
): void {
  sendPortalEvent(PORTAL_EVENTS.CRM_RESPONSE_DROPPED_STALE, {
    timestamp: new Date().toISOString(),
    query_id: queryId,
    sequence,
    filter_count: 0, // Not applicable
  } as SearchPayload);
}

/**
 * Log ACK sent
 */
export function logAckSent(
  ackName: string,
  queryId: string,
  sequence: number,
  count: number,
  success: boolean
): void {
  sendPortalEvent(PORTAL_EVENTS.ACK_SENT, {
    timestamp: new Date().toISOString(),
    ack_name: ackName,
    query_id: queryId,
    sequence,
    count,
    success,
  });
}
