import { requireAuth } from "../_shared/authGuard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const g = await requireAuth(req);
  if (!g.ok) {
    return new Response(JSON.stringify({ error: g.error }), {
      status: g.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);

  const { contract_id } = await req.json();

  const { data: ct } = await srv
    .from("contracts")
    .select("pdf_path, student_user_id")
    .eq("id", contract_id)
    .single();

  if (!ct) {
    return new Response(JSON.stringify({ ok: false, error: "Contract not found" }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // الطالب لا يمكنه تنزيل عقد شخص آخر
  if (!g.isAdmin && ct.student_user_id !== g.user.id) {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!ct.pdf_path) {
    return new Response(JSON.stringify({ ok: false, error: "No PDF available" }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data: signed } = await srv.storage
    .from("contracts")
    .createSignedUrl(ct.pdf_path, 60 * 10); // 10 دقائق

  return new Response(JSON.stringify({ ok: true, url: signed?.signedUrl || null }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
