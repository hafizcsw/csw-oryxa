/**
 * crawl-qs-programme-detail v2
 * 
 * Crawls QS programme pages, extracts details:
 *   - Stores raw snapshot in crawl_raw_snapshots
 *   - Writes to qs_programme_details (with domestic/international tuition split)
 *   - Writes to program_draft (unified schema) with field_evidence_map per field
 *   - Proper deadlines_jsonb with stale detection
 *   - Full admission requirements
 * 
 * Called by crawl-runner-tick when source=qs.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-trace-id, x-orxya-ingress",
};

const QS_BASE = "https://www.topuniversities.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Auth handled by Supabase JWT verify in config.toml

  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json();
    const { limit = 10, trace_id, time_budget_ms = 60000, university_ids } = body;

    // Pick pending program_urls from QS source
    let query = srv
      .from("program_urls")
      .select("id, university_id, url, status")
      .eq("status", "pending")
      .like("discovered_from", "door2:qs%")
      .limit(limit);

    if (university_ids && university_ids.length > 0) {
      query = query.in("university_id", university_ids);
    }

    const { data: urls, error: urlErr } = await query;
    if (urlErr || !urls || urls.length === 0) {
      return json({ ok: true, processed: 0 });
    }

    let processed = 0;
    const startMs = Date.now();
    const currentYear = new Date().getFullYear();

    for (const pu of urls) {
      if (Date.now() - startMs > time_budget_ms) break;

      // Lock
      await srv.from("program_urls").update({ status: "fetching" }).eq("id", pu.id);

      try {
        // Resolve entity_profile_id
        const { data: entityProfile } = await srv
          .from("qs_entity_profiles")
          .select("id")
          .eq("university_id", pu.university_id)
          .single();
        const entityProfileId = entityProfile?.id;

        // Fetch page — QS is 100% JS-rendered, ALWAYS use Firecrawl for markdown
        let html = "";
        let markdown = "";
        let fetchMethod: "raw" | "firecrawl" = "firecrawl";

        // Step 1: Raw fetch for HTML (JSON-LD in <head>, <title> tag)
        try {
          const resp = await fetch(pu.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "text/html",
            },
            signal: AbortSignal.timeout(15_000),
          });
          if (resp.ok) html = await resp.text();
        } catch {}

        // Step 2: Firecrawl with waitFor for JS-rendered content
        const fc = await firecrawlScrape(pu.url);
        if (fc && fc.markdown && fc.markdown.length > 300) {
          markdown = fc.markdown;
          if (!html || html.length < 1000) html = fc.html || html;
        } else {
          // Step 2b: Fallback — convert raw HTML to markdown deterministically
          if (html && html.length > 500) {
            markdown = htmlToMarkdownSimple(html);
            fetchMethod = markdown.length > 300 ? "raw_with_md_convert" as any : "raw";
          } else {
            fetchMethod = "raw";
          }
        }

        const content = markdown || "";

        // ═══ GUARDRAIL: fetch_method MUST produce usable markdown ═══
        if (fetchMethod === "raw" || content.length < 100) {
          console.error(`[GUARDRAIL] fetch_method=${fetchMethod}, md_len=${content.length} for QS page ${pu.url} — rejecting`);
          await srv.from("program_urls").update({
            status: "failed",
            fetch_error: `GUARDRAIL_NO_MARKDOWN:${fetchMethod}`,
          }).eq("id", pu.id);
          continue;
        }

        // Even without markdown, we can extract from <title> and JSON-LD
        if (content.length < 100 && html.length < 500) {
          await srv.from("program_urls").update({
            status: "failed",
            fetch_error: "empty_page",
          }).eq("id", pu.id);
          continue;
        }

        // ── Store raw snapshot ──
        const { data: snapshot } = await srv.from("crawl_raw_snapshots").insert({
          source: "qs_programme",
          source_url: pu.url,
          programme_url: pu.url,
          content_hash: simpleHash(content),
          raw_html: html.slice(0, 500_000),
          raw_markdown: markdown.slice(0, 500_000),
          fetch_method: fetchMethod,
          metadata: {
            university_id: pu.university_id,
            trace_id,
            entity_profile_id: entityProfileId,
          },
        }).select("id").single();

        const snapshotId = snapshot?.id || null;

        // ── Extract programme details ──
        const parsed = extractProgramme(content, currentYear);

        // ═══ GUARDRAIL: title must not be null or a shell/placeholder ═══
        const SHELL_TITLES = [
          "university directory search",
          "search results",
          "qs world university rankings",
          "top universities",
          "find your perfect university",
          "compare universities",
          "university rankings",
        ];
        const titleLower = (parsed.title || "").toLowerCase().trim();
        const isShellTitle = !parsed.title || 
          SHELL_TITLES.some(s => titleLower === s || titleLower.startsWith(s)) ||
          titleLower.length < 5;
        
        // GUARDRAIL: title/degree/level consistency — if degree exists, level should too
        const hasInconsistency = parsed.degree && !parsed.level;
        
        if (isShellTitle) {
          console.error(`[GUARDRAIL] shell/placeholder title="${parsed.title}" for ${pu.url} — rejecting`);
          await srv.from("program_urls").update({
            status: "failed",
            fetch_error: `GUARDRAIL_SHELL_TITLE:${(parsed.title || "null").slice(0, 50)}`,
          }).eq("id", pu.id);
          continue;
        }
        if (hasInconsistency) {
          console.warn(`[GUARDRAIL] degree="${parsed.degree}" but level=null for ${pu.url} — flagging`);
        }

        // ── Write to qs_programme_details (canonical table) ──
        if (entityProfileId) {
          await srv.from("qs_programme_details").upsert({
            entity_profile_id: entityProfileId,
            programme_url: pu.url,
            title: parsed.title,
            degree: parsed.degree,
            level: parsed.level,
            duration: parsed.duration,
            study_mode: parsed.study_mode,
            tuition_domestic: parsed.tuition_domestic,
            tuition_international: parsed.tuition_international,
            tuition_currency: parsed.tuition_currency,
            start_months: parsed.start_months,
            deadline_raw: parsed.deadline_raw,
            deadline_confidence: parsed.deadlines_jsonb?.[0]?.confidence || null,
            deadlines_jsonb: parsed.deadlines_jsonb,
            subject_area: parsed.subject_area,
            school_name: parsed.school_name,
            admission_requirements: parsed.admission_requirements_jsonb,
            raw_snapshot_id: snapshotId,
            fetched_at: new Date().toISOString(),
          }, { onConflict: "programme_url" });
        }

        // ── Write to program_draft (unified schema) ──
        const programKey = `qs:${pu.url.replace(QS_BASE, "")}`;
        const extractedJson: Record<string, any> = {
          title: parsed.title,
          degree: parsed.degree,
          level: parsed.level,
          duration: parsed.duration,
          study_mode: parsed.study_mode,
          tuition_domestic: parsed.tuition_domestic,
          tuition_international: parsed.tuition_international,
          tuition_currency: parsed.tuition_currency,
          start_months: parsed.start_months,
          deadline_raw: parsed.deadline_raw,
          deadlines_jsonb: parsed.deadlines_jsonb,
          ielts_min: parsed.admission_requirements?.ielts || null,
          toefl_min: parsed.admission_requirements?.toefl || null,
          gpa_min: parsed.admission_requirements?.gpa || null,
          gmat_min: parsed.admission_requirements?.gmat || null,
          gre_min: parsed.admission_requirements?.gre || null,
          subject_area: parsed.subject_area,
          school_name: parsed.school_name,
          additional_requirements: parsed.additional_requirements,
        };

        // ── Build field_evidence_map with per-field evidence ──
        const fieldEvidence: Record<string, any> = {};
        for (const [field, value] of Object.entries(extractedJson)) {
          if (value !== null && value !== undefined && value !== "") {
            fieldEvidence[field] = {
              source: "qs_programme_page",
              url: pu.url,
              confidence: 0.7,
              snapshot_id: snapshotId,
              extracted_at: new Date().toISOString(),
            };
          }
        }

        await srv.from("program_draft").upsert({
          university_id: pu.university_id,
          program_key: programKey,
          source_url: pu.url,
          schema_version: "unified_v2",
          extracted_json: extractedJson,
          field_evidence_map: fieldEvidence,
          last_extracted_at: new Date().toISOString(),
          extractor_version: "qs-programme-detail-v2",
          review_status: "pending",
        }, { onConflict: "program_key" });

        // Mark URL as extracted
        await srv.from("program_urls").update({
          status: "extracted",
        }).eq("id", pu.id);

        processed++;
      } catch (err: any) {
        console.warn(`[qs-programme-detail] Error for ${pu.url}:`, err?.message);
        await srv.from("program_urls").update({
          status: "failed",
          fetch_error: err?.message?.slice(0, 200),
        }).eq("id", pu.id);
      }
    }

    return json({ ok: true, processed, total_candidates: urls.length, trace_id });
  } catch (err: any) {
    console.error("[qs-programme-detail] Fatal:", err);
    return json({ ok: false, error: err?.message }, 500);
  }
});

// ══════════════════════════════════════════════════════
// Programme Extraction — Full Coverage
// ══════════════════════════════════════════════════════

function extractProgramme(content: string, currentYear: number) {
  const result: any = { admission_requirements: {} };

  // ── Title: QS uses `# Title` at the top. May include a link: `# [Title](url)` ──
  const titleLinkMatch = content.match(/^# \[([^\]]+)\]/m);
  const titlePlainMatch = content.match(/^# ([^\n\[]+)/m);
  result.title = titleLinkMatch?.[1]?.trim() || titlePlainMatch?.[1]?.trim() || null;
  // Clean any trailing image markdown from title
  if (result.title) {
    result.title = result.title.replace(/!\[.*?\]\(.*?\)/g, "").replace(/\\\s*$/, "").trim();
  }

  // ── Degree + Level: QS uses structured `### Degree\n\nMSc` and `### Study Level\n\nMasters` ──
  const degreeMatch = content.match(/### Degree\n\n(\w+)/);
  result.degree = degreeMatch?.[1] || null;

  const levelMatch = content.match(/### Study Level\n\n(\w+)/);
  result.level = levelMatch?.[1] || null;

  // ── Study Mode: `### Study Mode\n\nOn Campus` ──
  const modeMatch = content.match(/### Study Mode\n\n([^\n]+)/);
  result.study_mode = modeMatch?.[1]?.trim() || null;

  // ── Duration: QS headline format `### 9 monthsProgramme duration` or `### 48 monthsProgramme duration` ──
  const durHeadline = content.match(/###\s*([\d]+\s*(?:months?|years?))\s*Programme duration/i);
  // Also try structured: `Program Duration\n\nN Months` or `Program Duration\n\nN Years`
  const durStructured = content.match(/Program Duration\n\n(\d+\s*(?:Months?|Years?))/i);
  result.duration = durHeadline?.[1]?.trim() || durStructured?.[1]?.trim() || null;

  // ── Tuition: QS headline format `### 28,040 GBPTuition Fee/year` ──
  const tuitionHeadline = content.match(/###\s*([\d,]+)\s*([A-Z]{3})\s*Tuition Fee\/year/i);
  
  // Also extract structured domestic/international split:
  // `##### Domestic\n\nStarts from\n\nNN,NNN CUR` and `##### International\n\nStarts from\n\nNN,NNN CUR`
  const domTuitionMatch = content.match(/##### Domestic\n\nStarts from\n\n([\d,]+)\s*([A-Z]{3})/);
  const intlTuitionMatch = content.match(/##### International\n\nStarts from\n\n([\d,]+)\s*([A-Z]{3})/);

  if (intlTuitionMatch) {
    result.tuition_international = parseInt(intlTuitionMatch[1].replace(/,/g, ""), 10);
    result.tuition_currency = intlTuitionMatch[2];
  }
  if (domTuitionMatch) {
    result.tuition_domestic = parseInt(domTuitionMatch[1].replace(/,/g, ""), 10);
    result.tuition_currency = result.tuition_currency || domTuitionMatch[2];
  }
  
  // Fallback to headline tuition if no structured split
  if (!result.tuition_international && !result.tuition_domestic && tuitionHeadline) {
    result.tuition_international = parseInt(tuitionHeadline[1].replace(/,/g, ""), 10);
    result.tuition_currency = tuitionHeadline[2];
  }

  // ── Admission Requirements: QS format `TOEFL\n\nNN+` `IELTS\n\nN.N+` `Bachelor GPA\n\nN.N+` ──
  const admPatterns: [string, RegExp][] = [
    ["toefl", /TOEFL\n\n(\d{2,3})\+?/],
    ["ielts", /IELTS\n\n([\d.]+)\+?/],
    ["gpa", /(?:Bachelor )?GPA\n\n([\d.]+)\+?/],
    ["gmat", /GMAT\n\n(\d{3})\+?/],
    ["gre", /GRE\n\n(\d{3})\+?/],
    ["cambridge", /Cambridge CAE (?:Advanced)?\n\n(\d+)\+?/],
    ["ib", /International Baccalaureate\n\n(\d+)\+?/],
    ["pte", /PTE Academic\n\n(\d+)\+?/],
  ];
  for (const [key, re] of admPatterns) {
    const m = content.match(re);
    if (m) result.admission_requirements[key] = m[1];
  }

  // Additional requirements text (paragraph after exam scores)
  const addlReqMatch = content.match(/(?:IELTS|TOEFL|GPA)\n\n[\d.]+\+?\n\n(.{30,500}?)(?=\n\n## |\n\n####)/s);
  result.additional_requirements = addlReqMatch?.[1]?.trim() || null;

  // Build structured admission_requirements for qs_programme_details
  result.admission_requirements_jsonb = Object.keys(result.admission_requirements).length > 0
    ? {
        test_scores: result.admission_requirements,
        additional: result.additional_requirements,
      }
    : null;

  // ── Start months: QS format `Starting Month(s)\n\nSep` (can appear multiple times) ──
  const startMatches = [...content.matchAll(/Starting Month\(s\)\n\n([A-Za-z]+)/g)];
  result.start_months = [...new Set(startMatches.map(m => m[1]))];

  // ── Deadlines: QS format `Application Deadline\n\nDATE` ──
  const deadlineMatches = [...content.matchAll(/(?:Application )?Deadline\n\n([^\n]+)/gi)];
  result.deadlines_jsonb = deadlineMatches.map((dm) => {
    const raw = dm[1].trim();
    const yearMatch = raw.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : 0;
    const confidence = year < 2000 ? "malformed" : year < currentYear ? "stale" : "fresh";
    return { raw, year, confidence };
  });
  result.deadline_raw = result.deadlines_jsonb[0]?.raw || null;

  // ── Subject area: QS uses `### SubjectMain Subject Area` in headline ──
  const subjectHeadline = content.match(/###\s*(.+?)Main Subject Area/);
  // Also structured: `### Main Subject\n\nSubject Name`
  const subjectStructured = content.match(/### Main Subject\n\n([^\n]+)/);
  result.subject_area = subjectStructured?.[1]?.trim() || subjectHeadline?.[1]?.trim() || null;

  // ── School name: look for `### School\n\nName` or school mention in text ──
  const schoolStructured = content.match(/### (?:School|Faculty|Department)\n\n([^\n]+)/);
  result.school_name = schoolStructured?.[1]?.trim() || null;

  return result;
}

async function firecrawlScrape(url: string): Promise<{ markdown?: string; html?: string } | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY") || Deno.env.get("FIRECRAWL_API_KEY_1");
  if (!apiKey) return null;
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "html"], waitFor: 5000 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return { markdown: data.data?.markdown || "", html: data.data?.html || "" };
  } catch { return null; }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(str.length, 10000); i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(16);
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function htmlToMarkdownSimple(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // Extract JSON-LD
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  let prefix = "";
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      if (ld.name) prefix += `# ${ld.name}\n\n`;
      if (ld.description) prefix += `${ld.description}\n\n`;
    } catch {}
  }

  const titleTag = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleTag && !prefix) {
    const clean = titleTag[1].replace(/\s*\|.*$/, "").replace(/\s*-\s*Top Universities.*$/i, "").trim();
    if (clean.length > 5) prefix = `# ${clean}\n\n`;
  }

  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n\n");
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n\n");
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n\n");
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n\n");
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n\n");
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n\n");
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");
  text = text.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "").replace(/&[a-z]+;/gi, "");
  text = text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ");
  text = text.split("\n").map(l => l.trim()).join("\n");
  return (prefix + text).trim();
}
