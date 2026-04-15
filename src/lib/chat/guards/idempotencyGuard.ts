/**
 * ============================================================
 * PORTAL IDEMPOTENCY GUARD - Prevent Double-Send
 * ============================================================
 * 
 * Tracks message send state to prevent duplicates.
 * State machine: draft → sending → sent|failed
 */

// ============================================================
// TYPES
// ============================================================

export type MessageSendState = 'draft' | 'sending' | 'sent' | 'failed';

export interface TrackedMessage {
  /** Turn ID (stable for message + retries) */
  turnId: string;
  /** Message text (immutable) */
  text: string;
  /** Current state */
  state: MessageSendState;
  /** Trace IDs for each send attempt */
  traceIds: string[];
  /** Timestamp of state change */
  updatedAt: Date;
}

// ============================================================
// IDEMPOTENCY TRACKER
// ============================================================

class IdempotencyTracker {
  private messages = new Map<string, TrackedMessage>();
  private currentSendingTurnId: string | null = null;
  
  /**
   * Check if we can send a message
   * Returns false if another message is currently sending
   */
  canSend(turnId: string): boolean {
    // If same turn is already sending, this is a duplicate
    if (this.currentSendingTurnId === turnId) {
      console.warn('[Idempotency] ⚠️ Blocked duplicate send for turn:', turnId);
      return false;
    }
    
    // If another turn is sending, block
    if (this.currentSendingTurnId) {
      console.warn('[Idempotency] ⚠️ Blocked send - another message in progress:', this.currentSendingTurnId);
      return false;
    }
    
    return true;
  }
  
  /**
   * Mark message as sending
   */
  startSend(turnId: string, text: string, traceId: string): void {
    const existing = this.messages.get(turnId);
    
    if (existing) {
      // Retry - add new trace ID
      existing.traceIds.push(traceId);
      existing.state = 'sending';
      existing.updatedAt = new Date();
    } else {
      // New message
      this.messages.set(turnId, {
        turnId,
        text,
        state: 'sending',
        traceIds: [traceId],
        updatedAt: new Date(),
      });
    }
    
    this.currentSendingTurnId = turnId;
  }
  
  /**
   * Mark message as sent
   */
  markSent(turnId: string): void {
    const msg = this.messages.get(turnId);
    if (msg) {
      msg.state = 'sent';
      msg.updatedAt = new Date();
    }
    
    if (this.currentSendingTurnId === turnId) {
      this.currentSendingTurnId = null;
    }
  }
  
  /**
   * Mark message as failed
   */
  markFailed(turnId: string): void {
    const msg = this.messages.get(turnId);
    if (msg) {
      msg.state = 'failed';
      msg.updatedAt = new Date();
    }
    
    if (this.currentSendingTurnId === turnId) {
      this.currentSendingTurnId = null;
    }
  }
  
  /**
   * Get message state
   */
  getState(turnId: string): MessageSendState | null {
    return this.messages.get(turnId)?.state ?? null;
  }
  
  /**
   * Check if message is retryable
   */
  canRetry(turnId: string): boolean {
    const state = this.getState(turnId);
    return state === 'failed';
  }
  
  /**
   * Get retry count for a message
   */
  getRetryCount(turnId: string): number {
    const msg = this.messages.get(turnId);
    return msg ? Math.max(0, msg.traceIds.length - 1) : 0;
  }
  
  /**
   * Clear old messages (cleanup)
   */
  cleanup(maxAgeMs: number = 5 * 60 * 1000): void {
    const now = Date.now();
    for (const [turnId, msg] of this.messages) {
      if (now - msg.updatedAt.getTime() > maxAgeMs) {
        this.messages.delete(turnId);
      }
    }
  }
  
  /**
   * Reset tracker (for new conversation)
   */
  reset(): void {
    this.messages.clear();
    this.currentSendingTurnId = null;
  }
}

// Singleton instance
export const idempotencyTracker = new IdempotencyTracker();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create a send attempt with idempotency tracking
 */
export function createSendAttempt(
  text: string,
  existingTurnId?: string
): { turnId: string; traceId: string; canSend: boolean } {
  const turnId = existingTurnId || `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const traceId = crypto.randomUUID();
  
  const canSend = idempotencyTracker.canSend(turnId);
  
  if (canSend) {
    idempotencyTracker.startSend(turnId, text, traceId);
  }
  
  return { turnId, traceId, canSend };
}

/**
 * Complete a send attempt
 */
export function completeSendAttempt(turnId: string, success: boolean): void {
  if (success) {
    idempotencyTracker.markSent(turnId);
  } else {
    idempotencyTracker.markFailed(turnId);
  }
}
