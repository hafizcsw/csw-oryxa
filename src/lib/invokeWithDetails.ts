import { supabase } from "@/integrations/supabase/client";

export async function invokeWithDetails<T = any>(fn: string, body?: any): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || "";

  const baseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const url = `${baseUrl}/functions/v1/${fn}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let json: any = null;
  try { 
    json = text ? JSON.parse(text) : null; 
  } catch { 
    /* ignore */ 
  }

  if (!res.ok) {
    const errMsg =
      json?.error ||
      json?.message ||
      text ||
      res.statusText ||
      "Unknown error";
    const err = new Error(`${fn} failed (${res.status}): ${errMsg}`);
    (err as any).status = res.status;
    (err as any).details = json ?? text;
    throw err;
  }

  return json as T;
}

export function formatError(e: any) {
  if (!e) return "Unknown error";
  const status = e?.status ? `[${e.status}] ` : "";
  if (typeof e?.details === "string") return `${status}${e.message}\n${e.details}`;
  if (e?.details && typeof e.details === "object") {
    const safe = JSON.stringify(e.details, null, 2);
    return `${status}${e.message}\n${safe}`;
  }
  return `${status}${e.message || String(e)}`;
}
