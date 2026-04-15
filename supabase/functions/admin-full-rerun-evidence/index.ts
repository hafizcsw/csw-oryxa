/**
 * admin-full-rerun-evidence
 * 
 * Phase-based execution:
 *   phase=fetch_evidence   → Firecrawl all 6 URLs, return raw evidence
 *   phase=run_profiles     → Invoke crawl-qs-profile-worker for 3 universities
 *   phase=seed_programmes  → Insert programme URLs into program_urls table
 *   phase=run_programmes   → Invoke crawl-qs-programme-detail for 3 programmes
 *   phase=db_evidence      → Query all QS tables and return final evidence
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress",
};

const QS_BASE = "https://www.topuniversities.com";

const LOCKED_URLS = {
  universities: [
    { id: "161523ba-1055-4915-8cb5-72deff3f9376", name: "Oxford", path: "/universities/university-oxford" },
    { id: "e5a4582c-784a-4095-9aff-d01ac0c09cae", name: "ADU", path: "/universities/abu-dhabi-university" },
    { id: "9b1f1076-8281-4394-a1d0-8acb136db6b0", name: "AURAK", path: "/universities/american-university-ras-al-khaimah-aurak" },
  ],
  programmes: [
    { uni: "Oxford", path: "/universities/university-oxford/postgrad/msc-migration-studies" },
    { uni: "ADU", path: "/universities/abu-dhabi-university/undergrad/bachelor-business-administration-bba" },
    { uni: "AURAK", path: "/universities/american-university-ras-al-khaimah/undergrad/bachelor-science-business-administration-major-hospitality-tourism-management" },
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const phase = body.phase || "fetch_evidence";

    // ═══════════════════════════════════════════════════
    // PHASE 1: Direct Firecrawl fetch for all 6 URLs
    // ═══════════════════════════════════════════════════
    if (phase === "fetch_evidence") {
      const allPaths = [
        ...LOCKED_URLS.universities.map(u => ({ label: `uni:${u.name}`, path: u.path })),
        ...LOCKED_URLS.programmes.map(p => ({ label: `prog:${p.uni}`, path: p.path })),
      ];

      const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (!apiKey) return json({ ok: false, error: "FIRECRAWL_API_KEY not set" }, 500);

      const results: any[] = [];

      for (const item of allPaths) {
        const url = `${QS_BASE}${item.path}`;
        try {
          const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url, formats: ["markdown"], waitFor: 5000, onlyMainContent: false }),
            signal: AbortSignal.timeout(45_000),
          });

          const data = await resp.json();
          const md = data.data?.markdown || data.markdown || "";
          const finalUrl = data.data?.metadata?.sourceURL || data.data?.metadata?.url || url;
          const lines = md.split("\n");
          const titleLine = lines.find((l: string) => l.startsWith("# ")) || lines[0] || "";

          results.push({
            label: item.label,
            requested_url: url,
            final_url: finalUrl,
            fetch_method: "firecrawl",
            http_status: resp.status,
            raw_markdown_length: md.length,
            title_line: titleLine.slice(0, 200),
            first_20_lines: lines.slice(0, 20).join("\n"),
            redirect_detected: finalUrl !== url,
          });
        } catch (e: any) {
          results.push({ label: item.label, requested_url: url, error: e?.message });
        }
      }

      return json({ ok: true, phase: "fetch_evidence", results });
    }

    // ═══════════════════════════════════════════════════
    // PHASE 2: Run profile workers (actual pipeline)
    // ═══════════════════════════════════════════════════
    if (phase === "run_profiles") {
      const results: any[] = [];

      for (const uni of LOCKED_URLS.universities) {
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/crawl-qs-profile-worker`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SRV_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              university_id: uni.id,
              source_profile_url: `${QS_BASE}${uni.path}`,
              trace_id: `full-rerun-${uni.name.toLowerCase()}-${Date.now()}`,
            }),
            signal: AbortSignal.timeout(120_000),
          });
          const data = await resp.json();
          results.push({ university: uni.name, status: resp.status, data });
        } catch (e: any) {
          results.push({ university: uni.name, status: "error", error: e?.message });
        }
      }

      return json({ ok: true, phase: "run_profiles", results });
    }

    // ═══════════════════════════════════════════════════
    // PHASE 3: Seed programme URLs into program_urls
    // ═══════════════════════════════════════════════════
    if (phase === "seed_programmes") {
      const uniMap: Record<string, string> = {};
      for (const u of LOCKED_URLS.universities) uniMap[u.name] = u.id;

      const results: any[] = [];
      for (const prog of LOCKED_URLS.programmes) {
        const fullUrl = `${QS_BASE}${prog.path}`;
        const universityId = uniMap[prog.uni];

        // Delete any existing entry to force re-fetch
        await srv.from("program_urls").delete()
          .eq("university_id", universityId)
          .eq("canonical_url", fullUrl);

        const { error } = await srv.from("program_urls").insert({
          university_id: universityId,
          url: fullUrl,
          canonical_url: fullUrl,
          kind: "program",
          status: "pending",
          discovered_from: "door2:qs_profile",
        });

        results.push({
          programme: `${prog.uni}: ${prog.path.split("/").pop()}`,
          university_id: universityId,
          url: fullUrl,
          seeded: !error,
          error: error?.message || null,
        });
      }

      return json({ ok: true, phase: "seed_programmes", results });
    }

    // ═══════════════════════════════════════════════════
    // PHASE 4: Run programme detail worker
    // ═══════════════════════════════════════════════════
    if (phase === "run_programmes") {
      const uniIds = LOCKED_URLS.universities.map(u => u.id);

      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/crawl-qs-programme-detail`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SRV_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            university_ids: uniIds,
            limit: 50,
            time_budget_ms: 300_000,
            trace_id: `full-rerun-programmes-${Date.now()}`,
          }),
          signal: AbortSignal.timeout(360_000),
        });
        const data = await resp.json();
        return json({ ok: true, phase: "run_programmes", status: resp.status, data });
      } catch (e: any) {
        return json({ ok: false, phase: "run_programmes", error: e?.message }, 500);
      }
    }

    // ═══════════════════════════════════════════════════
    // PHASE 5: Query all DB tables for final evidence
    // ═══════════════════════════════════════════════════
    if (phase === "db_evidence") {
      const uniIds = LOCKED_URLS.universities.map(u => u.id);

      // Get entity_profile_ids
      const { data: profiles } = await srv
        .from("qs_entity_profiles")
        .select("id, university_id, display_name, about_text, official_website, programme_count_qs, institution_type")
        .in("university_id", uniIds);

      const epIds = (profiles || []).map((p: any) => p.id);

      // Parallel queries for all QS tables
      const [rankings, studentsStaff, costOfLiving, campuses, media, faqs, employability, admissions, programmes, drafts] = await Promise.all([
        srv.from("qs_ranking_snapshots").select("*").in("entity_profile_id", epIds),
        srv.from("qs_students_staff").select("*").in("entity_profile_id", epIds),
        srv.from("qs_cost_of_living").select("*").in("entity_profile_id", epIds),
        srv.from("qs_campus_locations").select("*").in("entity_profile_id", epIds),
        srv.from("qs_media_assets").select("*").in("entity_profile_id", epIds),
        srv.from("qs_faqs").select("entity_profile_id, question").in("entity_profile_id", epIds),
        srv.from("qs_employability").select("*").in("entity_profile_id", epIds),
        srv.from("qs_admission_summaries").select("*").in("entity_profile_id", epIds),
        srv.from("qs_programme_details").select("*").in("entity_profile_id", epIds),
        srv.from("program_draft").select("program_key, university_id, extracted_json, field_evidence_map, last_extracted_at, extractor_version, review_status").in("university_id", uniIds).eq("extractor_version", "qs-programme-detail-v2"),
      ]);

      return json({
        ok: true,
        phase: "db_evidence",
        entity_profiles: profiles,
        qs_ranking_snapshots: rankings.data,
        qs_students_staff: studentsStaff.data,
        qs_cost_of_living: costOfLiving.data,
        qs_campus_locations: campuses.data,
        qs_media_assets: media.data,
        qs_faqs_count: (faqs.data || []).length,
        qs_faqs_sample: (faqs.data || []).slice(0, 5),
        qs_employability: employability.data,
        qs_admission_summaries: admissions.data,
        qs_programme_details: programmes.data,
        program_drafts: drafts.data,
      });
    }

    return json({ ok: false, error: `Unknown phase: ${phase}` }, 400);
  } catch (err: any) {
    console.error("[full-rerun-evidence] Fatal:", err);
    return json({ ok: false, error: err?.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
