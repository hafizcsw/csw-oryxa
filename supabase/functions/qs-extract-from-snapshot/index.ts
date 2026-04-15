/**
 * qs-extract-from-snapshot
 * 
 * Extracts structured data from EXISTING snapshots in crawl_raw_snapshots.
 * NO Firecrawl. NO re-crawl. Reads markdown already saved, parses it,
 * creates qs_entity_profiles lazily, and writes to all 12+ QS tables.
 * 
 * Input: { qs_slugs?: string[] }  — if omitted, processes ALL profile_done without entity_profile
 * 
 * Called:
 *   1) By qs-full-crawl-orchestrator after each profile batch
 *   2) Manually for backfill
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QS_BASE = "https://www.topuniversities.com";

const ALL_SECTIONS = [
  "about", "university_info", "rankings", "cost_of_living",
  "student_life", "similar_universities", "social_links",
  "admissions", "students_staff", "official_website",
  "campus_locations", "media", "faqs", "facilities",
  "employability", "tuition_summary",
] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const requestedSlugs: string[] | undefined = body.qs_slugs;
    const batchSize = body.batch_size || 20;

    // Find entries to extract
    let query = srv
      .from('qs_page_entries')
      .select('id, qs_slug, display_name, source_profile_url, profile_snapshot_id, matched_university_id')
      .eq('crawl_status', 'profile_done')
      .not('profile_snapshot_id', 'is', null);

    if (requestedSlugs && requestedSlugs.length > 0) {
      query = query.in('qs_slug', requestedSlugs);
    }

    const { data: entries, error: entriesErr } = await query.limit(batchSize);
    if (entriesErr) throw entriesErr;
    if (!entries || entries.length === 0) {
      return json({ ok: true, message: 'no_entries_to_extract', processed: 0 });
    }

    const results: any[] = [];

    for (const entry of entries) {
      const slugResult: any = { qs_slug: entry.qs_slug, sections: {} };

      try {
        // 1. Read existing snapshot — NO re-crawl
        const { data: snapshot } = await srv
          .from('crawl_raw_snapshots')
          .select('id, raw_markdown, raw_html')
          .eq('id', entry.profile_snapshot_id)
          .single();

        if (!snapshot || !snapshot.raw_markdown || snapshot.raw_markdown.length < 300) {
          slugResult.status = 'skipped_no_markdown';
          results.push(slugResult);
          continue;
        }

        const markdown = snapshot.raw_markdown;
        const html = snapshot.raw_html || '';
        const now = new Date().toISOString();

        // 2. Ensure qs_entity_profiles exists (lazy create)
        let { data: existingProfile } = await srv
          .from('qs_entity_profiles')
          .select('id')
          .eq('qs_slug', entry.qs_slug)
          .maybeSingle();

        let entityProfileId: string;

        if (existingProfile) {
          entityProfileId = existingProfile.id;
        } else {
          // Create entity profile lazily
          const profileUrl = entry.source_profile_url || `${QS_BASE}/universities/${entry.qs_slug}`;
          const { data: newProfile, error: insertErr } = await srv
            .from('qs_entity_profiles')
            .insert({
              qs_slug: entry.qs_slug,
              name: entry.display_name,
              qs_url: profileUrl,
              entity_type: 'university',
              university_id: entry.matched_university_id || null,
              raw_snapshot_id: snapshot.id,
              fetched_at: now,
              slug_source: 'qs_full_crawl',
            })
            .select('id')
            .single();

          if (insertErr) {
            // Maybe race condition — try select again
            const { data: retry } = await srv
              .from('qs_entity_profiles')
              .select('id')
              .eq('qs_slug', entry.qs_slug)
              .single();
            if (!retry) {
              slugResult.status = 'error_creating_profile';
              slugResult.error = insertErr.message;
              results.push(slugResult);
              continue;
            }
            entityProfileId = retry.id;
          } else {
            entityProfileId = newProfile!.id;
          }
          slugResult.profile_created = true;
        }

        // 3. Extract sections from markdown + JSON-LD
        const jsonLd = extractJsonLd(html);
        const sections = extractAllSections(markdown, jsonLd);
        const sectionResults: Record<string, { status: string; error?: string }> = {};

        for (const s of ALL_SECTIONS) {
          sectionResults[s] = { status: "not_present" };
        }

        // ── About / University Info → qs_entity_profiles update
        try {
          const updates: any = { raw_snapshot_id: snapshot.id, fetched_at: now };
          if (sections.about?.text) updates.about_text = sections.about.text.slice(0, 5000);
          if (sections.university_info?.type) updates.institution_type = sections.university_info.type;
          if (sections.official_website) updates.official_website = sections.official_website;
          if (sections.programme_count) updates.programme_count_qs = sections.programme_count;
          if (sections.university_info?.city) updates.city = sections.university_info.city;
          if (sections.university_info?.country) updates.country = sections.university_info.country;

          await srv.from("qs_entity_profiles").update(updates).eq("id", entityProfileId);
          if (sections.about) sectionResults.about = { status: "extracted" };
          if (sections.university_info) sectionResults.university_info = { status: "extracted" };
          if (sections.official_website) sectionResults.official_website = { status: "extracted" };
        } catch (e: any) {
          sectionResults.about = { status: "error", error: e?.message?.slice(0, 100) };
        }

        // ── Rankings
        try {
          if (sections.rankings) {
            const parsedRank = sections.rankings.world_rank ? parseInt(sections.rankings.world_rank) : null;
            const isYearBug = parsedRank && parsedRank >= 2020 && parsedRank <= 2035;
            if (isYearBug) {
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

        // ── Cost of Living
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

        // ── Student Life
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

        // ── Similar Universities
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

        // ── Social Links
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

        // ── Admissions
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

        // ── Students & Staff
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

        // ── Campus Locations
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

        // ── Media
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

        // ── FAQs
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

        // ── Facilities
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

        // ── Employability
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

        // ── Tuition summary
        if (sections.tuition_summary) {
          sectionResults.tuition_summary = { status: "extracted" };
        }

        // ── Section Observations
        const crawlRunId = `extract-${entry.qs_slug}-${Date.now()}`;
        const obsRows = ALL_SECTIONS.map((sectionName) => {
          const result = sectionResults[sectionName] || { status: "not_present" };
          return {
            entity_profile_id: entityProfileId,
            crawl_run_id: crawlRunId,
            section_name: sectionName,
            status: result.status,
            ignore_reason: result.status === "not_present" ? "not_found_in_markdown" : null,
            quarantine_reason: result.status === "error" ? (result.error || "extraction_error") : null,
            data_sample: null,
            observed_at: now,
          };
        });
        await srv.from("qs_section_observations").insert(obsRows);

        const extractedCount = Object.values(sectionResults).filter(r => r.status === "extracted").length;
        slugResult.status = 'extracted';
        slugResult.entity_profile_id = entityProfileId;
        slugResult.sections_extracted = extractedCount;
        slugResult.sections_total = ALL_SECTIONS.length;
        slugResult.sections = Object.fromEntries(
          Object.entries(sectionResults).map(([k, v]) => [k, v.status])
        );

      } catch (e: any) {
        slugResult.status = 'error';
        slugResult.error = e?.message?.slice(0, 200);
      }

      results.push(slugResult);
    }

    return json({
      ok: true,
      processed: results.length,
      extracted: results.filter(r => r.status === 'extracted').length,
      results,
    });

  } catch (err: any) {
    console.error("[qs-extract-from-snapshot] Error:", err);
    return json({ ok: false, error: err?.message }, 500);
  }
});

// ══════════════════════════════════════════════════════
// JSON-LD Extraction (copied from crawl-qs-profile-worker)
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

  const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1]);

      if (parsed["@type"] === "FAQPage" && Array.isArray(parsed.mainEntity)) {
        for (const q of parsed.mainEntity) {
          if (q["@type"] === "Question" && q.name && q.acceptedAnswer?.text) {
            result.faqs.push({
              question: q.name.trim(),
              answer: q.acceptedAnswer.text.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000),
            });
          }
        }
      }

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
      // Skip invalid JSON-LD
    }
  }

  return result;
}

// ══════════════════════════════════════════════════════
// Section Extraction (copied from crawl-qs-profile-worker)
// ══════════════════════════════════════════════════════

function extractAllSections(content: string, jsonLd: JsonLdData) {
  const result: any = {};

  // About
  const aboutMatch = content.match(/## About .+?\n\n([\s\S]+?)(?=\n\[Read (?:more|less)\])/i);
  if (aboutMatch) {
    const fullAboutMatch = content.match(/## About .+?\n\n[\s\S]*?\[Read more\][^\n]*\n\n([\s\S]+?)(?=\n\[Read less\])/i);
    result.about = { text: (fullAboutMatch?.[1] || aboutMatch[1]).trim().slice(0, 5000) };
  }

  // University Info
  const typePrivate = /\bprivate\b/i.test(content.slice(0, 5000));
  const typePublic = /\bpublic\b/i.test(content.slice(0, 5000));
  const institutionType = typePrivate ? "Private" : typePublic ? "Public" : null;
  const foundedMatch = content.match(/(?:founded|established)\s*(?:in\s+)?(\d{4})/i);
  if (institutionType || foundedMatch) {
    result.university_info = { type: institutionType, founded: foundedMatch ? parseInt(foundedMatch[1]) : null };
  }

  // Official Website
  const officialMatch = content.match(/(?:Official Website|Visit (?:Institution )?Website|Visit Site)\]\((https?:\/\/(?!www\.topuniversities)[^\s)]+)\)/i);
  const titleLinkMatch = content.match(/^# \[.+?\]\((https?:\/\/(?!www\.topuniversities)[^\s)]+)\)/m);
  const websiteHeadingMatch = content.match(/###?\s*(?:Official )?Website\n\n(https?:\/\/(?!www\.topuniversities)[^\s]+)/i);
  const websiteLabelMatch = content.match(/\[(?:website|official site|university website)\]\((https?:\/\/(?!www\.topuniversities)[^\s)]+)\)/i);
  if (officialMatch) result.official_website = officialMatch[1];
  else if (websiteHeadingMatch) result.official_website = websiteHeadingMatch[1];
  else if (websiteLabelMatch) result.official_website = websiteLabelMatch[1];
  else if (titleLinkMatch) result.official_website = titleLinkMatch[1];

  // Rankings
  const rankMatch = content.match(/###\s*\\{0,2}#\s*=?(\d+)\s*QS World University Rankings/i);
  if (rankMatch) {
    result.rankings = { world_rank: rankMatch[1] };
    const overallMatch = content.match(/Overall\n\n([\d.]+)\n/);
    if (overallMatch) result.rankings.overall_score = overallMatch[1];

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

    const subjectMatches = [...content.matchAll(/\[#=?(\d+)\\?\n\*\*(.+?)\*\*\]/g)];
    if (subjectMatches.length > 0) {
      result.rankings.subject_rankings = subjectMatches
        .filter(m => !m[2].includes("QS World"))
        .map(m => ({ subject: m[2].trim(), rank: parseInt(m[1]) }));
    }
  }

  // Programme count
  const progCountMatch = content.match(/###\s*(\d+)\s*Undergrad & Postgrad Programmes/i);
  if (progCountMatch) {
    result.programme_count = parseInt(progCountMatch[1]);
  }

  // Cost of Living
  const colSection = content.match(/(?:#{2,4}\s*Cost of Living[\s\S]*?)(?=#{2,4}\s*(?:Scholarships|Employability|Rankings|Videos|Campus Locations|FAQ|Facilities|Similar|Students & Staff)|$)/i);
  const colFallback = !colSection ? content.match(/(Accommodation[\s\S]{0,100}[\$€£][\d,]+[\s\S]{0,500}(?:Transport|Food|Utilities)[\s\S]{0,200}[\$€£]?[\d,]+)/i) : null;
  const colText = colSection?.[0] || colFallback?.[0] || "";
  if (colText.length > 20) {
    const col: any = {};
    const accMatch2 = colText.match(/Accommodation\n\n[\$€£]?([\d,]+)/);
    const foodMatch = colText.match(/Food\n\n[\$€£]?([\d,]+)/);
    const transportMatch = colText.match(/Transport\n\n[\$€£]?([\d,]+)/);
    const utilitiesMatch = colText.match(/Utilities\n\n[\$€£]?([\d,]+)/);
    const accInline = !accMatch2 ? colText.match(/Accommodation[:\s]+[\$€£]?([\d,]+)/i) : null;
    const foodInline = !foodMatch ? colText.match(/Food[:\s]+[\$€£]?([\d,]+)/i) : null;
    const transportInline = !transportMatch ? colText.match(/Transport[:\s]+[\$€£]?([\d,]+)/i) : null;
    const utilitiesInline = !utilitiesMatch ? colText.match(/Utilities[:\s]+[\$€£]?([\d,]+)/i) : null;
    const currencyMatch = colText.match(/([\$€£])\d/);

    if (accMatch2 || accInline) col.accommodation_amount = (accMatch2?.[1] || accInline?.[1])!.replace(/,/g, "");
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

  // Student Life
  const studentLifeMatch = content.match(/####?\s*Student life\n\n([\s\S]+?)(?=####?\s|## [A-Z])/i);
  if (studentLifeMatch) {
    const slText = studentLifeMatch[1];
    result.student_life = {
      dorms_available: /dorm|residence|housing|on.campus.(?:living|accommodation)/i.test(slText),
      counselling_available: /counsell|mental.health|support.services/i.test(slText),
      clubs_hint: (slText.match(/(?:clubs?|societ|organization)/gi) || []).length,
    };
  }

  // Similar Universities
  const simMatch = content.match(/similar.universit[\s\S]{0,500}/i);
  if (simMatch) {
    const slugs = (simMatch[0].match(/\/universities\/([a-z0-9-]+)/g) || [])
      .map((l: string) => l.replace("/universities/", ""));
    if (slugs.length > 0) result.similar_entities = [...new Set(slugs)];
  }

  // Social Links
  const socials: string[] = [];
  if (/facebook\.com/i.test(content)) socials.push("facebook");
  if (/(?:twitter|x)\.com/i.test(content)) socials.push("twitter");
  if (/linkedin\.com/i.test(content)) socials.push("linkedin");
  if (/instagram\.com/i.test(content)) socials.push("instagram");
  if (/youtube\.com/i.test(content)) socials.push("youtube");
  if (socials.length > 0) result.social_links = socials;

  // Admissions
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

  // Students & Staff
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

  // Campus Locations
  if (jsonLd.campuses.length > 0) {
    result.campus_locations = jsonLd.campuses.map((c, i) => ({
      name: c.name, address: c.address, city: c.city,
      country_code: c.country, postal_code: c.postalCode, is_main: i === 0,
    }));
  } else {
    const campusSection = content.match(/## Campus locations[\s\S]*?(?=## [A-Z]|#### Frequently)/i);
    if (campusSection) {
      const addresses = [...campusSection[0].matchAll(/^([^\n]{5,80})\n\n([^\n]+),?\n\n([A-Z]{2})\n\n(\d+)?/gm)];
      if (addresses.length > 0) {
        result.campus_locations = addresses.map((m, i) => ({
          address: m[1].trim(), city: m[2].trim(), country_code: m[3],
          postal_code: m[4] || null, is_main: i === 0,
        }));
      }
    }
  }

  // Media
  const mediaResult: any = { gallery_present: false, map_present: false };
  if (jsonLd.logoUrl) {
    mediaResult.logo_url = jsonLd.logoUrl;
  } else {
    const logoMatch = content.match(/!\[university logo\]\(([^\s)]+)\)/i);
    if (logoMatch) mediaResult.logo_url = logoMatch[1];
  }
  if (jsonLd.images.length > 0) {
    mediaResult.photos = jsonLd.images.slice(0, 20);
    mediaResult.gallery_present = true;
  } else {
    const galleryMatches = [...content.matchAll(/profiles-slideshow\/\d+\/([^\s")]+)/g)];
    if (galleryMatches.length > 0) {
      mediaResult.photos = galleryMatches.slice(0, 20).map(m => m[0]);
      mediaResult.gallery_present = true;
    }
  }
  const ytMatches = [...content.matchAll(/img\.youtube\.com\/vi\/([\w-]+)/g)];
  if (ytMatches.length > 0) {
    mediaResult.videos = [...new Set(ytMatches.map(m => m[1]))].map(id => ({ platform: "youtube", id }));
  }
  mediaResult.map_present = /Open in Maps/i.test(content);
  if (mediaResult.logo_url || (mediaResult.videos && mediaResult.videos.length > 0) || mediaResult.gallery_present) {
    result.media = mediaResult;
  }

  // FAQs
  if (jsonLd.faqs.length > 0) {
    result.faqs = jsonLd.faqs;
  } else {
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

  // Facilities
  const facSection = content.match(/## Facilities\n\n([\s\S]+?)(?=## [A-Z]|#### )/i);
  if (facSection) {
    result.facilities = { text: facSection[1].replace(/\[.*?\]/g, "").trim().slice(0, 3000) };
  }

  // Employability
  const empSection = content.match(/(?:#{2,4}\s*(?:Career Services?|Employability|Career services and employability))\n\n([\s\S]+?)(?=#{2,4}\s*(?!Career|Employability)[A-Z])/i);
  const empFallback = !empSection ? content.match(/(?:#{2,4}\s*(?:Career|Employment|Graduate Outcomes)[\s\S]*?)\n\n([\s\S]+?)(?=#{2,4}\s*[A-Z])/i) : null;
  const empRaw = empSection?.[1] || empFallback?.[1] || "";
  if (empRaw.length > 20) {
    const empText = empRaw.replace(/\[.*?\]\(.*?\)/g, "").trim();
    result.employability = { text: empText.slice(0, 3000), services: null };
    const serviceList = [...empText.matchAll(/^[-•*]\s*(.+)/gm)];
    if (serviceList.length > 0) {
      result.employability.services = serviceList.map(m => m[1].trim());
    }
  }

  // Tuition summary
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

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
