/**
 * ✅ Portal Invoke - Unified API for Portal Edge Function
 * All frontend calls go through student-portal-api only
 */
import { supabase } from "@/integrations/supabase/client";

export async function portalInvoke<T = unknown>(
  action: string, 
  payload: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: T; error?: string; details?: string; http_status?: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    return { ok: false, error: 'NO_SESSION', details: 'يجب تسجيل الدخول أولاً' };
  }

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
}
