/**
 * ═══════════════════════════════════════════════════════════════════════
 * DRAFT-FIRST UPLOAD GUARD (Phase 1)
 * ─────────────────────────────────────────────────────────────────────
 * Central gate for any CRM-bound upload operation (prepare_upload,
 * confirm_upload, mark_files_saved).
 *
 * Contract — Phase 1 is GUARD ONLY:
 *  • Sensitive student contexts are BLOCKED while in pre-confirm state.
 *  • unknown context = BLOCKED with a clear, readable error.
 *  • post_confirm is allowed ONLY if a `confirmationTraceId` is provided.
 *  • This file does NOT implement the Draft layer (Phase 2+).
 *
 * No Phase 2 claims. No "upload works" claims. Only gate + log.
 * ═══════════════════════════════════════════════════════════════════════
 */

export type UploadContext =
  // ── sensitive student document contexts (MUST go Draft-first) ──
  | 'study_file'
  | 'my_files'
  | 'passport'
  | 'certificate'
  | 'transcript'
  | 'language_certificate'
  | 'academic_document'
  | 'identity_document'
  // ── operational / non-sensitive contexts (exempt in Phase 1) ──
  | 'avatar'
  | 'payment_proof'
  // ── fallback ──
  | 'unknown';

export type ConfirmationState = 'pre_confirm' | 'post_confirm';

export interface UploadGuardContext {
  context: UploadContext;
  confirmationState: ConfirmationState;
  /** Required when confirmationState === 'post_confirm'. Opaque trace from a real user confirmation event. */
  confirmationTraceId?: string;
  /** Optional short description of the attempted action (for logs). */
  attemptedAction?: string;
}

export type CrmGuardedAction =
  | 'prepare_upload'
  | 'confirm_upload'
  | 'mark_files_saved';

export interface GuardDecision {
  allowed: boolean;
  reason?:
    | 'draft_first_disabled'
    | 'context_exempt'
    | 'post_confirm_allowed'
    | 'blocked_pre_confirm_crm_upload'
    | 'draft_first_context_required'
    | 'post_confirm_missing_trace';
  errorCode?: string;
  errorMessage?: string;
  traceId: string;
}

/** Contexts that must go through Draft-first. */
const SENSITIVE_CONTEXTS: ReadonlySet<UploadContext> = new Set([
  'study_file',
  'my_files',
  'passport',
  'certificate',
  'transcript',
  'language_certificate',
  'academic_document',
  'identity_document',
]);

/** Contexts intentionally exempt in Phase 1 (not student-sensitive docs). */
const EXEMPT_CONTEXTS: ReadonlySet<UploadContext> = new Set([
  'avatar',
  'payment_proof',
]);

/** True if the given upload context is a sensitive student document context. */
export function isSensitiveUploadContext(ctx: UploadContext | undefined | null): boolean {
  if (!ctx) return false;
  return SENSITIVE_CONTEXTS.has(ctx);
}

/**
 * Detect production environment. In production, Draft-first is FORCED ON.
 * Checks Vite's import.meta.env.PROD and MODE === 'production'. Any attempt
 * to disable via VITE_DRAFT_FIRST_UPLOADS in production is rejected and logged.
 */
function isProductionEnv(): boolean {
  try {
    const env = (import.meta as any)?.env;
    if (env?.PROD === true) return true;
    if (env?.MODE === 'production') return true;
    if (typeof window !== 'undefined') {
      const host = window.location?.hostname ?? '';
      // Production domains per project URLs.
      if (
        host === 'orxya.org' ||
        host === 'www.cswworld.com' ||
        host === 'cswworld.com' ||
        host.endsWith('.lovable.app') // published lovable domains
      ) {
        // preview subdomain is still preview — keep it disable-able there.
        if (host.startsWith('id-preview--')) return false;
        return true;
      }
    }
  } catch {
    /* noop */
  }
  return false;
}

/**
 * Is the Draft-first guard active?
 *
 * Rules:
 *  • Production → FORCED ON. Any disable attempt is logged and ignored.
 *  • Dev / preview → ON by default. Disable via VITE_DRAFT_FIRST_UPLOADS="false".
 */
export function isDraftFirstEnabled(): boolean {
  const prod = isProductionEnv();
  let envWantsOff = false;
  try {
    const v = (import.meta as any)?.env?.VITE_DRAFT_FIRST_UPLOADS;
    if (v === false || v === 'false' || v === '0') envWantsOff = true;
  } catch {
    /* noop */
  }

  if (prod && envWantsOff) {
    // eslint-disable-next-line no-console
    console.error('[draftFirstGuard] draft_first_disable_attempt_rejected', {
      marker: 'draft_first_disable_attempt_rejected',
      env_value: 'false',
      environment: 'production',
      effective_state: 'ON',
    });
    return true;
  }

  if (envWantsOff) return false;
  return true;
}

