import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  handleCorsPreflight,
  getCorsHeaders,
  generateTraceId,
  slog,
} from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

// ── Constants ──────────────────────────────────────────────────────────────

const WRITER_VERSION  = "4.0";
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT       = "OrxyaCrawlerBot/2.0 (+https://cswworld.com/bot)";

// PDF link patterns
const PDF_RE    = /\.pdf(\?[^"']*)?$/i;
const MEDIA_RE  = /\.(jpg|jpeg|png|gif|webp|svg)(\?[^"']*)?$/i;

type EventType = "started" | "completed" | "failed" | "warning" | "metric";

// ── Helpers ────────────────────────────────────────────────────────────────

function jsonResp(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) },
  });
}

async function tlog(
  srv: SupabaseClient<any, any, any>,
  p: {
    run_id: string; run_item_id: string; stage: string; event_type: EventType;
    duration_ms?: number; success?: boolean; error_type?: string;
    error_message?: string; metadata?: Record<string, unknown>; trace_id: string;
  },
): Promise<void> {
  await srv.from("crawler_telemetry").insert({
    run_id: p.run_id, run_item_id: p.run_item_id, stage: p.stage,
    event_type: p.event_type, duration_ms: p.duration_ms ?? null,
    success: p.success ?? null, error_type: p.error_type ?? null,
    error_message: p.error_message ?? null,
    metadata: { writer_version: WRITER_VERSION, ...p.metadata },
    trace_id: p.trace_id,
  });
}

// Parse anchor links from HTML for a specific domain
function parseLinksFromHtml(html: string, base: string, domain: string): string[] {
  const out: string[] = [];
  const re = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const u = new URL(m[1], base);
      if ((u.protocol === "http:" || u.protocol === "https:") &&
          u.hostname.replace(/^www\./, "") === domain) {
        out.push(u.href);
      }
    } catch { /* skip */ }
  }
  return [...new Set(out)];
}

// Probe URL with HEAD to check if it's a PDF
async function probeUrl(url: string): Promise<{ reachable: boolean; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    return { reachable: res.ok, contentType: res.headers.get("content-type") ?? "" };
  } catch {
    return { reachable: false, contentType: "" };
  } finally {
    clearTimeout(timer);
  }
}

// ── Main: write_drafts ─────────────────────────────────────────────────────

