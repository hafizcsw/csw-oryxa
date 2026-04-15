import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress",
};

const PILOT_UNIVERSITIES = [
  { id: "161523ba-1055-4915-8cb5-72deff3f9376", name: "Oxford", url: "https://www.topuniversities.com/universities/university-oxford" },
  { id: "e5a4582c-784a-4095-9aff-d01ac0c09cae", name: "ADU", url: "https://www.topuniversities.com/universities/abu-dhabi-university" },
  { id: "9b1f1076-8281-4394-a1d0-8acb136db6b0", name: "AURAK", url: "https://www.topuniversities.com/universities/american-university-ras-al-khaimah-aurak" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const body = await req.json().catch(() => ({}));
    const phase = body.phase || "profiles";
    const results: any[] = [];

    if (phase === "profiles") {
      for (const uni of PILOT_UNIVERSITIES) {
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/crawl-qs-profile-worker`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SRV_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              university_id: uni.id,
              source_profile_url: uni.url,
              trace_id: `pilot-r2-${uni.name.toLowerCase()}`,
            }),
            signal: AbortSignal.timeout(120_000),
          });
          const data = await resp.json();
          results.push({ university: uni.name, status: resp.status, data });
        } catch (e: any) {
          results.push({ university: uni.name, status: "error", error: e?.message });
        }
      }
    } else if (phase === "programmes") {
      const uniIds = PILOT_UNIVERSITIES.map(u => u.id);
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/crawl-qs-programme-detail`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SRV_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            university_ids: uniIds,
            limit: 500,
            time_budget_ms: 300_000,
            trace_id: "pilot-r2-programmes",
          }),
          signal: AbortSignal.timeout(360_000),
        });
        const data = await resp.json();
        results.push({ phase: "programmes", status: resp.status, data });
      } catch (e: any) {
        results.push({ phase: "programmes", status: "error", error: e?.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, phase, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
