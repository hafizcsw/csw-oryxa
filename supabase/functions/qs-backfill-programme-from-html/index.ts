/**
 * qs-backfill-programme-from-html
 * 
 * Read-only from network perspective: NO new crawls, NO Firecrawl calls.
 * Reads existing raw_html from crawl_raw_snapshots, converts to markdown,
 * re-extracts programme fields, and updates:
 *   1. crawl_raw_snapshots.raw_markdown (backfill)
 *   2. qs_programme_entries (canonical queue — INSERT if missing)
 *   3. qs_programme_details (UPDATE extracted fields)
 * 
 * Scope: single entity_profile_id (e.g. Oxford)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-trace-id, x-orxya-ingress",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json();
    const { entity_profile_id, limit = 500, dry_run = false } = body;

    if (!entity_profile_id) {
      return json({ ok: false, error: "entity_profile_id required" }, 400);
    }

    // Get entity profile for context
    const { data: profile } = await srv
      .from("qs_entity_profiles")
      .select("id, qs_slug, university_id, name")
      .eq("id", entity_profile_id)
      .single();

    if (!profile) {
      return json({ ok: false, error: "entity_profile not found" }, 404);
    }

    // Get all programme_details shells for this entity
    const { data: shells, error: shellErr } = await srv
      .from("qs_programme_details")
      .select("id, programme_url, raw_snapshot_id, title, degree, level")
      .eq("entity_profile_id", entity_profile_id)
      .is("title", null)
      .order("programme_url")
      .limit(limit);

    if (shellErr || !shells) {
      return json({ ok: false, error: shellErr?.message || "no shells found" }, 500);
    }

    const stats = {
      total_shells: shells.length,
      snapshots_found: 0,
      html_present: 0,
      md_converted: 0,
      md_already_present: 0,
      extracted_ok: 0,
      extraction_failed: 0,
      entries_created: 0,
      details_updated: 0,
      already_extracted: 0,
      errors: [] as string[],
    };

    const currentYear = new Date().getFullYear();
    const traceId = `backfill-html-${Date.now()}`;

    for (const shell of shells) {
      try {
        // Skip if already has data
        if (shell.title && shell.degree && shell.level) {
          stats.already_extracted++;
          continue;
        }

        if (!shell.raw_snapshot_id) {
          stats.errors.push(`no_snapshot:${shell.programme_url}`);
          continue;
        }

        // Fetch snapshot
        const { data: snap } = await srv
          .from("crawl_raw_snapshots")
          .select("id, raw_html, raw_markdown, source_url")
          .eq("id", shell.raw_snapshot_id)
          .single();

        if (!snap) {
          stats.errors.push(`snapshot_missing:${shell.raw_snapshot_id}`);
          continue;
        }

        stats.snapshots_found++;

        let markdown = snap.raw_markdown || "";

        // If markdown already present and substantial, use it
        if (markdown.length > 300) {
          stats.md_already_present++;
        } else if (snap.raw_html && snap.raw_html.length > 500) {
          stats.html_present++;
          // Convert HTML to markdown
          markdown = htmlToMarkdown(snap.raw_html);
          stats.md_converted++;

          // Backfill raw_markdown in snapshot
          if (!dry_run) {
            await srv
              .from("crawl_raw_snapshots")
              .update({ raw_markdown: markdown.slice(0, 500_000) })
              .eq("id", snap.id);
          }
        } else {
          stats.errors.push(`no_content:${shell.programme_url}`);
          continue;
        }

        if (markdown.length < 100) {
          stats.errors.push(`md_too_short:${shell.programme_url}:${markdown.length}`);
          continue;
        }

        // Extract programme fields from markdown
        const parsed = extractProgrammeFromMarkdown(markdown, currentYear);

        if (!parsed.title) {
          // Try fallback: extract from URL
          parsed.title = titleFromUrl(shell.programme_url);
        }

        if (!parsed.title) {
          stats.extraction_failed++;
          stats.errors.push(`no_title:${shell.programme_url}`);
          continue;
        }

        // Infer level from URL if not extracted
        if (!parsed.level) {
          if (shell.programme_url.includes("/postgrad/") || shell.programme_url.includes("/masters/")) {
            parsed.level = "Masters";
          } else if (shell.programme_url.includes("/undergrad/")) {
            parsed.level = "Undergraduate";
          } else if (shell.programme_url.includes("/phd/") || shell.programme_url.includes("/dphil/")) {
            parsed.level = "Doctoral";
          }
        }

        stats.extracted_ok++;

        if (dry_run) continue;

        // 1. Ensure qs_programme_entries row exists (canonical queue)
        const { data: existingEntry } = await srv
          .from("qs_programme_entries")
          .select("id")
          .eq("programme_url", shell.programme_url)
          .maybeSingle();

        if (!existingEntry) {
          const { error: entryErr } = await srv
            .from("qs_programme_entries")
            .insert({
              entity_profile_id: entity_profile_id,
              qs_slug: profile.qs_slug,
              programme_url: shell.programme_url,
              title: parsed.title,
              degree: parsed.degree || null,
              level: parsed.level || null,
              crawl_status: "extracted",
              snapshot_id: shell.raw_snapshot_id,
              fetched_at: new Date().toISOString(),
              crawl_run_id: traceId,
            });

          if (entryErr) {
            // Might be duplicate key
            if (!entryErr.message.includes("duplicate")) {
              stats.errors.push(`entry_insert:${entryErr.message}:${shell.programme_url}`);
            }
          } else {
            stats.entries_created++;
          }
        }

        // 2. Update qs_programme_details with extracted fields
        const { error: updateErr } = await srv
          .from("qs_programme_details")
          .update({
            title: parsed.title,
            degree: parsed.degree || null,
            level: parsed.level || null,
            duration: parsed.duration || null,
            study_mode: parsed.study_mode || null,
            tuition_domestic: parsed.tuition_domestic || null,
            tuition_international: parsed.tuition_international || null,
            tuition_currency: parsed.tuition_currency || null,
            start_months: parsed.start_months?.length ? parsed.start_months : null,
            deadline_raw: parsed.deadline_raw || null,
            deadline_confidence: parsed.deadline_confidence || null,
            deadlines_jsonb: parsed.deadlines_jsonb?.length ? parsed.deadlines_jsonb : null,
            subject_area: parsed.subject_area || null,
            school_name: parsed.school_name || null,
            admission_requirements: parsed.admission_requirements_jsonb || null,
            fetched_at: new Date().toISOString(),
          })
          .eq("id", shell.id);

        if (updateErr) {
          stats.errors.push(`detail_update:${updateErr.message}:${shell.programme_url}`);
        } else {
          stats.details_updated++;
        }
      } catch (err: any) {
        stats.errors.push(`fatal:${err?.message}:${shell.programme_url}`);
      }
    }

    return json({
      ok: true,
      trace_id: traceId,
      entity: { id: profile.id, name: profile.name, qs_slug: profile.qs_slug },
      stats,
      dry_run,
    });
  } catch (err: any) {
    console.error("[qs-backfill-programme-from-html] Fatal:", err);
    return json({ ok: false, error: err?.message }, 500);
  }
});

// ══════════════════════════════════════════════════════
// HTML → Markdown Converter (deterministic, no external deps)
// ══════════════════════════════════════════════════════

function htmlToMarkdown(html: string): string {
  let text = html;

  // Remove script, style, nav, footer, header tags and their content
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // Extract JSON-LD for structured data
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  let jsonLdInfo = "";
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      if (ld.name) jsonLdInfo += `# ${ld.name}\n\n`;
      if (ld.description) jsonLdInfo += `${ld.description}\n\n`;
      if (ld.provider?.name) jsonLdInfo += `Provider: ${ld.provider.name}\n\n`;
    } catch {}
  }

  // Extract <title> tag
  const titleTag = html.match(/<title[^>]*>(.*?)<\/title>/i);
  let titleInfo = "";
  if (titleTag) {
    const cleanTitle = titleTag[1].replace(/\s*\|.*$/, "").replace(/\s*-\s*Top Universities.*$/i, "").trim();
    if (cleanTitle && !jsonLdInfo.includes(cleanTitle)) {
      titleInfo = `# ${cleanTitle}\n\n`;
    }
  }

  // Extract meta description
  const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) ||
                   html.match(/<meta\s+content="([^"]+)"\s+name="description"/i);
  let metaInfo = "";
  if (metaDesc) {
    metaInfo = `${metaDesc[1]}\n\n`;
  }

  // Convert headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n\n");
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n\n");
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n\n");
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n\n");
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n\n");

  // Convert links
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Convert paragraphs and divs
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n\n");
  text = text.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, "\n$1\n");

  // Convert lists
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  text = text.replace(/<\/?[uo]l[^>]*>/gi, "\n");

  // Convert line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Convert bold/italic
  text = text.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");
  text = text.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*");

  // Convert tables to readable format
  text = text.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, "$1\n");
  text = text.replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi, "$1 | ");

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&#\d+;/g, "");
  text = text.replace(/&[a-z]+;/gi, "");

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/[ \t]+/g, " ");
  text = text.split("\n").map((l) => l.trim()).join("\n");

  // Prepend structured data from JSON-LD and title
  const prefix = jsonLdInfo || titleInfo;
  return (prefix + metaInfo + text).trim();
}

// ══════════════════════════════════════════════════════
// Programme Extraction (markdown-based, same patterns as pipeline)
// ══════════════════════════════════════════════════════

function extractProgrammeFromMarkdown(content: string, currentYear: number) {
  const result: any = { admission_requirements: {} };

  // Title: multiple patterns
  const titleLinkMatch = content.match(/^# \[([^\]]+)\]/m);
  const titlePlainMatch = content.match(/^# ([^\n\[]+)/m);
  result.title = titleLinkMatch?.[1]?.trim() || titlePlainMatch?.[1]?.trim() || null;
  if (result.title) {
    result.title = result.title.replace(/!\[.*?\]\(.*?\)/g, "").replace(/\\\s*$/, "").trim();
    // Remove "at University of X" suffix if present
    result.title = result.title.replace(/\s+at\s+.*University.*$/i, "").trim();
  }

  // Filter out shell/placeholder titles
  const SHELL_TITLES = [
    "university directory search", "search results", "qs world university rankings",
    "top universities", "find your perfect university", "compare universities",
    "university rankings", "cookie", "privacy",
  ];
  if (result.title) {
    const tl = result.title.toLowerCase();
    if (SHELL_TITLES.some((s) => tl === s || tl.startsWith(s)) || tl.length < 5) {
      result.title = null;
    }
  }

  // Degree + Level (QS format)
  const degreeMatch = content.match(/### Degree\n\n(\w+)/);
  result.degree = degreeMatch?.[1] || null;
  if (!result.degree) {
    const degreeAlt = content.match(/Degree[:\s]*([A-Z][A-Za-z]+)/);
    result.degree = degreeAlt?.[1] || null;
  }

  const levelMatch = content.match(/### Study Level\n\n(\w+)/);
  result.level = levelMatch?.[1] || null;
  if (!result.level) {
    const levelAlt = content.match(/Study Level[:\s]*([A-Za-z]+)/);
    result.level = levelAlt?.[1] || null;
  }

  // Study Mode
  const modeMatch = content.match(/### Study Mode\n\n([^\n]+)/);
  result.study_mode = modeMatch?.[1]?.trim() || null;
  if (!result.study_mode) {
    if (/\bfull[- ]?time\b/i.test(content)) result.study_mode = "Full-Time";
    else if (/\bpart[- ]?time\b/i.test(content)) result.study_mode = "Part-Time";
    else if (/\bonline\b/i.test(content)) result.study_mode = "Online";
  }

  // Duration
  const durHeadline = content.match(/###\s*([\d]+\s*(?:months?|years?))\s*Programme duration/i);
  const durStructured = content.match(/Program(?:me)? Duration\n\n(\d+\s*(?:Months?|Years?))/i);
  const durAlt = content.match(/Duration[:\s]*([^\n]+)/i);
  result.duration = durHeadline?.[1]?.trim() || durStructured?.[1]?.trim() || durAlt?.[1]?.trim() || null;

  // Tuition
  const tuitionHeadline = content.match(/###\s*([\d,]+)\s*([A-Z]{3})\s*Tuition Fee\/year/i);
  const domTuitionMatch = content.match(/##### Domestic\n\nStarts from\n\n([\d,]+)\s*([A-Z]{3})/);
  const intlTuitionMatch = content.match(/##### International\n\nStarts from\n\n([\d,]+)\s*([A-Z]{3})/);
  // Also try: "International ... NN,NNN CUR"
  const intlAlt = content.match(/International[\s\S]{0,100}?([\d,]+)\s*([A-Z]{3})/);
  const domAlt = content.match(/Domestic[\s\S]{0,100}?([\d,]+)\s*([A-Z]{3})/);

  if (intlTuitionMatch) {
    result.tuition_international = parseInt(intlTuitionMatch[1].replace(/,/g, ""), 10);
    result.tuition_currency = intlTuitionMatch[2];
  } else if (intlAlt) {
    result.tuition_international = parseInt(intlAlt[1].replace(/,/g, ""), 10);
    result.tuition_currency = intlAlt[2];
  }
  if (domTuitionMatch) {
    result.tuition_domestic = parseInt(domTuitionMatch[1].replace(/,/g, ""), 10);
    result.tuition_currency = result.tuition_currency || domTuitionMatch[2];
  } else if (domAlt) {
    result.tuition_domestic = parseInt(domAlt[1].replace(/,/g, ""), 10);
    result.tuition_currency = result.tuition_currency || domAlt[2];
  }
  if (!result.tuition_international && !result.tuition_domestic && tuitionHeadline) {
    result.tuition_international = parseInt(tuitionHeadline[1].replace(/,/g, ""), 10);
    result.tuition_currency = tuitionHeadline[2];
  }

  // Admission Requirements
  const admPatterns: [string, RegExp][] = [
    ["toefl", /TOEFL\n\n(\d{2,3})\+?/],
    ["ielts", /IELTS\n\n([\d.]+)\+?/],
    ["gpa", /(?:Bachelor )?GPA\n\n([\d.]+)\+?/],
    ["gmat", /GMAT\n\n(\d{3})\+?/],
    ["gre", /GRE\n\n(\d{3})\+?/],
  ];
  for (const [key, re] of admPatterns) {
    const m = content.match(re);
    if (m) result.admission_requirements[key] = m[1];
  }
  result.admission_requirements_jsonb =
    Object.keys(result.admission_requirements).length > 0
      ? { test_scores: result.admission_requirements }
      : null;

  // Start months
  const startMatches = [...content.matchAll(/Starting Month\(s\)\n\n([A-Za-z]+)/g)];
  result.start_months = [...new Set(startMatches.map((m) => m[1]))];
  if (!result.start_months.length) {
    const startAlt = content.match(/Start(?:ing)?\s*(?:Month|Date|Period)?[:\s]*([A-Z][a-z]{2,8}(?:\s*[,/&]\s*[A-Z][a-z]{2,8})*)/);
    if (startAlt) {
      result.start_months = startAlt[1].split(/[,/&]/).map((s: string) => s.trim()).filter(Boolean);
    }
  }

  // Deadlines
  const deadlineMatches = [...content.matchAll(/(?:Application )?Deadline\n\n([^\n]+)/gi)];
  result.deadlines_jsonb = deadlineMatches.map((dm) => {
    const raw = dm[1].trim();
    const yearMatch = raw.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : 0;
    const confidence = year < 2000 ? "malformed" : year < currentYear ? "stale" : "fresh";
    return { raw, year, confidence };
  });
  result.deadline_raw = result.deadlines_jsonb[0]?.raw || null;
  result.deadline_confidence = result.deadlines_jsonb[0]?.confidence || null;

  // Subject area
  const subjectHeadline = content.match(/###\s*(.+?)Main Subject Area/);
  const subjectStructured = content.match(/### Main Subject\n\n([^\n]+)/);
  const subjectAlt = content.match(/Subject(?:\s*Area)?[:\s]*([^\n]+)/i);
  result.subject_area =
    subjectStructured?.[1]?.trim() || subjectHeadline?.[1]?.trim() || subjectAlt?.[1]?.trim() || null;

  // School name
  const schoolStructured = content.match(/### (?:School|Faculty|Department)\n\n([^\n]+)/);
  result.school_name = schoolStructured?.[1]?.trim() || null;

  return result;
}

function titleFromUrl(url: string): string | null {
  // Extract programme name from URL like .../postgrad/msc-migration-studies
  const match = url.match(/\/(undergrad|postgrad|phd|dphil)\/(.+?)$/);
  if (!match) return null;
  const slug = match[2];
  // Convert slug to title: msc-migration-studies -> MSc Migration Studies
  const words = slug.split("-").map((w, i) => {
    // Keep degree abbreviations uppercase
    if (/^(msc|ma|mba|mphil|bsc|ba|beng|meng|phd|dphil|llm|llb|pgdip|pgcert|mres|med|msw|mph)$/i.test(w)) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }
    if (w.length <= 2 && i > 0) return w; // "in", "of", etc
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
  return words.join(" ");
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
