/**
 * ════════════════════════════════════════════════════════════════════════════
 * PORTAL SECURITY GUARD (P20)
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Client-side security before sending to CRM:
 * - Max chars limit (oversize protection)
 * - Rate limiting (spam protection)
 * - XSS-safe rendering helpers
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

import { logRateLimitBlocked, logOversizeBlocked } from '../telemetry';

// ============================================================
// CONFIGURATION
// ============================================================

export const SECURITY_CONFIG = {
  /** Maximum message length in characters */
  MAX_MESSAGE_LENGTH: 2000,
  
  /** Minimum time between requests in milliseconds */
  MIN_REQUEST_INTERVAL_MS: 1500,
  
  /** Maximum requests per minute */
  MAX_REQUESTS_PER_MINUTE: 20,
} as const;

// ============================================================
// RATE LIMITER
// ============================================================

interface RateLimitState {
  lastRequestTime: number;
  requestsInWindow: number;
  windowStart: number;
}

const rateLimitState: RateLimitState = {
  lastRequestTime: 0,
  requestsInWindow: 0,
  windowStart: Date.now(),
};

/**
 * Check if a request is allowed (rate limit)
 * Returns { allowed: boolean, waitMs: number }
 */
export function checkRateLimit(): { allowed: boolean; waitMs: number; reason?: string } {
  const now = Date.now();
  
  // Reset window if expired (1 minute)
  if (now - rateLimitState.windowStart > 60000) {
    rateLimitState.requestsInWindow = 0;
    rateLimitState.windowStart = now;
  }
  
  // Check requests per minute
  if (rateLimitState.requestsInWindow >= SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE) {
    const waitMs = 60000 - (now - rateLimitState.windowStart);
    logRateLimitBlocked();
    return { 
      allowed: false, 
      waitMs, 
      reason: 'max_requests_per_minute' 
    };
  }
  
  // Check minimum interval
  const elapsed = now - rateLimitState.lastRequestTime;
  if (elapsed < SECURITY_CONFIG.MIN_REQUEST_INTERVAL_MS) {
    const waitMs = SECURITY_CONFIG.MIN_REQUEST_INTERVAL_MS - elapsed;
    logRateLimitBlocked();
    return { 
      allowed: false, 
      waitMs, 
      reason: 'min_interval' 
    };
  }
  
  return { allowed: true, waitMs: 0 };
}

/**
 * Record a request (call after successful rate limit check)
 */
export function recordRequest(): void {
  rateLimitState.lastRequestTime = Date.now();
  rateLimitState.requestsInWindow++;
}

/**
 * Reset rate limiter (for new session)
 */
export function resetRateLimiter(): void {
  rateLimitState.lastRequestTime = 0;
  rateLimitState.requestsInWindow = 0;
  rateLimitState.windowStart = Date.now();
}

// ============================================================
// MESSAGE SIZE VALIDATION
// ============================================================

export interface SizeValidationResult {
  valid: boolean;
  length: number;
  maxLength: number;
  errorKey?: string;
}

/**
 * Validate message size
 */
export function validateMessageSize(text: string): SizeValidationResult {
  const length = text.length;
  const maxLength = SECURITY_CONFIG.MAX_MESSAGE_LENGTH;
  
  if (length > maxLength) {
    logOversizeBlocked(length, maxLength);
    return {
      valid: false,
      length,
      maxLength,
      errorKey: 'portal.errors.messageTooLong',
    };
  }
  
  return { valid: true, length, maxLength };
}

// ============================================================
// XSS PROTECTION
// ============================================================

/**
 * Escape HTML entities for safe text rendering
 * Use this for any user-generated content
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char] || char);
}

/**
 * Check if text contains potentially dangerous HTML
 */
export function containsHtml(text: string): boolean {
  return /<[^>]*>/g.test(text);
}

/**
 * Strip all HTML tags from text
 */
export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

// ============================================================
// COMBINED VALIDATION
// ============================================================

export interface SendValidationResult {
  canSend: boolean;
  errorKey?: string;
  waitMs?: number;
}

/**
 * Full pre-send validation
 * Checks rate limit + size in one call
 */
export function validateBeforeSend(text: string): SendValidationResult {
  // 1. Check rate limit
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    return {
      canSend: false,
      errorKey: 'portal.errors.tryAgain',
      waitMs: rateCheck.waitMs,
    };
  }
  
  // 2. Check size
  const sizeCheck = validateMessageSize(text);
  if (!sizeCheck.valid) {
    return {
      canSend: false,
      errorKey: sizeCheck.errorKey,
    };
  }
  
  return { canSend: true };
}
