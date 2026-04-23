/**
 * ✅ Portal Invoke - Unified API for Portal Edge Function
 * All frontend calls go through student-portal-api only
 */
import { supabase } from "@/integrations/supabase/client";

// In-flight request dedupe: collapses concurrent identical calls into one
// network request. Critical for actions that many components fire on mount
// (e.g. resolve_staff_authority) to avoid stampeding the edge function and
// triggering 504 IDLE_TIMEOUT.
const inflight = new Map<string, Promise<any>>();

const DEDUPE_ACTIONS = new Set([
  'resolve_staff_authority',
  'resolve_teacher_approval',
  'resolve_course_access',
]);

export async function portalInvoke<T = unknown>(
  action: string, 
  payload: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: T; error?: string; details?: string; http_status?: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    return { ok: false, error: 'NO_SESSION', details: 'يجب تسجيل الدخول أولاً' };
  }

  const dedupeKey = DEDUPE_ACTIONS.has(action)
    ? `${action}::${session.user.id}::${JSON.stringify(payload)}`
    : null;

  if (dedupeKey && inflight.has(dedupeKey)) {
    return inflight.get(dedupeKey)!;
  }

  const exec = (async () => {
  try {
    const { data, error } = await supabase.functions.invoke('student-portal-api', {
      body: { action, ...payload },
    });

    if (error) {
      console.error('[portalInvoke] Error:', error);
      return {
        ok: false,
        error: 'INVOKE_ERROR',
        details: error.message,
      };
    }

    const response = (data ?? {}) as any;

    // Edge wrapper contract: { ok, data, error, details, http_status }
    if (response?.ok === false) {
      return {
        ok: false,
        error: response.error || 'UNKNOWN_ERROR',
        details: response.details || response.message,
        http_status: response.http_status,
      };
    }

    // Normalize successful payload for callers to receive inner data directly.
    if (response && typeof response === 'object' && 'ok' in response) {
      const normalizedData = 'data' in response ? response.data : response;
      return {
        ok: true,
        data: normalizedData as T,
        http_status: response.http_status,
      };
    }

    // Backward compatibility for direct payload responses.
    return { ok: true, data: response as T };
  } catch (err) {
    console.error('[portalInvoke] Network error:', err);
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      details: err instanceof Error ? err.message : String(err),
    };
  }
  })();

  if (dedupeKey) {
    inflight.set(dedupeKey, exec);
    exec.finally(() => inflight.delete(dedupeKey));
  }

  return exec;
}
