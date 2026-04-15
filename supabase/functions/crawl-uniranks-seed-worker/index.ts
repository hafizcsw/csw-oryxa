import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractETLD1 } from "../_shared/url-utils.ts";

/**
 * crawl-uniranks-seed-worker
 * PATCH 4: Seeds program_urls for mode=uniranks/hybrid/official.
 *
 * Phase 1: Universities WITH resolved website → seed from sitemap/homepage
 * Phase 2 (NEW): Universities WITHOUT website but WITH uniranks_profile_url
 *   → seed program_urls from UniRanks profile page links
 * Phase 3: Trigger resolver for remaining unresolved universities
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "LavistaCrawler/1.0 (+https://connectstudyworld.com)";
const FETCH_TIMEOUT_MS = 10_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${SRV_KEY}`) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const supabase = createClient(SUPABASE_URL, SRV_KEY);

  let limitUnis = 20;
  let maxUrlsPerUni = 50;
  let traceId = `seed-${Date.now()}`;
  let mode = "uniranks";

  try {
    const body = await req.json().catch(() => ({}));
    limitUnis = body?.limit_unis ?? 20;
    maxUrlsPerUni = body?.max_urls_per_uni ?? 50;
    traceId = body?.trace_id ?? traceId;
    mode = body?.mode ?? "uniranks";
  } catch {}

  try {
    let seededUrls = 0;
    let processedUnis = 0;
    const results: any[] = [];

    // ====== Phase 1: Seed from universities WITH resolved websites ======
    const { data: readyUnis, error: readyErr } = await supabase
      .from("universities")
      .select("id, name, website, website_host, website_etld1")
      .not("website", "is", null)
      .not("website_etld1", "is", null)
      .eq("is_active", true)
      .in("crawl_status", ["website_resolved", "pending", "locked"])
      .limit(limitUnis);

    if (readyErr) throw readyErr;

    for (const uni of readyUnis || []) {
      try {
        const urls = await discoverFromOfficialSite(uni.website, uni.website_etld1);
        let uniSeeded = 0;

        for (const u of urls.slice(0, maxUrlsPerUni)) {
          const { data: upserted, error: upsertErr } = await supabase.rpc("rpc_upsert_program_url", {
            p_batch_id: null,
            p_university_id: uni.id,
            p_url: u.url,
            p_kind: u.kind,
            p_discovered_from: `seed_official_${mode}`,
          });

          if (!upsertErr && upserted && upserted > 0) {
            uniSeeded++;
            seededUrls++;
          }
        }

        // PATCH 3: Use correct status label
        if (uniSeeded > 0) {
          await supabase.from("universities").update({
            crawl_status: "seeded_official",
          }).eq("id", uni.id);
        }

        processedUnis++;
        results.push({ id: uni.id, name: uni.name, seeded: uniSeeded, source: "official" });
      } catch (e: any) {
        results.push({ id: uni.id, name: uni.name, error: e?.message?.slice(0, 100), source: "official" });
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // ====== Phase 2 (NEW): Seed from UniRanks profile URLs (no website required) ======
    if ((mode === "uniranks" || mode === "hybrid") && processedUnis < limitUnis) {
      const remaining = limitUnis - processedUnis;
      const { data: uniranksUnis } = await supabase
        .from("universities")
        .select("id, name, uniranks_profile_url, uniranks_slug")
        .is("website", null)
        .not("uniranks_profile_url", "is", null)
        .eq("is_active", true)
        .in("crawl_status", ["pending", "websites", "no_official_website", "website_not_found"])
        .order("ranking", { ascending: true, nullsFirst: false })
        .limit(remaining);

      for (const uni of uniranksUnis || []) {
        try {
          const profileUrl = uni.uniranks_profile_url;
          if (!profileUrl) {
            // No profile URL → mark as missing
            await supabase.from("universities").update({
              crawl_status: "uniranks_profile_missing",
            }).eq("id", uni.id);
            continue;
          }

          // Seed a program_url entry pointing to the UniRanks profile itself
          // The direct-worker will pick this up for extraction
          const { data: upserted, error: upsertErr } = await supabase.rpc("rpc_upsert_program_url", {
            p_batch_id: null,
            p_university_id: uni.id,
            p_url: profileUrl,
            p_kind: "catalog",
            p_discovered_from: `seed_uniranks_profile`,
          });

          let uniSeeded = 0;
          if (!upsertErr && upserted && upserted > 0) {
            uniSeeded++;
            seededUrls++;
          }

          // Mark with correct status
          await supabase.from("universities").update({
            crawl_status: uniSeeded > 0 ? "seeded_uniranks" : "pending",
          }).eq("id", uni.id);

          processedUnis++;
          results.push({ id: uni.id, name: uni.name, seeded: uniSeeded, source: "uniranks_profile" });
        } catch (e: any) {
          results.push({ id: uni.id, name: uni.name, error: e?.message?.slice(0, 100), source: "uniranks_profile" });
        }
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // ====== Phase 3: Trigger resolver for remaining unresolved ======
    let resolveAttempted = 0;
    if ((mode === "uniranks" || mode === "hybrid") && processedUnis < limitUnis) {
      const remaining = limitUnis - processedUnis;
      const { data: unresolvedUnis } = await supabase
        .from("universities")
        .select("id, name, uniranks_profile_url")
        .is("website", null)
        .not("uniranks_profile_url", "is", null)
        .eq("is_active", true)
        .in("crawl_status", ["pending", "websites"])
        .order("ranking", { ascending: true, nullsFirst: false })
        .limit(remaining);

      for (const uni of unresolvedUnis || []) {
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/uniranks-website-resolver-worker`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${SRV_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ limit: 1, trace_id: traceId }),
            signal: AbortSignal.timeout(15_000),
          });
          if (r.ok) {
            const res = await r.json();
            resolveAttempted += res?.total ?? 0;
          } else {
            await r.text();
          }
        } catch {}
      }
    }

    return json({
      ok: true,
      processed_unis: processedUnis,
      seeded_urls: seededUrls,
      resolve_attempted: resolveAttempted,
      trace_id: traceId,
      results,
    });
  } catch (err: any) {
    console.error("[crawl-uniranks-seed-worker] Error:", err);
    return json({ ok: false, error: err?.message, trace_id: traceId }, 500);
  }
});

// ===== Discovery from Official Site =====

function scoreUrl(url: string): { kind: string; score: number } {
  const lower = url.toLowerCase();
  const keywords: Record<string, { kind: string; weight: number }[]> = {
    program: [{ kind: "program", weight: 3 }],
    degree: [{ kind: "program", weight: 3 }],
    bachelor: [{ kind: "program", weight: 2 }],
    master: [{ kind: "program", weight: 2 }],
    phd: [{ kind: "program", weight: 2 }],
    tuition: [{ kind: "fees", weight: 4 }],
    fees: [{ kind: "fees", weight: 3 }],
    "fee-structure": [{ kind: "fees", weight: 4 }],
    admissions: [{ kind: "admissions", weight: 3 }],
    admission: [{ kind: "admissions", weight: 3 }],
    apply: [{ kind: "admissions", weight: 2 }],
    scholarship: [{ kind: "scholarships", weight: 3 }],
    housing: [{ kind: "housing", weight: 3 }],
    accommodation: [{ kind: "housing", weight: 3 }],
    international: [{ kind: "admissions", weight: 2 }],
    catalog: [{ kind: "catalog", weight: 2 }],
    courses: [{ kind: "catalog", weight: 2 }],
    faculty: [{ kind: "catalog", weight: 1 }],
    department: [{ kind: "catalog", weight: 1 }],
    graduate: [{ kind: "program", weight: 2 }],
    undergraduate: [{ kind: "program", weight: 2 }],
    postgraduate: [{ kind: "program", weight: 2 }],
  };

  let bestKind = "unknown";
  let bestScore = 0;
  for (const [kw, entries] of Object.entries(keywords)) {
    if (lower.includes(kw)) {
      for (const e of entries) {
        if (e.weight > bestScore) {
          bestScore = e.weight;
          bestKind = e.kind;
        }
      }
    }
  }
  return { kind: bestKind, score: bestScore };
}

async function discoverFromOfficialSite(website: string, etld1: string): Promise<{ url: string; kind: string }[]> {
  const results: { url: string; kind: string; score: number }[] = [];
  const seen = new Set<string>();

  // 1. Try sitemap
  try {
    const origin = new URL(website).origin;
    for (const path of ["/sitemap.xml", "/sitemap_index.xml"]) {
      const r = await fetch(origin + path, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (r.ok) {
        const xml = await r.text();
        for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
          const u = m[1].trim();
          if (seen.has(u)) continue;
          try {
            if (extractETLD1(u) !== etld1) continue;
          } catch { continue; }
          seen.add(u);
          const scored = scoreUrl(u);
          if (scored.score > 0) {
            results.push({ url: u, kind: scored.kind, score: scored.score });
          }
        }
        if (results.length > 0) break;
      } else {
        await r.text();
      }
    }
  } catch {}

  // 2. Homepage link extraction
  try {
    const r = await fetch(website, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (r.ok) {
      const html = await r.text();
      const origin = new URL(website).origin;
      for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
        let href = m[1];
        if (href.startsWith("/")) href = origin + href;
        if (!href.startsWith("http")) continue;
        if (seen.has(href)) continue;
        try {
          if (extractETLD1(href) !== etld1) continue;
        } catch { continue; }
        if (/\.(pdf|jpg|jpeg|png|gif|svg|css|js|zip|doc|docx|xls|xlsx|mp4|webp)$/i.test(href)) continue;
        if (href.includes("mailto:") || href.includes("javascript:") || href.includes("#")) continue;

        seen.add(href);
        const scored = scoreUrl(href);
        if (scored.score > 0) {
          results.push({ url: href, kind: scored.kind, score: scored.score });
        }
      }
    } else {
      await r.text();
    }
  } catch {}

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 200).map(r => ({ url: r.url, kind: r.kind }));
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
