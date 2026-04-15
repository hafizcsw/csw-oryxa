import { supabase } from "@/integrations/supabase/client";
import { buildCrmHeaders } from "@/lib/crmHeaders";

export async function api(path: string, options: { method?: string; body?: any; headers?: Record<string, string>; timeout?: number } = {}) {
  const { method = "GET", body, headers, timeout = 30000 } = options;
  
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || "";
  
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1${path}`;
  
  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...buildCrmHeaders(),
        Authorization: `Bearer ${token}`,
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
    
    if (!res.ok) {
      // For 409 cursor_busy, return parsed body instead of throwing
      // so callers can handle it gracefully without triggering error overlays
      if (res.status === 409) {
        try {
          const json = await res.json();
          if (json?.status === "cursor_busy" || json?.status === "archived") {
            return json; // Let caller handle silently
          }
          throw new Error(JSON.stringify(json) || `HTTP 409`);
        } catch (e) {
          if (e instanceof Error && e.message !== 'Failed to execute \'text\' on \'Response\': body stream already read') throw e;
        }
      }
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    
    return res.json();
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error(`انتهت مهلة الطلب (${Math.round(timeout / 1000)}s) - الخادم بطيء، حاول مرة أخرى`);
    }
    throw err;
  }
}
