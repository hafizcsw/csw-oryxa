import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const check = await requireAdmin(req);
    if (!check.ok) {
      return new Response(
        JSON.stringify({ error: check.error }),
        { status: check.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = check.srv;

    const results: Record<string, string> = {};

    // 1. source_evidence (bigint id, FK → program_draft)
    const r1 = await supabase.from("source_evidence").delete().neq("id", 0);
    results.source_evidence = r1.error ? `error: ${r1.error.message}` : "deleted";

    // 2. program_related_urls (no id col, FK → program_draft + program_urls)
    const r2 = await supabase.from("program_related_urls").delete().gte("created_at", "2000-01-01");
    results.program_related_urls = r2.error ? `error: ${r2.error.message}` : "deleted";

    // 3. program_draft (bigint id)
    const r3 = await supabase.from("program_draft").delete().neq("id", 0);
    results.program_draft = r3.error ? `error: ${r3.error.message}` : "deleted";

    // 4. program_urls (bigint id)
    const r4 = await supabase.from("program_urls").delete().neq("id", 0);
    results.program_urls = r4.error ? `error: ${r4.error.message}` : "deleted";

    // 5. ingest_errors (bigint id)
    const r5 = await supabase.from("ingest_errors").delete().neq("id", 0);
    results.ingest_errors = r5.error ? `error: ${r5.error.message}` : "deleted";

    // 6. pipeline_health_events (bigint id)
    const r6 = await supabase.from("pipeline_health_events").delete().neq("id", 0);
    results.pipeline_health_events = r6.error ? `error: ${r6.error.message}` : "deleted";

    // 7. crawl_batch_universities (FK → crawl_batches, no id col)
    const r7 = await supabase.from("crawl_batch_universities").delete().neq("batch_id", "00000000-0000-0000-0000-000000000000");
    results.crawl_batch_universities = r7.error ? `error: ${r7.error.message}` : "deleted";

    // 8. crawl_batches (uuid id)
    const r8 = await supabase.from("crawl_batches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.crawl_batches = r8.error ? `error: ${r8.error.message}` : "deleted";

    // 9. Reset universities crawl_status to pending
    const r9 = await supabase.from("universities").update({ crawl_status: "pending" }).neq("id", "00000000-0000-0000-0000-000000000000");
    results.universities_reset = r9.error ? `error: ${r9.error.message}` : "reset";

    return new Response(JSON.stringify({ ok: true, deleted: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
