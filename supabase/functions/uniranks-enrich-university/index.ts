import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { extractProgramsRegex, sha256Hex, type UnifiedProgram } from "../_shared/unifiedExtraction.ts";
import { insertIngestError, persistPrograms, recordRegexNoMatch, sanitizeDbError } from "./processor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACT_MODE = Deno.env.get("UNIRANKS_EXTRACT_MODE") || "hybrid";
const AI_TIMEOUT_MS = Number(Deno.env.get("UNIRANKS_AI_TIMEOUT_MS") || 9000);

async function scrapeWithFirecrawl(url: string): Promise<{ markdown: string; metadata: any } | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    console.error("[enrich] missing env: FIRECRAWL_API_KEY");
    return null;
  }

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 3000 }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) return null;
  return { markdown: data.data?.markdown || data.markdown || "", metadata: data.data?.metadata || data.metadata || {} };
}

async function tryAiExtraction(markdown: string, sourceUrl: string, contentHash: string): Promise<UnifiedProgram[] | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const prompt = `Extract programs as JSON array. Strict schema: {name,degree:{raw,level},discipline_hint,tuition:{usd_min,usd_max,basis,scope,currency},duration:{months},languages,study_mode,intake_months,requirements:{ielts_min_overall,toefl_min,gpa_min},scholarship:{available,type},description,evidence,source}. Evidence values must include exact quote from input.`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}\nSOURCE:${sourceUrl}\n\n${markdown.slice(0, 24000)}` }] }] }),
    });
    if (!r.ok) return null;
    const json = await r.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const cleaned = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] || text;
    const parsed = JSON.parse(cleaned.trim());
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item: any) => ({ ...item, source: { ...(item.source || {}), url: sourceUrl, content_hash: contentHash } }));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractProgramsHybrid(markdown: string, sourceUrl: string, contentHash: string): Promise<{ programs: UnifiedProgram[]; mode: string }> {
  if (EXTRACT_MODE !== "regex_only") {
    const ai = await tryAiExtraction(markdown, sourceUrl, contentHash);
    if (ai && ai.length > 0) return { programs: ai, mode: "ai" };
    if (EXTRACT_MODE === "ai_only") return { programs: [], mode: "ai_empty" };
  }
  return { programs: extractProgramsRegex(markdown, sourceUrl, contentHash), mode: "regex" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let supabase: any = null;
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return new Response(JSON.stringify({ ok: false, error: adminCheck.error }), {
        status: adminCheck.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    supabase = adminCheck.srv;
    const { slug, university_id, job_id, batch_id } = await req.json();
    if (!slug || !university_id) return new Response(JSON.stringify({ ok: false, error: "slug and university_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sourceUrl = `https://www.uniranks.com/universities/${slug}`;
    const scrape = await scrapeWithFirecrawl(sourceUrl);
    if (!scrape || !scrape.markdown.trim()) {
      await insertIngestError(supabase, { pipeline: "uniranks_enrich", job_id, batch_id, entity_hint: "page", source_url: sourceUrl, stage: "fetch", reason: "empty_content", details: { slug } });
      return new Response(JSON.stringify({ ok: false, error: "empty_content" }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const contentHash = await sha256Hex(scrape.markdown);
    const { programs: discovered, mode } = await extractProgramsHybrid(scrape.markdown, sourceUrl, contentHash);

    if (discovered.length === 0) {
      await recordRegexNoMatch({ supabase, sourceUrl, contentHash, mode, job_id, batch_id });
    }

    const { programsValid, programsSaved, programsRejected, rejectionReasons } = await persistPrograms({
      supabase,
      discovered,
      scrapeMarkdown: scrape.markdown,
      sourceUrl,
      university_id,
      slug,
      contentHash,
      job_id,
      batch_id,
    });
    const totalRejected = programsRejected + (discovered.length === 0 ? 1 : 0);

    if (job_id) {
      await supabase.from("uniranks_enrich_jobs").update({
        programs_discovered: discovered.length,
        programs_valid: programsValid,
        programs_saved: programsSaved,
        programs_rejected: totalRejected,
        rejection_reasons: rejectionReasons,
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);
    }

    return new Response(JSON.stringify({ ok: true, mode, programs_discovered: discovered.length, programs_valid: programsValid, programs_saved: programsSaved, programs_rejected: totalRejected, rejection_reasons: rejectionReasons }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    if (supabase) {
      await insertIngestError(supabase, { pipeline: "uniranks_enrich", entity_hint: "page", stage: "extract", reason: "db_error", details_json: sanitizeDbError(error) });
    }
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
