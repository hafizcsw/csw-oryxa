import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const s = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function J(d: any, st = 200) {
  return new Response(JSON.stringify(d), {
    status: st,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const guard = await requireAdmin(req);
  if (!guard.ok) return J({ ok: false, error: guard.error }, guard.status);

  if (req.method !== "POST") return J({ ok: false }, 405);

  const body = await req.json().catch(() => ({}));
  
  // Supports two formats:
  // { key:"crm_enabled", value:{enabled:true} }
  // or { flags:{ crm_enabled:{...}, whatsapp_enabled:{...} } }
  const updates: Record<string, any> = body?.flags || (body?.key ? { [body.key]: body.value } : {});
  const rows = Object.entries(updates).map(([k, v]) => ({ key: k, value: v }));
  
  if (!rows.length) return J({ ok: false, error: "empty_payload" }, 400);

  const { error } = await s.from("feature_flags").upsert(rows);
  if (error) return J({ ok: false, error: String(error) }, 400);
  
  return J({ ok: true, updated: Object.keys(updates) });
});
