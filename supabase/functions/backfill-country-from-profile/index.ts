import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * backfill-country-from-profile
 * 
 * Fetches UniRanks profile pages for quarantined universities (is_active=false, country_id IS NULL),
 * extracts the ISO country code from the flag icon URL, maps to countries table,
 * and updates country_id. The existing trigger trg_universities_auto_reactivate
 * handles setting is_active=true when country_id becomes NOT NULL.
 *
 * Flag pattern: flag-icons@.../flags/4x3/{cc}.svg  →  cc.toUpperCase() → countries.country_code
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "LavistaBackfill/1.0 (+https://connectstudyworld.com)";
const FETCH_TIMEOUT_MS = 10_000;

// Regex to extract ISO 2-letter code from flag icon URL
const FLAG_REGEX = /flag-icons[@/][^"')]*\/flags\/\d+x\d+\/([a-z]{2})\.svg/i;

/** Decode HTML entities in URLs stored with &#039; &amp; etc. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit ?? 100, 2000);
    const traceId = body.trace_id ?? `bf-country-${Date.now()}`;
    const dryRun = body.dry_run ?? false;

    console.log(`[${traceId}] Starting backfill. limit=${limit} dry_run=${dryRun}`);

    // Pre-load country_code → country_id map
    const { data: countries, error: cErr } = await supabase
      .from("countries")
      .select("id, country_code");
    if (cErr) throw cErr;

    const ccMap = new Map<string, string>();
    for (const c of countries!) {
      ccMap.set(c.country_code, c.id);
    }
    console.log(`[${traceId}] Loaded ${ccMap.size} country codes`);

    // Fetch target universities
    const { data: unis, error: uErr } = await supabase
      .from("universities")
      .select("id, name, uniranks_profile_url")
      .is("country_id", null)
      .eq("is_active", false)
      .not("uniranks_profile_url", "is", null)
      .order("ranking", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (uErr) throw uErr;
    if (!unis?.length) {
      return json({ status: "no_work", processed: 0, trace_id: traceId });
    }

    let matched = 0;
    let unmatched = 0;
    let fetchErrors = 0;
    let noFlag = 0;
    const samples: any[] = [];

    // Process in concurrent batches of 5 for speed
    const BATCH_SIZE = 5;
    for (let i = 0; i < unis.length; i += BATCH_SIZE) {
      const batch = unis.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(async (uni) => {
        try {
          const profileUrl = decodeHtmlEntities(uni.uniranks_profile_url);
          const r = await fetch(profileUrl, {
            headers: { "User-Agent": UA },
            redirect: "follow",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });

          if (!r.ok) {
            fetchErrors++;
            if (samples.length < 10) samples.push({ id: uni.id, name: uni.name, status: "fetch_error", http: r.status });
            return;
          }

          const html = await r.text();
          const flagMatch = html.match(FLAG_REGEX);
          if (!flagMatch) {
            noFlag++;
            if (samples.length < 10) samples.push({ id: uni.id, name: uni.name, status: "no_flag" });
            return;
          }

          const cc = flagMatch[1].toUpperCase();
          const countryId = ccMap.get(cc);

          if (!countryId) {
            unmatched++;
            if (samples.length < 10) samples.push({ id: uni.id, name: uni.name, status: "unmatched_cc", cc });
            if (!dryRun) {
              await supabase.from("ingest_errors").insert({
                pipeline: "backfill_country",
                stage: "country_map",
                reason: "unmatched_country_code",
                details_json: { university_id: uni.id, country_code: cc, trace_id: traceId },
              }).then(() => {}).catch(() => {});
            }
            return;
          }

          if (!dryRun) {
            const { error: upErr } = await supabase
              .from("universities")
              .update({ country_id: countryId })
              .eq("id", uni.id);
            if (upErr) {
              fetchErrors++;
              if (samples.length < 10) samples.push({ id: uni.id, name: uni.name, status: "update_error", error: upErr.message });
              return;
            }
          }

          matched++;
          if (samples.length < 10) {
            samples.push({ id: uni.id, name: uni.name, status: "matched", cc, country_id: countryId, dry_run: dryRun });
          }
        } catch (e: any) {
          fetchErrors++;
          if (samples.length < 10) samples.push({ id: uni.id, name: uni.name, status: "exception", error: e?.message?.slice(0, 100) });
        }
      }));

      // Small delay between batches to avoid hammering UniRanks
      if (i + BATCH_SIZE < unis.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    console.log(`[${traceId}] Done. matched=${matched} unmatched=${unmatched} noFlag=${noFlag} fetchErrors=${fetchErrors}`);

    return json({
      status: "ok",
      trace_id: traceId,
      dry_run: dryRun,
      total: unis.length,
      matched,
      unmatched,
      no_flag: noFlag,
      fetch_errors: fetchErrors,
      samples,
    });
  } catch (error: any) {
    console.error("[backfill-country] Fatal:", error);
    return json({ status: "error", error: error?.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
