import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin, corsHeaders } from "../_shared/auth.ts";

/* ── Junk city values to reject ── */
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: admin-only OR internal cron secret (for automated batch runs)
    const body = await req.json();
    const cronSecret = Deno.env.get("FX_CRON_SECRET") ?? "";
    const isInternalCall = body._cron_secret === cronSecret && cronSecret.length > 0;
    if (!isInternalCall) {
      await requireAdmin(req);
    }

    const {
      dry_run = true,
      limit = 50,
      country_code = null,
      min_confidence = 0.6,
      offset = 0,
    } = body;

    const traceId = `CITY-BF-${Date.now()}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const sb = createClient(supabaseUrl, svcKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    /* ── 1a. Reject memory: get previously rejected university IDs ── */
    const rejectedIdsSet = new Set<string>();
    const cc = country_code ? country_code.toUpperCase() : null;
    {
      let rejQ = sb
        .from("city_backfill_staging")
        .select("university_id")
        .eq("status", "rejected");
      if (cc) rejQ = rejQ.eq("country_code", cc);
      const { data: rejRows } = await rejQ;
      if (rejRows) rejRows.forEach((r: any) => rejectedIdsSet.add(r.university_id));
    }

    /* ── 1b. Fetch candidates (excluding already rejected) ── */
    let query = sb
      .from("universities")
      .select("id, name, name_ar, country_code, city, website")
      .or("city.is.null,city.eq.,city.eq.__unknown__,city.ilike.unknown")
      .range(offset, offset + limit - 1);

    if (cc) query = query.eq("country_code", cc);

    const { data: rawCandidates, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    // Filter out previously rejected
    const candidates = (rawCandidates || []).filter((c: any) => !rejectedIdsSet.has(c.id));

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({
        trace_id: traceId, dry_run, candidates: 0, proposed: 0, applied: 0, rejected: 0,
        skipped_rejected: rejectedIdsSet.size,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    /* ── 2. Batch AI extraction ── */
    const batchSize = 20;
    const allProposals: any[] = [];

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const prompt = buildPrompt(batch);

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error(`AI error batch ${i}: ${aiResp.status} ${errText}`);
        continue;
      }

      const aiData = await aiResp.json();
      const content = aiData.choices?.[0]?.message?.content;
      if (!content) continue;

      try {
        const parsed = JSON.parse(content);
        const results = parsed.universities || parsed.results || [];
        for (const r of results) {
          const candidate = batch.find((c: any) => c.id === r.university_id);
          if (!candidate) continue;

          const proposedCity = r.city?.trim() || null;
          const confidence = typeof r.confidence === "number" ? r.confidence : 0;
          const rejected = isJunkCity(proposedCity) || confidence < min_confidence;

          allProposals.push({
            university_id: candidate.id,
            university_name: candidate.name,
            country_code: candidate.country_code,
            old_city: candidate.city,
            proposed_city: rejected ? proposedCity : proposedCity,
            confidence_score: Math.round(confidence * 100) / 100,
            source_method: "ai",
            reasoning: { model: "gpt-4o", raw: r.reasoning || r.evidence || null },
            status: rejected ? "rejected" : "proposed",
            trace_id: traceId,
          });
        }
      } catch (parseErr) {
        console.error("JSON parse error:", parseErr);
      }
    }

    /* ── 3. Write staging rows ── */
    if (allProposals.length > 0) {
      const { error: insertErr } = await sb
        .from("city_backfill_staging")
        .insert(allProposals);
      if (insertErr) {
        console.error("Staging insert error:", insertErr);
        throw insertErr;
      }
    }

    const proposed = allProposals.filter((p) => p.status === "proposed");
    const rejected = allProposals.filter((p) => p.status === "rejected");
    let applied = 0;

    /* ── 4. Apply if not dry_run ── */
    if (!dry_run && proposed.length > 0) {
      for (const p of proposed) {
        const { error: updateErr } = await sb
          .from("universities")
          .update({ city: p.proposed_city })
          .eq("id", p.university_id);

        if (!updateErr) {
          applied++;
          await sb
            .from("city_backfill_staging")
            .update({ status: "applied", applied_at: new Date().toISOString() })
            .eq("university_id", p.university_id)
            .eq("trace_id", traceId)
            .eq("status", "proposed");
        }
      }
    }

    /* ── 5. Sample output ── */
    const sample = allProposals.slice(0, 10).map((p) => ({
      university_id: p.university_id,
      name: p.university_name,
      country: p.country_code,
      old_city: p.old_city,
      proposed_city: p.proposed_city,
      confidence: p.confidence_score,
      status: p.status,
    }));

    const result = {
      trace_id: traceId,
      dry_run,
      candidates: candidates.length,
      total_proposals: allProposals.length,
      proposed: proposed.length,
      rejected: rejected.length,
      applied,
      top_reject_reasons: summarizeRejections(rejected),
      sample,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("city-backfill-runner error:", err);
    const msg = String((err as Error).message || err);
    const code = msg === "FORBIDDEN" ? 403 : msg === "NO_AUTH" || msg === "INVALID_USER" ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status: code,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/* ── Prompts ── */
const SYSTEM_PROMPT = `You are a university geolocation expert. Given a list of universities with their names and country codes, determine the CITY where each university's main campus is located.

Rules:
- Return ONLY the city name (e.g., "London", "Berlin", "Riyadh")
- Use the most common English spelling of the city name
- If the university name contains a city name, use that
- If unsure, set confidence below 0.5
- NEVER return: "Main Campus", "Head Office", "Online", "Remote", "Unknown", "N/A"
- NEVER guess — if you truly cannot determine the city, return null
- For each university, provide a brief reasoning (1 sentence)

Output JSON with this exact structure:
{
  "universities": [
    {
      "university_id": "uuid",
      "city": "CityName" or null,
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }
  ]
}`;

function buildPrompt(batch: any[]): string {
  const items = batch.map((u) =>
    `- ID: ${u.id} | Name: "${u.name}" | Name_AR: "${u.name_ar || ""}" | Country: ${u.country_code} | Website: ${u.website || "n/a"}`
  );
  return `Determine the city for each university below:\n\n${items.join("\n")}`;
}

function summarizeRejections(rejected: any[]): Record<string, number> {
  const reasons: Record<string, number> = {};
  for (const r of rejected) {
    const reason = r.confidence_score < 0.6
      ? "low_confidence"
      : isJunkCity(r.proposed_city)
      ? "junk_value"
      : "other";
    reasons[reason] = (reasons[reason] || 0) + 1;
  }
  return reasons;
}
