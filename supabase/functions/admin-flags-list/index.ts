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

  if (req.method !== "GET") return J({ ok: false }, 405);

  const url = new URL(req.url);
  const keysParam = url.searchParams.get("keys");
  
  let q = s.from("feature_flags").select("key,value");
  if (keysParam) {
    q = q.in("key", keysParam.split(",").map(k => k.trim()));
  }

  const { data, error } = await q;
  if (error) return J({ ok: false, error: String(error) }, 400);
  
  const map: Record<string, any> = {};
  (data || []).forEach((r: any) => map[r.key] = r.value);
  
  return J({ ok: true, flags: map });
});