async function writeDrafts(
  srv: SupabaseClient<any, any, any>,
  runItemId: string,
  tid: string,
): Promise<{ ok: boolean; error?: string; artifacts_registered: number; drafts_written: number }> {
  const t0 = Date.now();

  // 1. Load run item
  const { data: item, error: itemErr } = await srv
    .from("crawler_run_items")
    .select("id,run_id,university_id,website,target_domain,trace_id")
    .eq("id", runItemId)
    .single();

  if (itemErr || !item) {
    return { ok: false, error: "run_item_not_found", artifacts_registered: 0, drafts_written: 0 };
  }

  const runId   = item.run_id as string;
  const uniId   = item.university_id as string;
  const website = ((item.website as string | null) ?? "").replace(/\/$/, "");
  const domain  = ((item.target_domain as string | null) ?? "").replace(/^www\./, "");
  const traceId = (item.trace_id as string) || tid;

  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "draft_writer", event_type: "started",
    metadata: { website }, trace_id: traceId,
  });

  // 2. Load homepage raw_page for link extraction
  const { data: rawPage } = await srv
    .from("raw_pages")
    .select("id,text_content")
    .eq("url", website)
    .maybeSingle();

  // 3. Load evidence_items for this run item
  const { data: evidenceItems } = await srv
    .from("evidence_items")
    .select("id,fact_group,field_key,value_raw,source_url,confidence_0_100")
    .eq("crawler_run_item_id", runItemId);

  const evidence = (evidenceItems ?? []) as Array<{
    id: string; fact_group: string; field_key: string;
    value_raw: string; source_url: string; confidence_0_100: number;
  }>;

  // Helper: find first evidence value by fact_group/field_key
  const findEvidence = (fg: string, fk: string) =>
    evidence.find((e) => e.fact_group === fg && e.field_key === fk);

  // ── 4. Artifact discovery: scan HTML for PDF and media URLs ───────────────

  const pdfUrls: string[]   = [];
  const mediaUrls: string[] = [];

  if (rawPage?.text_content) {
    const links = parseLinksFromHtml(rawPage.text_content as string, website, domain);
    for (const link of links) {
      if (PDF_RE.test(link)) pdfUrls.push(link);
      else if (MEDIA_RE.test(link)) mediaUrls.push(link);
    }
  }

  // Also check page candidates for PDF/media URLs
  const { data: candidates } = await srv
    .from("crawler_page_candidates")
    .select("candidate_url,candidate_type")
    .eq("crawler_run_item_id", runItemId)
    .in("candidate_type", ["media"]);

  for (const c of (candidates ?? []) as Array<{ candidate_url: string; candidate_type: string }>) {
    if (PDF_RE.test(c.candidate_url)) pdfUrls.push(c.candidate_url);
  }

  // ── 5. Register PDF artifacts ──────────────────────────────────────────────

  let artifactsRegistered = 0;
  const uniquePdfs = [...new Set(pdfUrls)].slice(0, 20);

  const artifactRows = uniquePdfs.map((url) => {
    const fileName = url.split("/").pop()?.split("?")[0] ?? "document.pdf";
    const isProspectus = /prospectus|brochure/i.test(url);
    const isFeeSheet   = /fee|tuition|cost/i.test(url);
    const artifactType = isProspectus ? "prospectus" : isFeeSheet ? "fee_sheet" : "brochure";
    return {
      university_id:   uniId,
      source_url:      url,
      source_page_url: website,
      file_name:       fileName,
      mime_type:       "application/pdf",
      artifact_type:   artifactType,
      parse_status:    "pending" as const,
      trace_id:        traceId,
    };
  });

  if (artifactRows.length > 0) {
    const { data: insertedArtifacts, error: artErr } = await srv
      .from("crawl_file_artifacts")
      .upsert(artifactRows, { onConflict: "source_url", ignoreDuplicates: true })
      .select("id");
    if (!artErr) artifactsRegistered = (insertedArtifacts ?? []).length;
  }

  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "draft_writer", event_type: "metric",
    metadata: { phase: "artifacts_registered", count: artifactsRegistered, pdf_urls: uniquePdfs.length },
    trace_id: traceId,
  });

  let draftsWritten = 0;

  // ── 6. media_draft: register official media/brochure URLs ────────────────

  const uniqueMedia = [...new Set(mediaUrls)].slice(0, 30);
  if (uniqueMedia.length > 0) {
    const mediaDraftRows = uniqueMedia.map((url) => ({
      university_id:       uniId,
      crawler_run_id:      runId,
      crawler_run_item_id: runItemId,
      entity_type:         "university",
      media_type:          url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? "image" : "other",
      source_url:          url,
      is_official:         true,
      confidence_0_100:    60,
      review_status:       "pending",
      publish_status:      "unpublished",
      trace_id:            traceId,
    }));
    const { error: mediaErr } = await srv.from("media_draft").insert(mediaDraftRows);
    if (!mediaErr) draftsWritten += uniqueMedia.length;
  }

  // Register brochure PDFs as media_draft too
  if (uniquePdfs.length > 0) {
    const brochureRows = uniquePdfs.map((url) => ({
      university_id:       uniId,
      crawler_run_id:      runId,
      crawler_run_item_id: runItemId,
      entity_type:         "university",
      media_type:          "brochure",
      source_url:          url,
      is_official:         true,
      confidence_0_100:    70,
      review_status:       "pending",
      publish_status:      "unpublished",
      trace_id:            traceId,
    }));
    await srv.from("media_draft").insert(brochureRows);
    draftsWritten += uniquePdfs.length;
  }

  // ── 7. housing_draft: from housing evidence ─────────────────────���─────────

  const housingEvidence = evidence.filter((e) => e.fact_group === "housing");
  if (housingEvidence.length > 0) {
    const housingUrl   = findEvidence("housing", "housing_url");
    const onCampus     = findEvidence("housing", "on_campus_housing");
    const primaryEv    = housingEvidence[0];

    const { data: housingDraft, error: hdErr } = await srv
      .from("housing_draft")
      .insert({
        university_id:       uniId,
        crawler_run_id:      runId,
        crawler_run_item_id: runItemId,
        housing_name:        "On-Campus Housing",
        housing_type:        "on_campus",
        eligibility_text:    onCampus?.value_raw ?? null,
        international_students_allowed: onCampus?.value_raw?.toLowerCase() === "true" ? true : null,
        primary_evidence_id: primaryEv.id,
        review_status:       "pending",
        publish_status:      "unpublished",
        trace_id:            traceId,
      })
      .select("id")
      .single();

    if (!hdErr && housingDraft && housingUrl) {
      await srv.from("housing_media_draft").insert({
        housing_draft_id:  housingDraft.id,
        media_type:        "link",
        media_url:         housingUrl.value_raw,
        is_official:       true,
        confidence_0_100:  housingUrl.confidence_0_100,
      });
    }
    if (!hdErr) draftsWritten++;
  }

  // ── 8. leadership_draft: from leadership evidence ─────────────────────────

  const leadershipEvidence = evidence.filter((e) => e.fact_group === "leadership" || e.fact_group === "identity");
  const leaderNames = leadershipEvidence.filter((e) =>
    ["president_name","rector_name","chancellor_name","leader_name"].includes(e.field_key)
  );

  for (const leader of leaderNames.slice(0, 5)) {
    const roleKey = leader.field_key.replace("_name", "_title");
    const roleEv  = findEvidence(leader.fact_group, roleKey);
    const { error: ldErr } = await srv.from("leadership_draft").insert({
      university_id:       uniId,
      crawler_run_id:      runId,
      crawler_run_item_id: runItemId,
      person_name:         leader.value_raw,
      role:                leader.field_key.replace("_name", ""),
      title:               roleEv?.value_raw ?? null,
      primary_evidence_id: leader.id,
      review_status:       "pending",
      publish_status:      "unpublished",
      trace_id:            traceId,
    });
    if (!ldErr) draftsWritten++;
  }

  // ── 9. Update run item ─────────────────────────────────────────────────────

  await srv.from("crawler_run_items").update({
    status:            "draft_created",
    stage:             "drafts_written",
    progress_percent:  85,
    artifacts_found:   uniquePdfs.length + uniqueMedia.length,
    draft_count:       draftsWritten,
    updated_at:        new Date().toISOString(),
  }).eq("id", runItemId);

  const durationMs = Date.now() - t0;
  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "draft_writer", event_type: "completed",
    duration_ms: durationMs, success: true,
    metadata: { artifacts_registered: artifactsRegistered, drafts_written: draftsWritten },
    trace_id: traceId,
  });

  return { ok: true, artifacts_registered: artifactsRegistered, drafts_written: draftsWritten };
}

// ── Deno entry ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const tid    = req.headers.get("x-client-trace-id") || generateTraceId();

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return jsonResp({ ok: false, error: auth.error, trace_id: tid }, auth.status, origin);
  }
  const srv = auth.srv;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return jsonResp({ ok: false, error: "invalid_json" }, 400, origin);
  }

  const action = body.action as string | undefined;
  slog({ tid, fn: "crawler-v2-draft-writer", action });

  if (action === "write_drafts") {
    const runItemId = body.run_item_id as string | undefined;
    if (!runItemId) return jsonResp({ ok: false, error: "run_item_id required" }, 400, origin);
    const result = await writeDrafts(srv, runItemId, tid);
    return jsonResp({ ...result, tid }, result.ok ? 200 : 422, origin);
  }

  return jsonResp({ ok: false, error: `unknown action: ${action}` }, 400, origin);
});
