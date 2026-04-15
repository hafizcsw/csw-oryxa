import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUNK_CITIES = new Set([
  "__unknown__", "unknown", "main campus", "head office", "headquarters",
  "central", "n/a", "na", "-", "other", "online", "remote", "unspecified",
  "not specified", "various", "multiple", "see website", "tba", "tbd",
]);

function isJunkCity(v: string | null): boolean {
  if (!v) return true;
  const n = v.trim().toLowerCase();
  return n.length < 2 || n.length > 80 || JUNK_CITIES.has(n) || /^\d+$/.test(n);
}

const SYSTEM_PROMPT = `You are a university geolocation expert. Given a list of universities with their names, determine the CITY where each university's main campus is located.

Rules:
- Return ONLY the city name (e.g., "London", "Berlin", "Riyadh")
- Use the most common English spelling of the city name
- If the university name contains a city name, use that
- If unsure, set confidence below 0.5
- NEVER return: "Main Campus", "Head Office", "Online", "Remote", "Unknown", "N/A"
- NEVER guess — if you truly cannot determine the city, return null
- For each university, provide a brief reasoning (1 sentence)

Output JSON:
{
  "universities": [
    { "university_id": "uuid", "city": "CityName" or null, "confidence": 0.0-1.0, "reasoning": "brief explanation" }
  ]
}`;

async function processBatch(batch: any[], apiKey: string, gatewayUrl: string): Promise<{ applied: { id: string; city: string }[]; rejected: number }> {
  const items = batch.map((u: any) =>
    `- ID: ${u.id} | Name: "${u.name}" | Name_AR: "${u.name_ar || ""}" | Country: ${u.country_code || "unknown"} | Website: ${u.website || "n/a"}`
  );
  const prompt = `Determine the city for each university below:\n\n${items.join("\n")}`;

  const aiResp = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    console.error(`AI error ${aiResp.status}: ${errText}`);
    return { applied: [], rejected: 0 };
  }

  const aiData = await aiResp.json();
  const content = aiData.choices?.[0]?.message?.content;
  if (!content) return { applied: [], rejected: 0 };

  const parsed = JSON.parse(content);
  const results = parsed.universities || parsed.results || [];
  const applied: { id: string; city: string }[] = [];
  let rejected = 0;

  for (const r of results) {
    const candidate = batch.find((c: any) => c.id === r.university_id);
    if (!candidate) continue;
    const proposedCity = r.city?.trim() || null;
    const confidence = typeof r.confidence === "number" ? r.confidence : 0;
    if (isJunkCity(proposedCity) || confidence < 0.5) {
      rejected++;
      continue;
    }
    applied.push({ id: candidate.id, city: proposedCity! });
  }

  return { applied, rejected };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = performance.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Use OpenAI API directly
    const apiKey = Deno.env.get("OPENAI_API_KEY")!;
    const gatewayUrl = "https://api.openai.com/v1/chat/completions";

    const sb = createClient(supabaseUrl, svcKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 30, 30); // Max 30 per invocation
    const traceId = `CITY-BF-${Date.now()}`;

    // Fetch candidates — universities missing city
    const { data: candidates, error: fetchErr } = await sb
      .from("universities")
      .select("id, name, name_ar, country_code, city, website")
      .or("city.is.null,city.eq.,city.eq.__unknown__,city.ilike.unknown")
      .neq("city", "__ai_skip__")
      .limit(limit);

    if (fetchErr) throw fetchErr;
    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ 
        trace_id: traceId, candidates: 0, applied: 0, remaining: 0,
        dur_ms: Math.round(performance.now() - t0)
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process single batch (30 max)
    let applied = 0;
    let rejected = 0;
    let skipped = 0;
    let errors = 0;

    const result = await processBatch(candidates, apiKey, gatewayUrl).catch(e => {
      console.error("Batch error:", e);
      errors++;
      return { applied: [] as { id: string; city: string }[], rejected: 0 };
    });

    // Apply updates
    rejected = result.rejected;
    if (result.applied.length > 0) {
      for (const entry of result.applied) {
        const { error: updateErr } = await sb
          .from("universities")
          .update({ city: entry.city })
          .eq("id", entry.id);
        if (!updateErr) applied++;
        else console.error(`Update failed for ${entry.id}:`, updateErr);
      }
    }

    // Mark rejected candidates so they're skipped next time
    const appliedIds = new Set(result.applied.map(a => a.id));
    const rejectedIds = candidates
      .filter(c => !appliedIds.has(c.id))
      .map(c => c.id);
    if (rejectedIds.length > 0) {
      const { error: skipErr } = await sb
        .from("universities")
        .update({ city: "__ai_skip__" })
        .in("id", rejectedIds);
      if (skipErr) console.error("Skip update error:", skipErr);
      else skipped = rejectedIds.length;
    }

    // Count remaining
    const { count: remaining } = await sb
      .from("universities")
      .select("id", { count: "estimated", head: true })
      .or("city.is.null,city.eq.,city.eq.__unknown__,city.ilike.unknown")
      .neq("city", "__ai_skip__");

    const dur = Math.round(performance.now() - t0);
    console.log(`[${traceId}] candidates=${candidates.length} applied=${applied} rejected=${rejected} skipped=${skipped} errors=${errors} remaining=${remaining} dur=${dur}ms`);

    return new Response(JSON.stringify({
      trace_id: traceId,
      candidates: candidates.length,
      applied,
      rejected,
      skipped,
      errors,
      remaining: remaining || 0,
      dur_ms: dur,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("batch error:", err);
    return new Response(JSON.stringify({ 
      error: String((err as Error).message || err),
      dur_ms: Math.round(performance.now() - t0)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
