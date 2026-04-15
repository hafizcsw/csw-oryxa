/**
 * crawl-qs-profile-worker v3
 * 
 * Crawls a QS university profile page, extracts data into ALL 12+ specialized tables,
 * discovers programme links, and updates uniranks_crawl_state.
 * 
 * v3: ALWAYS use Firecrawl (QS is 100% JS-rendered, raw fetch has empty body).
 *     Falls back to JSON-LD extraction from raw HTML if Firecrawl unavailable.
 *     Section observation history per crawl_run_id, raw snapshots.
 * 
 * IMPORTANT: Door2 v1 = entity_type='university' ONLY. Schools deferred.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-trace-id, x-orxya-ingress",
};

const QS_BASE = "https://www.topuniversities.com";

// All 16 QS profile sections we track
const ALL_SECTIONS = [
  "about", "university_info", "rankings", "cost_of_living",
  "student_life", "similar_universities", "social_links",
  "admissions", "students_staff", "official_website",
  "campus_locations", "media", "faqs", "facilities",
  "employability", "tuition_summary",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Auth handled by Supabase JWT verify in config.toml (verify_jwt = false for global)

  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json();
    const { university_id, trace_id } = body;
    const sourceProfileUrl = body.source_profile_url
      || (body.qs_slug ? `${QS_BASE}/universities/${body.qs_slug}` : null);

    if (!university_id || !sourceProfileUrl) {
      return json({ ok: false, error: "missing university_id or source_profile_url" }, 400);
    }

    const profileUrl = sourceProfileUrl;
    const qs_slug = profileUrl.replace(`${QS_BASE}/universities/`, "");
    const now = new Date().toISOString();

    // Resolve entity_profile_id from qs_entity_profiles
    const { data: entityProfile } = await srv
      .from("qs_entity_profiles")
      .select("id")
      .eq("university_id", university_id)
      .single();

    const entityProfileId = entityProfile?.id;
    if (!entityProfileId) {
      await srv.from("uniranks_crawl_state").update({
        stage: "quarantined",
        quarantine_reason: "no_qs_entity_profile",
        quarantined_at: now,
        locked_until: null,
        locked_by: null,
      }).eq("university_id", university_id);
      return json({ ok: false, error: "no_qs_entity_profile", university_id });
    }

    // Generate crawl_run_id for section observation history
    const crawlRunId = `qs-${university_id.slice(0, 8)}-${Date.now()}`;

    // Mark as fetching
    await srv.from("uniranks_crawl_state").update({
      stage: "profile_fetching",
      locked_until: new Date(Date.now() + 120_000).toISOString(),
    }).eq("university_id", university_id);

    // ── FETCH STRATEGY: QS is 100% JS-rendered. We need TWO fetches: ──
    // 1) Raw fetch for JSON-LD (always available in <head>)
    // 2) Firecrawl with waitFor for rendered markdown (has all sections)
    let html = "";
    let markdown = "";
    let fetchMethod: "firecrawl" | "raw" = "firecrawl";

    // Step 1: Raw fetch to get HTML (for JSON-LD extraction)
    try {
      const resp = await fetch(profileUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (resp.ok) html = await resp.text();
    } catch (e: any) {
      console.warn(`[qs-profile] Raw fetch failed for ${profileUrl}:`, e?.message);
    }

    // Step 2: Firecrawl with waitFor for JS-rendered markdown
    const fcResult = await firecrawlScrape(profileUrl);
    if (fcResult && fcResult.markdown && fcResult.markdown.length > 500) {
      markdown = fcResult.markdown;
      // Use Firecrawl's HTML if we didn't get raw HTML
      if (!html || html.length < 1000) html = fcResult.html || html;
    }

    // If no markdown from Firecrawl, content = raw HTML (very limited, mostly JSON-LD)
    const content = markdown || "";
    const hasMarkdown = markdown.length > 500;

    if (html.length < 1000 && !hasMarkdown) {
      await srv.from("uniranks_crawl_state").update({
        stage: "quarantined",
        quarantine_reason: "empty_page",
        quarantined_at: now,
        locked_until: null,
        locked_by: null,
      }).eq("university_id", university_id);
      return json({ ok: false, error: "empty_page", university_id });
    }

    // ═══ GUARDRAIL: QS pages MUST use firecrawl — raw fetch is empty ═══
    if (!hasMarkdown) {
      fetchMethod = "raw";
      console.error(`[GUARDRAIL] fetch_method=raw for QS profile ${profileUrl} — quarantining`);
      await srv.from("uniranks_crawl_state").update({
        stage: "quarantined",
        quarantine_reason: "GUARDRAIL_NOT_FIRECRAWL",
        quarantined_at: now,
        locked_until: null,
        locked_by: null,
      }).eq("university_id", university_id);
      return json({ ok: false, error: "GUARDRAIL_NOT_FIRECRAWL", university_id });
    }

    // Store raw snapshot
    const { data: snapshot } = await srv.from("crawl_raw_snapshots").insert({
      source: "qs",
      source_url: profileUrl,
      content_hash: simpleHash(content || html),
      raw_html: html.slice(0, 500_000),
      raw_markdown: markdown.slice(0, 500_000),
      fetch_method: fetchMethod,
      metadata: { university_id, qs_slug, crawl_run_id: crawlRunId },
    }).select("id").single();

    const snapshotId = snapshot?.id;

    // ── Extract JSON-LD from raw HTML (always available) ──
    const jsonLd = extractJsonLd(html);

    // ── Extract ALL sections from rendered markdown + JSON-LD ──
    const sections = extractAllSections(content, jsonLd);
    const sectionResults: Record<string, { status: string; error?: string }> = {};

    // Initialize all sections as not_present
    for (const s of ALL_SECTIONS) {
      sectionResults[s] = { status: "not_present" };
    }

    // 1. About / University Info → qs_entity_profiles update
    try {
      const updates: any = { raw_snapshot_id: snapshotId, fetched_at: now };
      if (sections.about?.text) updates.about_text = sections.about.text.slice(0, 5000);
      if (sections.university_info?.type) updates.institution_type = sections.university_info.type;
      if (sections.official_website) updates.official_website = sections.official_website;
      if (sections.programme_count) updates.programme_count_qs = sections.programme_count;

      await srv.from("qs_entity_profiles").update(updates).eq("id", entityProfileId);
      if (sections.about) sectionResults.about = { status: "extracted" };
      if (sections.university_info) sectionResults.university_info = { status: "extracted" };
      if (sections.official_website) sectionResults.official_website = { status: "extracted" };
    } catch (e: any) {
      sectionResults.about = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 2. Rankings → qs_ranking_snapshots + GUARDRAIL: rank ≠ year
    try {
      if (sections.rankings) {
        const parsedRank = sections.rankings.world_rank ? parseInt(sections.rankings.world_rank) : null;
        
        // GUARDRAIL: If rank looks like a year (2020-2030), it's a regex bug → FAIL
        const isYearBug = parsedRank && parsedRank >= 2020 && parsedRank <= 2035;
        if (isYearBug) {
          console.error(`[GUARDRAIL] world_rank=${parsedRank} looks like a year, rejecting`);
          sectionResults.rankings = { status: "error", error: `GUARDRAIL_RANK_IS_YEAR:${parsedRank}` };
        } else {
          await srv.from("qs_ranking_snapshots").upsert({
            entity_profile_id: entityProfileId,
            ranking_year: new Date().getFullYear(),
            world_rank: parsedRank,
            overall_score: sections.rankings.overall_score ? parseFloat(sections.rankings.overall_score) : null,
            indicators: sections.rankings.indicators || null,
            subject_rankings: sections.rankings.subject_rankings || null,
            fetched_at: now,
          }, { onConflict: "entity_profile_id,ranking_year" });
          sectionResults.rankings = { status: "extracted" };
        }
      }
    } catch (e: any) {
      sectionResults.rankings = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 3. Cost of Living → qs_cost_of_living
    try {
      if (sections.cost_of_living) {
        const col = sections.cost_of_living;
        await srv.from("qs_cost_of_living").upsert({
          entity_profile_id: entityProfileId,
          accommodation_amount: parseAmount(col.accommodation_amount),
          food_amount: parseAmount(col.food_amount),
          transport_amount: parseAmount(col.transport_amount),
          utilities_amount: parseAmount(col.utilities_amount),
          currency: col.currency || null,
          raw_text: col.raw_text?.slice(0, 1000) || null,
          cost_of_living_text: col.raw_text?.slice(0, 2000) || null,
          fetched_at: now,
        }, { onConflict: "entity_profile_id" });
        sectionResults.cost_of_living = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.cost_of_living = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 4. Student Life → qs_student_life
    try {
      if (sections.student_life) {
        await srv.from("qs_student_life").upsert({
          entity_profile_id: entityProfileId,
          dorms_available: sections.student_life.dorms_available || false,
          counselling_available: sections.student_life.counselling_available || false,
          clubs_count: sections.student_life.clubs_hint || null,
          fetched_at: now,
        }, { onConflict: "entity_profile_id" });
        sectionResults.student_life = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.student_life = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 5. Similar Universities → qs_similar_entities
    try {
      if (sections.similar_entities && sections.similar_entities.length > 0) {
        const simRows = sections.similar_entities.map((slug: string) => ({
          entity_profile_id: entityProfileId,
          similar_qs_slug: slug,
        }));
        await srv.from("qs_similar_entities").upsert(simRows, {
          onConflict: "entity_profile_id,similar_qs_slug",
        });
        sectionResults.similar_universities = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.similar_universities = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 6. Social Links → update qs_entity_profiles
    try {
      if (sections.social_links && sections.social_links.length > 0) {
        await srv.from("qs_entity_profiles").update({
          social_links: sections.social_links,
        }).eq("id", entityProfileId);
        sectionResults.social_links = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.social_links = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 7. Admissions → qs_admission_summaries
    try {
      if (sections.admissions) {
        await srv.from("qs_admission_summaries").upsert({
          entity_profile_id: entityProfileId,
          level: sections.admissions.level || "general",
          test_scores: sections.admissions.test_scores || null,
          admission_text: sections.admissions.text?.slice(0, 3000) || null,
          fetched_at: now,
        }, { onConflict: "entity_profile_id,level" });
        sectionResults.admissions = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.admissions = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 8. Students & Staff → qs_students_staff
    try {
      if (sections.students_staff) {
        const ss = sections.students_staff;
        await srv.from("qs_students_staff").upsert({
          entity_profile_id: entityProfileId,
          total_students: ss.total_students || null,
          intl_students: ss.intl_students || null,
          total_faculty: ss.total_faculty || null,
          ug_pct: ss.ug_pct || null,
          pg_pct: ss.pg_pct || null,
          fetched_at: now,
        }, { onConflict: "entity_profile_id" });
        sectionResults.students_staff = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.students_staff = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 9. Campus Locations → qs_campus_locations (prefer JSON-LD)
    try {
      if (sections.campus_locations && sections.campus_locations.length > 0) {
        const campusRows = sections.campus_locations.map((c: any, i: number) => ({
          entity_profile_id: entityProfileId,
          campus_name: c.name || `Campus ${i + 1}`,
          is_main: i === 0,
          address: c.address || null,
          city: c.city || null,
          country_code: c.country_code || null,
          fetched_at: now,
        }));
        await srv.from("qs_campus_locations").delete().eq("entity_profile_id", entityProfileId);
        await srv.from("qs_campus_locations").insert(campusRows);
        sectionResults.campus_locations = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.campus_locations = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 10. Media / Photos / Videos → qs_media_assets
    try {
      if (sections.media) {
        await srv.from("qs_media_assets").upsert({
          entity_profile_id: entityProfileId,
          logo_url: sections.media.logo_url || null,
          cover_image_url: sections.media.cover_image_url || null,
          photo_assets: sections.media.photos || null,
          video_assets: sections.media.videos || null,
          gallery_present: sections.media.gallery_present || false,
          map_present: sections.media.map_present || false,
          fetched_at: now,
        }, { onConflict: "entity_profile_id" });
        sectionResults.media = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.media = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 11. FAQs → qs_faqs (prefer JSON-LD FAQPage)
    try {
      if (sections.faqs && sections.faqs.length > 0) {
        await srv.from("qs_faqs").delete().eq("entity_profile_id", entityProfileId);
        const faqRows = sections.faqs.map((faq: any) => ({
          entity_profile_id: entityProfileId,
          question: faq.question,
          answer: faq.answer,
          fetched_at: now,
        }));
        await srv.from("qs_faqs").insert(faqRows);
        sectionResults.faqs = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.faqs = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 12. Facilities → qs_facilities
    try {
      if (sections.facilities) {
        await srv.from("qs_facilities").upsert({
          entity_profile_id: entityProfileId,
          facilities_text: sections.facilities.text?.slice(0, 3000) || null,
          fetched_at: now,
        }, { onConflict: "entity_profile_id" });
        sectionResults.facilities = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.facilities = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 13. Employability → qs_employability
    try {
      if (sections.employability) {
        await srv.from("qs_employability").upsert({
          entity_profile_id: entityProfileId,
          career_services_text: sections.employability.text?.slice(0, 3000) || null,
          service_list: sections.employability.services || null,
          fetched_at: now,
        }, { onConflict: "entity_profile_id" });
        sectionResults.employability = { status: "extracted" };
      }
    } catch (e: any) {
      sectionResults.employability = { status: "error", error: e?.message?.slice(0, 100) };
    }

    // 14. Tuition summary
    if (sections.tuition_summary) {
      sectionResults.tuition_summary = { status: "extracted" };
    }

    // ── Section Observations ──
    const obsRows = ALL_SECTIONS.map((sectionName) => {
      const result = sectionResults[sectionName] || { status: "not_present" };
      return {
        entity_profile_id: entityProfileId,
        crawl_run_id: crawlRunId,
        section_name: sectionName,
        status: result.status,
        ignore_reason: result.status === "not_present" ? "not_found_in_html" : null,
        quarantine_reason: result.status === "error" ? (result.error || "extraction_error") : null,
        data_sample: null,
        observed_at: now,
      };
    });
    await srv.from("qs_section_observations").insert(obsRows);

    // Discover programme links from rendered markdown
    const programLinks = [...new Set(
      (content.match(/\/universities\/[a-z0-9-]+\/(?:postgrad|undergrad|mba|phd|masters?|bachelor)\/[a-z0-9-]+/g) || [])
    )];

    let programUrlsInserted = 0;
    for (const link of programLinks) {
      const fullUrl = `${QS_BASE}${link}`;
      const { error } = await srv.from("program_urls").upsert({
        university_id,
        url: fullUrl,
        canonical_url: fullUrl,
        kind: "program",
        status: "pending",
        discovered_from: `door2:qs_profile`,
      }, { onConflict: "university_id,kind,canonical_url", ignoreDuplicates: true }).single();
      if (!error) programUrlsInserted++;
    }

    // Update crawl state
    const nextStage = programLinks.length > 0 ? "programs_pending" : "done";
    await srv.from("uniranks_crawl_state").update({
      stage: nextStage,
      locked_until: null,
      locked_by: null,
      updated_at: now,
    }).eq("university_id", university_id);

    // Telemetry
    const extractedCount = Object.values(sectionResults).filter(r => r.status === "extracted").length;
    const errorCount = Object.values(sectionResults).filter(r => r.status === "error").length;

    await srv.from("pipeline_health_events").insert({
      pipeline: "door2_qs",
      event_type: "metric",
      metric: "qs_profile_harvested",
      value: 1,
      details_json: {
        trace_id,
        university_id,
        entity_profile_id: entityProfileId,
        qs_slug,
        crawl_run_id: crawlRunId,
        fetch_method: fetchMethod,
        snapshot_id: snapshotId,
        sections_extracted: extractedCount,
        sections_error: errorCount,
        sections_total: ALL_SECTIONS.length,
        program_links: programLinks.length,
        program_urls_inserted: programUrlsInserted,
        has_markdown: hasMarkdown,
      },
    });

    return json({
      ok: true,
      university_id,
      entity_profile_id: entityProfileId,
      crawl_run_id: crawlRunId,
      fetch_method: fetchMethod,
      snapshot_id: snapshotId,
      has_markdown: hasMarkdown,
      sections: Object.fromEntries(
        Object.entries(sectionResults).map(([k, v]) => [k, v.status])
      ),
      sections_extracted: extractedCount,
      sections_total: ALL_SECTIONS.length,
      program_links: programLinks.length,
      next_stage: nextStage,
    });
  } catch (err: any) {
    console.error("[qs-profile-worker] Error:", err);
    return json({ ok: false, error: err?.message }, 500);
  }
});

// ══════════════════════════════════════════════════════
// JSON-LD Extraction from raw HTML <head>
// ══════════════════════════════════════════════════════

interface JsonLdData {
  faqs: { question: string; answer: string }[];
  campuses: { name: string; address: string; city: string; postalCode: string; country: string; lat?: string; lng?: string }[];
  images: string[];
  logoUrl?: string;
  name?: string;
}

function extractJsonLd(html: string): JsonLdData {
  const result: JsonLdData = { faqs: [], campuses: [], images: [] };
  if (!html) return result;

  // Extract all JSON-LD blocks
  const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1]);

      // FAQPage → faqs
      if (parsed["@type"] === "FAQPage" && Array.isArray(parsed.mainEntity)) {
        for (const q of parsed.mainEntity) {
          if (q["@type"] === "Question" && q.name && q.acceptedAnswer?.text) {
            result.faqs.push({
              question: q.name.trim(),
              answer: q.acceptedAnswer.text
                .replace(/&nbsp;/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 2000),
            });
          }
        }
      }

      // CollegeOrUniversity with department (campuses)
      if (parsed["@type"] === "CollegeOrUniversity" && Array.isArray(parsed.department)) {
        for (const dept of parsed.department) {
          if (dept.address) {
            const addr = dept.address;
            const geo = dept.location?.geo;
            result.campuses.push({
              name: dept.name || "Campus",
              address: addr.streetAddress || "",
              city: addr.addressLocality || "",
              postalCode: addr.postalCode || "",
              country: addr.addressCountry || "",
              lat: geo?.latitude,
              lng: geo?.longitude,
            });
          }
        }
      }

      // ProfilePage → images + logo
      if (parsed["@type"] === "ProfilePage") {
        result.name = parsed.name;
        if (parsed.mainEntity) {
          if (parsed.mainEntity.logo) result.logoUrl = parsed.mainEntity.logo;
          if (Array.isArray(parsed.mainEntity.image)) {
            result.images = parsed.mainEntity.image;
          }
        }
      }
    } catch {
      // Skip invalid JSON-LD blocks
    }
  }

  return result;
}

// ══════════════════════════════════════════════════════
// Section Extraction — Rendered Markdown + JSON-LD
// ══════════════════════════════════════════════════════

function extractAllSections(content: string, jsonLd: JsonLdData) {
  const result: any = {};

  // ── About: `## About {Name}` followed by text, then `[Read more]` ... full text ... `[Read less]` ──
  const aboutMatch = content.match(/## About .+?\n\n([\s\S]+?)(?=\n\[Read (?:more|less)\])/i);
  if (aboutMatch) {
    // Try to get the full expanded text
    const fullAboutMatch = content.match(/## About .+?\n\n[\s\S]*?\[Read more\][^\n]*\n\n([\s\S]+?)(?=\n\[Read less\])/i);
    result.about = { text: (fullAboutMatch?.[1] || aboutMatch[1]).trim().slice(0, 5000) };
  }

  // ── University Info: institution type ──
  const typePrivate = /\bprivate\b/i.test(content.slice(0, 5000));
  const typePublic = /\bpublic\b/i.test(content.slice(0, 5000));
  const institutionType = typePrivate ? "Private" : typePublic ? "Public" : null;
  const foundedMatch = content.match(/(?:founded|established)\s*(?:in\s+)?(\d{4})/i);
  if (institutionType || foundedMatch) {
    result.university_info = { type: institutionType, founded: foundedMatch ? parseInt(foundedMatch[1]) : null };
  }

  // ── Official Website ──
  // Pattern 1: `[Official Website](url)` or `[Visit Website](url)`
  const officialMatch = content.match(/(?:Official Website|Visit (?:Institution )?Website|Visit Site)\]\((https?:\/\/(?!www\.topuniversities)[^\s)]+)\)/i);
  // Pattern 2: Title link `# [Name](url)` pointing to university domain
  const titleLinkMatch = content.match(/^# \[.+?\]\((https?:\/\/(?!www\.topuniversities)[^\s)]+)\)/m);
  // Pattern 3: Bare URL after "Website" heading: `### Website\n\nhttps://...`
  const websiteHeadingMatch = content.match(/###?\s*(?:Official )?Website\n\n(https?:\/\/(?!www\.topuniversities)[^\s]+)/i);
  // Pattern 4: Any explicit external link labeled "website" in markdown
  const websiteLabelMatch = content.match(/\[(?:website|official site|university website)\]\((https?:\/\/(?!www\.topuniversities)[^\s)]+)\)/i);
  if (officialMatch) result.official_website = officialMatch[1];
  else if (websiteHeadingMatch) result.official_website = websiteHeadingMatch[1];
  else if (websiteLabelMatch) result.official_website = websiteLabelMatch[1];
  else if (titleLinkMatch) result.official_website = titleLinkMatch[1];

  // ── Rankings: Rendered markdown uses `### \\# 4QS World University Rankings` or `### \\# =591QS World` ──
  // Also handles `### \# 4QS` without double escape
  const rankMatch = content.match(/###\s*\\{0,2}#\s*=?(\d+)\s*QS World University Rankings/i);
  if (rankMatch) {
    result.rankings = { world_rank: rankMatch[1] };

    // Overall score: `Overall\n\nNN.N`
    const overallMatch = content.match(/Overall\n\n([\d.]+)\n/);
    if (overallMatch) result.rankings.overall_score = overallMatch[1];

    // Ranking indicators
    const indicatorNames = [
      "Academic Reputation", "Citations per Faculty", "Employment Outcomes",
      "Employer Reputation", "Faculty Student Ratio", "International Faculty Ratio",
      "International Research Network", "International Student Diversity",
      "International Student Ratio", "Sustainability"
    ];
    const indicators: Record<string, number> = {};
    for (const name of indicatorNames) {
      const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\n\\n([\\d.]+)", "i");
      const m = content.match(re);
      if (m) indicators[name] = parseFloat(m[1]);
    }
    if (Object.keys(indicators).length > 0) result.rankings.indicators = indicators;

    // Subject rankings
    const subjectMatches = [...content.matchAll(/\[#=?(\d+)\\?\n\*\*(.+?)\*\*\]/g)];
    if (subjectMatches.length > 0) {
      result.rankings.subject_rankings = subjectMatches
        .filter(m => !m[2].includes("QS World"))
        .map(m => ({ subject: m[2].trim(), rank: parseInt(m[1]) }));
    }
  }

  // ── Programme count: `### 325Undergrad & Postgrad Programmes` ──
  const progCountMatch = content.match(/###\s*(\d+)\s*Undergrad & Postgrad Programmes/i);
  if (progCountMatch) {
    result.programme_count = parseInt(progCountMatch[1]);
  }

  // ── Cost of Living ──
  // ── Cost of Living: multiple heading patterns ──
  // Pattern 1: `## Cost of Living` or `#### Cost of Living`
  // Pattern 2: Inline `Cost of living` within larger section
  const colSection = content.match(/(?:#{2,4}\s*Cost of Living[\s\S]*?)(?=#{2,4}\s*(?:Scholarships|Employability|Rankings|Videos|Campus Locations|FAQ|Facilities|Similar|Students & Staff)|$)/i);
  // Fallback: look for cost keywords in a broader area
  const colFallback = !colSection ? content.match(/(Accommodation[\s\S]{0,100}[\$€£][\d,]+[\s\S]{0,500}(?:Transport|Food|Utilities)[\s\S]{0,200}[\$€£]?[\d,]+)/i) : null;
  const colText = colSection?.[0] || colFallback?.[0] || "";
  if (colText.length > 20) {
    const col: any = {};

    // QS shows amounts: `$10,660`, `€500`, `£1,200`, or plain `10,660`
    const accMatch = colText.match(/Accommodation\n\n[\$€£]?([\d,]+)/);
    const foodMatch = colText.match(/Food\n\n[\$€£]?([\d,]+)/);
    const transportMatch = colText.match(/Transport\n\n[\$€£]?([\d,]+)/);
    const utilitiesMatch = colText.match(/Utilities\n\n[\$€£]?([\d,]+)/);
    // Also try inline: `Accommodation: $X,XXX`
    const accInline = !accMatch ? colText.match(/Accommodation[:\s]+[\$€£]?([\d,]+)/i) : null;
    const foodInline = !foodMatch ? colText.match(/Food[:\s]+[\$€£]?([\d,]+)/i) : null;
    const transportInline = !transportMatch ? colText.match(/Transport[:\s]+[\$€£]?([\d,]+)/i) : null;
    const utilitiesInline = !utilitiesMatch ? colText.match(/Utilities[:\s]+[\$€£]?([\d,]+)/i) : null;
    const currencyMatch = colText.match(/([\$€£])\d/);

    if (accMatch || accInline) col.accommodation_amount = (accMatch?.[1] || accInline?.[1])!.replace(/,/g, "");
    if (foodMatch || foodInline) col.food_amount = (foodMatch?.[1] || foodInline?.[1])!.replace(/,/g, "");
    if (transportMatch || transportInline) col.transport_amount = (transportMatch?.[1] || transportInline?.[1])!.replace(/,/g, "");
    if (utilitiesMatch || utilitiesInline) col.utilities_amount = (utilitiesMatch?.[1] || utilitiesInline?.[1])!.replace(/,/g, "");
    col.currency = currencyMatch?.[1] === "€" ? "EUR" : currencyMatch?.[1] === "£" ? "GBP" : "USD";

    const colDescMatch = colText.match(/(?:##|####)\s*Cost of Living\n\n(.+?)(?:\n\n####|\n\n#####)/s);
    if (colDescMatch) col.raw_text = colDescMatch[1].trim().slice(0, 2000);
    else col.raw_text = colText.replace(/#{1,5}[^\n]*/g, "").trim().slice(0, 2000);

    if (col.accommodation_amount || col.food_amount || col.transport_amount || col.utilities_amount || col.raw_text) {
      result.cost_of_living = col;
    }
  }

  // ── Student Life ──
  const studentLifeMatch = content.match(/####?\s*Student life\n\n([\s\S]+?)(?=####?\s|## [A-Z])/i);
  if (studentLifeMatch) {
    const slText = studentLifeMatch[1];
    result.student_life = {
      dorms_available: /dorm|residence|housing|on.campus.(?:living|accommodation)/i.test(slText),
      counselling_available: /counsell|mental.health|support.services/i.test(slText),
      clubs_hint: (slText.match(/(?:clubs?|societ|organization)/gi) || []).length,
    };
  }

  // ── Similar Universities ──
  const simMatch = content.match(/similar.universit[\s\S]{0,500}/i);
  if (simMatch) {
    const slugs = (simMatch[0].match(/\/universities\/([a-z0-9-]+)/g) || [])
      .map((l: string) => l.replace("/universities/", ""));
    if (slugs.length > 0) result.similar_entities = [...new Set(slugs)];
  }

  // ── Social Links ──
  const socials: string[] = [];
  if (/facebook\.com/i.test(content)) socials.push("facebook");
  if (/(?:twitter|x)\.com/i.test(content)) socials.push("twitter");
  if (/linkedin\.com/i.test(content)) socials.push("linkedin");
  if (/instagram\.com/i.test(content)) socials.push("instagram");
  if (/youtube\.com/i.test(content)) socials.push("youtube");
  if (socials.length > 0) result.social_links = socials;

  // ── Admissions ──
  const admSection = content.match(/(?:## Admission|#### (?:Admission|Bachelor|Master))[\s\S]*?(?=## [A-Z]|#### (?:Employability|Cost|Student|Facilities|Ranking|Campus|FAQ|Scholarship))/i);
  if (admSection) {
    const admText = admSection[0];
    const admResult: any = {};
    admResult.text = admText.replace(/#{1,5}[^\n]*/g, "").replace(/\[.*?\]/g, "").trim().slice(0, 3000);

    const testScores: Record<string, string> = {};
    const ieltsMatch = admText.match(/IELTS\n\n([\d.]+)\+?/i);
    const toeflMatch = admText.match(/TOEFL\n\n(\d{2,3})\+?/i);
    const gpaMatch = admText.match(/(?:Bachelor )?GPA\n\n([\d.]+)\+?/i);
    const gmatMatch = admText.match(/GMAT\n\n(\d{3})\+?/i);
    const greMatch = admText.match(/GRE\n\n(\d{3})\+?/i);
    if (ieltsMatch) testScores.ielts = ieltsMatch[1];
    if (toeflMatch) testScores.toefl = toeflMatch[1];
    if (gpaMatch) testScores.gpa = gpaMatch[1];
    if (gmatMatch) testScores.gmat = gmatMatch[1];
    if (greMatch) testScores.gre = greMatch[1];
    admResult.test_scores = Object.keys(testScores).length > 0 ? testScores : null;
    admResult.level = /postgrad|master|mba|phd/i.test(admText) ? "postgraduate" : "general";
    result.admissions = admResult;
  }

  // ── Students & Staff ──
  const ssSection = content.match(/## Students & Staff[\s\S]*?(?=## [A-Z]|####)/i);
  if (ssSection) {
    const ss: any = {};
    const ssText = ssSection[0];
    const totalMatch = ssText.match(/Total students\n\n([\d,]+)/i);
    const intlMatch = ssText.match(/International students\n\n([\d,]+)/i);
    const facultyMatch = ssText.match(/Total faculty staff\n\n([\d,]+)/i);
    if (totalMatch) ss.total_students = parseInt(totalMatch[1].replace(/,/g, ""));
    if (intlMatch) ss.intl_students = parseInt(intlMatch[1].replace(/,/g, ""));
    if (facultyMatch) ss.total_faculty = parseInt(facultyMatch[1].replace(/,/g, ""));
    if (Object.keys(ss).length > 0) result.students_staff = ss;
  }

  // ── Campus Locations: PREFER JSON-LD (structured, clean) ──
  if (jsonLd.campuses.length > 0) {
    result.campus_locations = jsonLd.campuses.map((c, i) => ({
      name: c.name,
      address: c.address,
      city: c.city,
      country_code: c.country,
      postal_code: c.postalCode,
      is_main: i === 0,
    }));
  } else {
    // Fallback: parse from rendered markdown
    const campusSection = content.match(/## Campus locations[\s\S]*?(?=## [A-Z]|#### Frequently)/i);
    if (campusSection) {
      const addresses = [...campusSection[0].matchAll(/^([^\n]{5,80})\n\n([^\n]+),?\n\n([A-Z]{2})\n\n(\d+)?/gm)];
      if (addresses.length > 0) {
        result.campus_locations = addresses.map((m, i) => ({
          address: m[1].trim(),
          city: m[2].trim(),
          country_code: m[3],
          postal_code: m[4] || null,
          is_main: i === 0,
        }));
      }
    }
  }

  // ── Media: logos, YouTube, gallery from JSON-LD + markdown ──
  const mediaResult: any = { gallery_present: false, map_present: false };
  
  // Logo from JSON-LD or markdown
  if (jsonLd.logoUrl) {
    mediaResult.logo_url = jsonLd.logoUrl;
  } else {
    const logoMatch = content.match(/!\[university logo\]\(([^\s)]+)\)/i);
    if (logoMatch) mediaResult.logo_url = logoMatch[1];
  }

  // Images from JSON-LD
  if (jsonLd.images.length > 0) {
    mediaResult.photos = jsonLd.images.slice(0, 20);
    mediaResult.gallery_present = true;
  } else {
    // Fallback: gallery from markdown
    const galleryMatches = [...content.matchAll(/profiles-slideshow\/\d+\/([^\s")]+)/g)];
    if (galleryMatches.length > 0) {
      mediaResult.photos = galleryMatches.slice(0, 20).map(m => m[0]);
      mediaResult.gallery_present = true;
    }
  }

  // YouTube videos
  const ytMatches = [...content.matchAll(/img\.youtube\.com\/vi\/([\w-]+)/g)];
  if (ytMatches.length > 0) {
    mediaResult.videos = [...new Set(ytMatches.map(m => m[1]))].map(id => ({ platform: "youtube", id }));
  }

  mediaResult.map_present = /Open in Maps/i.test(content);
  if (mediaResult.logo_url || (mediaResult.videos && mediaResult.videos.length > 0) || mediaResult.gallery_present) {
    result.media = mediaResult;
  }

  // ── FAQs: PREFER JSON-LD FAQPage (always available in raw HTML) ──
  if (jsonLd.faqs.length > 0) {
    result.faqs = jsonLd.faqs;
  } else {
    // Fallback: parse from rendered markdown
    const faqSection = content.match(/(?:####?\s*Frequently Asked Questions)([\s\S]*?)(?=## [A-Z]|####?\s*(?!Frequently))/i);
    if (faqSection) {
      const faqParts = faqSection[1].split(/\n{3,}/);
      const faqs: { question: string; answer: string }[] = [];
      for (let i = 0; i < faqParts.length - 1; i++) {
        const q = faqParts[i].trim();
        const a = faqParts[i + 1].trim();
        if (q && q.length > 10 && q.length < 500 && a && a.length > 15 && !q.startsWith("[") && !q.startsWith("!")) {
          faqs.push({ question: q, answer: a.slice(0, 1000) });
          i++;
        }
      }
      if (faqs.length > 0) result.faqs = faqs;
    }
  }

  // ── Facilities ──
  const facSection = content.match(/## Facilities\n\n([\s\S]+?)(?=## [A-Z]|#### )/i);
  if (facSection) {
    result.facilities = { text: facSection[1].replace(/\[.*?\]/g, "").trim().slice(0, 3000) };
  }

  // ── Employability ──
  // QS uses multiple heading styles: `## Career Services`, `#### Employability`, `## Employability`
  // Also: `### Career Services` or `## Career services and employability`
  const empSection = content.match(/(?:#{2,4}\s*(?:Career Services?|Employability|Career services and employability))\n\n([\s\S]+?)(?=#{2,4}\s*(?!Career|Employability)[A-Z])/i);
  // Fallback: broader search for career/employability block
  const empFallback = !empSection ? content.match(/(?:#{2,4}\s*(?:Career|Employment|Graduate Outcomes)[\s\S]*?)\n\n([\s\S]+?)(?=#{2,4}\s*[A-Z])/i) : null;
  const empRaw = empSection?.[1] || empFallback?.[1] || "";
  if (empRaw.length > 20) {
    const empText = empRaw.replace(/\[.*?\]\(.*?\)/g, "").trim();
    result.employability = {
      text: empText.slice(0, 3000),
      services: null,
    };
    const serviceList = [...empText.matchAll(/^[-•*]\s*(.+)/gm)];
    if (serviceList.length > 0) {
      result.employability.services = serviceList.map(m => m[1].trim());
    }
  }

  // ── Tuition summary ──
  if (/tuition|fee|cost.of.study/i.test(content)) {
    const tuitionMatch = content.match(/tuition[\s\S]{0,200}/i);
    if (tuitionMatch) result.tuition_summary = { raw: tuitionMatch[0].slice(0, 300) };
  }

  return result;
}

function parseAmount(val: string | undefined): number | null {
  if (!val) return null;
  const num = parseInt(val.replace(/,/g, ""), 10);
  return isNaN(num) ? null : num;
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

async function firecrawlScrape(url: string): Promise<{ markdown?: string; html?: string } | null> {
  // Try FIRECRAWL_API_KEY_1 (managed connector) first, then FIRECRAWL_API_KEY (manual)
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY") || Deno.env.get("FIRECRAWL_API_KEY_1");
  if (!apiKey) {
    console.warn("[qs-profile] No FIRECRAWL_API_KEY set — QS pages need JS rendering");
    return null;
  }
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        waitFor: 5000,
        onlyMainContent: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!resp.ok) {
      console.warn(`[qs-profile] Firecrawl returned ${resp.status} for ${url}`);
      return null;
    }
    const data = await resp.json();
    return { markdown: data.data?.markdown || "", html: data.data?.html || "" };
  } catch (e: any) {
    console.warn("[qs-profile] Firecrawl error:", e?.message);
    return null;
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
