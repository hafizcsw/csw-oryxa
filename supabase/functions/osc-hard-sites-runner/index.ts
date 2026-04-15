import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { job_id, university_ids, max_rows = 5 } = body;
    if (!job_id) throw new Error("job_id required");

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/osc-hard-sites-worker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ job_id, university_ids, max_rows }),
    });
    const data = await resp.json();

    return new Response(JSON.stringify({ ok: true, result: data }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Access-Control-Allow-Origin": "*", "content-type": "application/json" },
    });
  }
});
