/**
 * crmBridge — single client-side gateway to the CRM bridge.
 *
 * All Step 3 hooks/components MUST go through this module. It is the only
 * file in the Portal that knows the action names and the invocation shape.
 *
 * Contract:
 *   - Edge function: 'student-portal-api' (Supabase functions invoke).
 *   - Body: { action, trace_id, ...payload }.
 *   - Response: { ok: boolean, data?: unknown, error?: string, details?: unknown, http_status?: number }.
 *
 * Boundary rules (Step 3):
 *   - DO NOT use any comm_* table, hook, or function.
 *   - DO NOT route to /messages.
 *   - Only the 7 endpoints declared in CrmAction below are allowed.
 *
 * Field names mirror the CRM bridge contract exactly. No invented fields.
 */
import { supabase } from '@/integrations/supabase/client';

export type CrmAction =
  | 'identity_case_get'
  | 'support_case_list'
  | 'support_case_get'
  | 'support_messages_list'
  | 'support_message_send'
  | 'support_mark_read'
  | 'support_case_close';

export interface CrmEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  details?: unknown;
  http_status?: number;
  trace_id: string;
}

function newTraceId(action: CrmAction): string {
  const rand = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return `${action}-${rand}`;
}

export async function crmInvoke<T = unknown>(
  action: CrmAction,
  payload: Record<string, unknown> = {},
): Promise<CrmEnvelope<T>> {
  const trace_id = newTraceId(action);
  const body = { action, trace_id, ...payload };

  const { data, error } = await supabase.functions.invoke('student-portal-api', { body });

  if (error) {
    return {
      ok: false,
      error: error.message || 'invoke_failed',
      details: error,
      trace_id,
    };
  }

  const env = (data ?? {}) as Partial<CrmEnvelope<T>>;
  return {
    ok: !!env.ok,
    data: env.data as T | undefined,
    error: env.error,
    details: env.details,
    http_status: env.http_status,
    trace_id,
  };
}

// --- Bridge contract types ---

export interface SupportCase {
  case_id: string;
  subject?: string | null;
  status?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  unread_for_customer?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SupportMessage {
  id: string;
  case_id?: string;
  body: string;
  sender_type: 'customer' | 'staff' | 'system' | string;
  author_display?: string | null;
  message_kind?: string | null;
  visible_to_customer?: boolean;
  created_at: string;
}

export interface SupportMessageSendData {
  ok: true;
  message: {
    id: string;
    sender_type: 'customer';
    created_at: string;
  };
}

export interface SupportMarkReadData {
  ok: true;
  case_id: string;
  read_at: string;
  unread_for_customer: false;
}

export interface SupportCaseCloseData {
  ok: true;
  case_id: string;
  status: 'closed';
  closed_at: string;
}

export interface IdentityAttempt {
  status: string;
  student_visible_note?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string | null;
  attempt_no?: number;
}

export interface IdentityCase {
  case: {
    current_attempt: IdentityAttempt | null;
    previous_attempts: IdentityAttempt[];
  };
}

export interface IdentityLink {
  status?: string | null;
  attempt_no?: number | null;
  reviewed_at?: string | null;
  student_visible_note?: string | null;
  [k: string]: unknown;
}

export interface SupportCaseEnvelope {
  case: SupportCase;
  identity_link?: IdentityLink | null;
}

export interface SupportCaseListData {
  cases: SupportCase[];
}

export interface SupportMessagesListData {
  messages: SupportMessage[];
}

// --- Typed thin wrappers (one per allowed action) ---

export const crm = {
  listSupportCases: () => crmInvoke<SupportCaseListData>('support_case_list'),
  getSupportCase: (case_id: string) => crmInvoke<SupportCaseEnvelope>('support_case_get', { case_id }),
  listSupportMessages: (case_id: string) =>
    crmInvoke<SupportMessagesListData>('support_messages_list', { case_id }),
  sendSupportMessage: (case_id: string, body: string) =>
    crmInvoke<SupportMessageSendData>('support_message_send', { case_id, body }),
  markSupportRead: (case_id: string) => crmInvoke<SupportMarkReadData>('support_mark_read', { case_id }),
  closeSupportCase: (case_id: string) => crmInvoke<SupportCaseCloseData>('support_case_close', { case_id }),
  getIdentityCase: () => crmInvoke<IdentityCase>('identity_case_get'),
};
