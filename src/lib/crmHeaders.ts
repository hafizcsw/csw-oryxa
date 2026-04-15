import { getClientTraceId } from '@/lib/workflow/tracing';

const TRACE_KEY = 'portal_client_trace_id';
const LEGACY_TRACE_KEY = 'chat_last_trace_id';
const MAX_TRACE_LENGTH = 128;

function persistTraceId(traceId: string): string {
  const normalized = traceId.slice(0, MAX_TRACE_LENGTH);
  localStorage.setItem(TRACE_KEY, normalized);
  localStorage.setItem(LEGACY_TRACE_KEY, normalized);
  return normalized;
}

export function getCrmTraceId(traceId?: string): string {
  const candidate = traceId?.trim();
  if (candidate) return persistTraceId(candidate);

  const stored = localStorage.getItem(TRACE_KEY) || localStorage.getItem(LEGACY_TRACE_KEY);
  if (stored && stored.trim()) return persistTraceId(stored.trim());

  return persistTraceId(getClientTraceId());
}

export function createAndStoreCrmTraceId(): string {
  return persistTraceId(crypto.randomUUID());
}

export function buildCrmHeaders(input: { studentPortalToken?: string; traceId?: string } = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    'x-orxya-ingress': 'portal',
    'x-client-trace-id': getCrmTraceId(input.traceId),
  };

  if (input.studentPortalToken) headers['x-student-portal-token'] = input.studentPortalToken;

  return headers;
}