function newTraceId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `df_${crypto.randomUUID()}`;
    }
  } catch {
    /* noop */
  }
  return `df_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

interface GuardLogPayload {
  marker: string;
  crm_action: CrmGuardedAction;
  upload_context: UploadContext;
  confirmation_state: ConfirmationState;
  confirmation_trace_id?: string;
  trace_id: string;
  attempted_action?: string;
  decision_reason: GuardDecision['reason'];
  error_code?: string;
}

function logGuard(payload: GuardLogPayload, level: 'warn' | 'info' = 'info') {
  const line = `[draftFirstGuard] ${payload.marker}`;
  // Plain console so it appears in both DEV and PROD preview inspection.
  // eslint-disable-next-line no-console
  (level === 'warn' ? console.warn : console.log)(line, payload);
}

/**
 * Decide whether a CRM-bound upload action is allowed to proceed.
 * Side effect: emits a structured console log for every decision on sensitive contexts.
 */
export function evaluateUploadGuard(
  action: CrmGuardedAction,
  ctx: UploadGuardContext | undefined,
): GuardDecision {
  const traceId = newTraceId();

  // Guard disabled → pass through, but still log sensitive attempts for visibility.
  if (!isDraftFirstEnabled()) {
    return { allowed: true, reason: 'draft_first_disabled', traceId };
  }

  // Missing / malformed context → block with readable error.
  if (!ctx || !ctx.context) {
    const decision: GuardDecision = {
      allowed: false,
      reason: 'draft_first_context_required',
      errorCode: 'draft_first_context_required',
      errorMessage:
        'This upload path needs a Draft-first upgrade before it can reach CRM.',
      traceId,
    };
    logGuard(
      {
        marker: 'draft_first_blocked_unknown_context',
        crm_action: action,
        upload_context: 'unknown',
        confirmation_state: ctx?.confirmationState ?? 'pre_confirm',
        confirmation_trace_id: ctx?.confirmationTraceId,
        trace_id: traceId,
        attempted_action: ctx?.attemptedAction,
        decision_reason: decision.reason,
        error_code: decision.errorCode,
      },
      'warn',
    );
    return decision;
  }

  // Exempt contexts (avatar, payment_proof) — Phase 1 does not touch them.
  if (EXEMPT_CONTEXTS.has(ctx.context)) {
    return { allowed: true, reason: 'context_exempt', traceId };
  }

  // Sensitive contexts — must satisfy confirmation contract.
  if (SENSITIVE_CONTEXTS.has(ctx.context)) {
    if (ctx.confirmationState === 'post_confirm') {
      if (!ctx.confirmationTraceId) {
        const decision: GuardDecision = {
          allowed: false,
          reason: 'post_confirm_missing_trace',
          errorCode: 'draft_first_post_confirm_missing_trace',
          errorMessage:
            'post_confirm requires an explicit confirmationTraceId — no blanket overrides.',
          traceId,
        };
        logGuard(
          {
            marker: 'blocked_pre_confirm_crm_upload',
            crm_action: action,
            upload_context: ctx.context,
            confirmation_state: ctx.confirmationState,
            confirmation_trace_id: ctx.confirmationTraceId,
            trace_id: traceId,
            attempted_action: ctx.attemptedAction,
            decision_reason: decision.reason,
            error_code: decision.errorCode,
          },
          'warn',
        );
        return decision;
      }
      logGuard(
        {
          marker: 'draft_first_post_confirm_allowed',
          crm_action: action,
          upload_context: ctx.context,
          confirmation_state: ctx.confirmationState,
          confirmation_trace_id: ctx.confirmationTraceId,
          trace_id: traceId,
          attempted_action: ctx.attemptedAction,
          decision_reason: 'post_confirm_allowed',
        },
        'info',
      );
      return { allowed: true, reason: 'post_confirm_allowed', traceId };
    }

    // pre_confirm for sensitive → BLOCK.
    const decision: GuardDecision = {
      allowed: false,
      reason: 'blocked_pre_confirm_crm_upload',
      errorCode: 'blocked_pre_confirm_crm_upload',
      errorMessage:
        'Draft-first migration is active. This document must be drafted in the Portal before being shared with CSW.',
      traceId,
    };
    logGuard(
      {
        marker: 'blocked_pre_confirm_crm_upload',
        crm_action: action,
        upload_context: ctx.context,
        confirmation_state: ctx.confirmationState,
        confirmation_trace_id: ctx.confirmationTraceId,
        trace_id: traceId,
        attempted_action: ctx.attemptedAction,
        decision_reason: decision.reason,
        error_code: decision.errorCode,
      },
      'warn',
    );
    return decision;
  }

  // Any other value (shouldn't happen if types are honored) → treat as unknown.
  const decision: GuardDecision = {
    allowed: false,
    reason: 'draft_first_context_required',
    errorCode: 'draft_first_context_required',
    errorMessage:
      'This upload path needs a Draft-first upgrade before it can reach CRM.',
    traceId,
  };
  logGuard(
    {
      marker: 'draft_first_blocked_unknown_context',
      crm_action: action,
      upload_context: ctx.context,
      confirmation_state: ctx.confirmationState,
      confirmation_trace_id: ctx.confirmationTraceId,
      trace_id: traceId,
      attempted_action: ctx.attemptedAction,
      decision_reason: decision.reason,
      error_code: decision.errorCode,
    },
    'warn',
  );
  return decision;
}

/** Convenience for callers that want a shaped error envelope. */
export function guardErrorEnvelope(decision: GuardDecision) {
  return {
    ok: false as const,
    error: decision.errorCode ?? 'blocked_pre_confirm_crm_upload',
    details: decision.errorMessage ?? 'Draft-first guard blocked this call.',
    trace_id: decision.traceId,
    blocked_by_draft_first: true as const,
  };
}

/** Log when auto-save is suppressed under Draft-first. */
export function logAutoSaveSuppressed(payload: {
  upload_context: UploadContext;
  document_ids: string[];
  analysis_terminal_state?: string;
  user_id?: string | null;
}) {
  logGuard(
    {
      marker: 'auto_mark_files_saved_suppressed',
      crm_action: 'mark_files_saved',
      upload_context: payload.upload_context,
      confirmation_state: 'pre_confirm',
      trace_id: newTraceId(),
      attempted_action: `auto_terminal_${payload.analysis_terminal_state ?? 'unknown'}`,
      decision_reason: 'blocked_pre_confirm_crm_upload',
      error_code: 'auto_save_suppressed',
    },
    'warn',
  );
  // eslint-disable-next-line no-console
  console.warn('[draftFirstGuard] auto_mark_files_saved_suppressed', payload);
}
