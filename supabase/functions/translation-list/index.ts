import { requireAuth } from "../_shared/authGuard.ts";

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

  const url = new URL(req.url);
  const student_user_id = url.searchParams.get("student_user_id");
  const qid = (g.isAdmin && student_user_id) ? student_user_id : g.user.id;

  const { data, error } = await g.srv
    .from("translation_requests")
    .select("id, doc_kind, status, output_pdf_path, created_at, last_error")
    .eq("student_user_id", qid)
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: true, items: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
