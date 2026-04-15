/**
 * ════════════════════════════════════════════════════════════════════════════
 * PORTAL GUARDS - Central Export
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * All guards in one place:
 * - Contract Guard (P10): Fail-closed validation
 * - Idempotency Guard (P09): Prevent double-send
 * - Security Guard (P20): Rate limit + size + XSS
 * - Stale Response Guard (P11): Drop late responses
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

// Contract Guard (P10)
export {
  // Types
  type ViolationType,
  type ContractViolation,
  type GuardResult,
  type StaleGuardState,
  // Functions
  validateSearchTrigger,
  validateCardsQuery,
  createStaleGuardState,
  isStaleResponse,
  updateStaleGuardState,
  // Events
  GUARD_EVENTS,
  createViolationEvent,
} from './contractGuard';

// Idempotency Guard (P09)
export {
  // Types
  type MessageSendState,
  type TrackedMessage,
  // Tracker
  idempotencyTracker,
  // Helpers
  createSendAttempt,
  completeSendAttempt,
} from './idempotencyGuard';

// Security Guard (P20)
export {
  // Config
  SECURITY_CONFIG,
  // Rate limiting
  checkRateLimit,
  recordRequest,
  resetRateLimiter,
  // Size validation
  validateMessageSize,
  type SizeValidationResult,
  // XSS protection
  escapeHtml,
  containsHtml,
  stripHtml,
  // Combined validation
  validateBeforeSend,
  type SendValidationResult,
} from './securityGuard';

// Stale Response Guard (P11)
export {
  // State management
  setActiveTurn,
  setActiveQuery,
  getActiveState,
  resetStaleGuardState,
  type ActiveTurnState,
  // Stale detection
  isResponseStale,
  areResultsStale,
  type StaleCheckResult,
} from './staleResponseGuard';
