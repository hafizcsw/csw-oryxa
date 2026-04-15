import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { slog } from "../_shared/cors.ts";

/**
 * crawl-uniranks-harvest-worker: Door 2 per-university harvester
 * Called by crawl-runner-tick for each locked university.
 * 
 * Stages: profile_fetch → programs_discover → details_fetch
 * Snapshot-first: every fetch is stored before parsing.
 * Non-blocking: missing sections = status 'not_present' / 'js_required', NOT error.
 */

const UA = "LavistaCrawler/1.0 (+https://connectstudyworld.com)";
const FETCH_TIMEOUT_MS = 15_000;

Deno.serve(async (req) => {
  // Internal-only: strict service_role auth
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SRV_KEY}`) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    // ══════════════════════════════════════════════════════════════════════
    // HARD FREEZE — Phase 1 Safety Repair (2026-03-18)
    // This worker is FROZEN. UniRanks is removed from active crawl/write paths.
    // No writes to `universities` table from UniRanks source.
    // No stage transitions. No snapshot writes. No program URL bridges.
    // Freeze reason: official-site-only lane policy.
    // ══════════════════════════════════════════════════════════════════════
    console.warn("[harvest-worker] FROZEN — phase1_official_site_only_freeze");
    await srv.from("pipeline_health_events").insert({
      pipeline: "uniranks_harvest",
      event_type: "freeze",
      metric: "hard_freeze_block",
      value: 1,
      details_json: { frozen_at: new Date().toISOString(), reason: "phase1_official_site_only" },
    }).then(() => {}).catch(() => {});
    return json({ ok: false, frozen: true, reason: "phase1_official_site_only_freeze" });

    // === FROZEN CODE BELOW — unreachable ===
    const body = await req.json();
    const { university_id, profile_url, stage, trace_id } = body;

    if (!university_id || !profile_url) {
      return json({ ok: false, error: "missing_params" }, 400);
    }

    const tid = trace_id || `d2-${Date.now()}`;
    const result: Record<string, any> = { university_id, stage, trace_id: tid };

    // ========= STAGE A: Profile Fetch =========
    if (stage === "profile_pending" || stage === "profile_fetching") {
      await updateStage(srv, university_id, "profile_fetching");

      const fetchResult = await fetchAndSnapshot(srv, university_id, profile_url, "profile", tid);

      if (!fetchResult.ok) {
        // Fix #4: Write error snapshot to guarantee 100% snapshot coverage
        if (!fetchResult.snapshotId) {
          await writeErrorSnapshot(srv, university_id, profile_url, "profile", fetchResult.error || "fetch_failed", tid);
        }

        await recordStep(srv, university_id, "profile_fetch", "profile_fetching", "profile_main", "fetch_error", {
          error: fetchResult.error, url: profile_url,
        }, tid, fetchResult.snapshotId);

        await handleRetry(srv, university_id, fetchResult.error || "fetch_failed");
        return json({ ok: true, ...result, outcome: "fetch_error" });
      }

      // Parse profile from markdown/HTML
      const parsed = parseProfilePage(fetchResult.markdown || "");

      // Record step runs for each section
      await recordStep(srv, university_id, "profile_fetch", "profile_fetching", "profile_main",
        parsed.name ? "ok" : "not_present",
        { name: parsed.name, rank: parsed.rank, score: parsed.score },
        tid, fetchResult.snapshotId);

      await recordStep(srv, university_id, "profile_about", "profile_fetching", "about",
        parsed.about ? "ok" : "not_present",
        { about_length: parsed.about?.length ?? 0 },
        tid, fetchResult.snapshotId);

      await recordStep(srv, university_id, "profile_logo", "profile_fetching", "logo",
        parsed.logoUrl ? "ok" : "not_present",
        { logo_url: parsed.logoUrl },
        tid, fetchResult.snapshotId);

      // Check for JS-rendered widgets
      const hasJsWidgets = (fetchResult.markdown || "").includes("Loading") ||
        (fetchResult.markdown || "").includes("wire:loading");
      await recordStep(srv, university_id, "profile_widgets", "profile_fetching", "widgets",
        hasJsWidgets ? "js_required" : (parsed.hasPrograms ? "ok" : "not_present"),
        { js_widgets: hasJsWidgets, has_programs_section: parsed.hasPrograms },
        tid, fetchResult.snapshotId);

      // Best-effort update universities table
      const updates: Record<string, any> = {};
      if (parsed.name) updates.name_en = parsed.name;
      if (parsed.logoUrl) updates.logo_url = parsed.logoUrl;
      if (parsed.about) updates.description = parsed.about;

      // P2: Write full snapshot data to uniranks_* columns
      if (parsed.uniranksRank != null) updates.uniranks_rank = parsed.uniranksRank;
      if (parsed.score != null) updates.uniranks_score = parseFloat(parsed.score);
      if (parsed.verified !== undefined) updates.uniranks_verified = parsed.verified;
      if (parsed.recognized !== undefined) updates.uniranks_recognized = parsed.recognized;
      if (parsed.worldRank != null) updates.uniranks_world_rank = parsed.worldRank;
      if (parsed.regionRank != null) updates.uniranks_region_rank = parsed.regionRank;
      if (parsed.countryRank != null) updates.uniranks_country_rank = parsed.countryRank;
      if (parsed.regionLabel) updates.uniranks_region_label = parsed.regionLabel;
      if (parsed.topBuckets && parsed.topBuckets.length > 0) updates.uniranks_top_buckets = parsed.topBuckets;
      if (parsed.badges && parsed.badges.length > 0) updates.uniranks_badges = parsed.badges;
      if (parsed.sectionsPresent && parsed.sectionsPresent.length > 0) updates.uniranks_sections_present = parsed.sectionsPresent;
      if (parsed.studentsCount != null) updates.enrolled_students = parsed.studentsCount;
      if (parsed.acceptanceRate != null) updates.acceptance_rate = parsed.acceptanceRate;
      if (parsed.universityType) updates.university_type = parsed.universityType;
      // Best-effort website: only write if currently null (don't overwrite existing)
      if (parsed.officialWebsite) {
        updates._maybe_website = parsed.officialWebsite; // handled below
      }

      // Build and store snapshot JSON blob
      const snapshotJson: Record<string, any> = {
        rank: parsed.uniranksRank, score: parsed.score ? parseFloat(parsed.score) : null,
        verified: parsed.verified, recognized: parsed.recognized,
        world_rank: parsed.worldRank, region_rank: parsed.regionRank, country_rank: parsed.countryRank,
        region_label: parsed.regionLabel, top_buckets: parsed.topBuckets, badges: parsed.badges,
        students_count: parsed.studentsCount, acceptance_rate: parsed.acceptanceRate,
        university_type: parsed.universityType, official_website: parsed.officialWebsite,
        sections_present: parsed.sectionsPresent,
      };
      const snapshotStr = JSON.stringify(snapshotJson);
      const snapshotHash = await sha256Short(snapshotStr);
      updates.uniranks_snapshot = snapshotJson;
      updates.uniranks_snapshot_hash = snapshotHash;
      updates.uniranks_snapshot_at = new Date().toISOString();
      updates.uniranks_snapshot_trace_id = tid;

      // Record logo exclusion in step details if applicable
      if ((parsed as any)._logoExcluded) {
        await recordStep(srv, university_id, "profile_logo_excluded", "profile_fetching", "logo",
          "excluded", { excluded_url: (parsed as any)._logoExcluded, reason: "uniranks_site_logo" },
          tid);
      }

      // Handle website: only set if currently null (never overwrite existing)
      const maybeWebsite = updates._maybe_website;
      delete updates._maybe_website;

      if (Object.keys(updates).length > 0) {
        await srv.from("universities").update(updates).eq("id", university_id);
      }

      // Best-effort website update (only if null)
      if (maybeWebsite) {
        await srv.from("universities")
          .update({ website: maybeWebsite })
          .eq("id", university_id)
          .is("website", null);
      }

      // Move to next stage
      await updateStage(srv, university_id, "programs_pending");
      await srv.from("uniranks_crawl_state").update({ last_ok_at: new Date().toISOString() }).eq("university_id", university_id);

      result.outcome = "profile_done";
      result.parsed = { name: !!parsed.name, about: !!parsed.about, logo: !!parsed.logoUrl };
    }

    // ========= STAGE B: Programs Discover (Non-blocking) =========
    else if (stage === "programs_pending" || stage === "programs_fetching") {
      await updateStage(srv, university_id, "programs_fetching");

      // Try to find programs links from the profile page snapshot
      const { data: latestSnapshot } = await srv
        .from("uniranks_page_snapshots")
        .select("raw_markdown")
        .eq("university_id", university_id)
        .eq("page_type", "profile")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .single();

      const markdown = latestSnapshot?.raw_markdown || "";
      const programLinks = extractProgramLinks(markdown, profile_url);

      if (programLinks.length === 0) {
        await recordStep(srv, university_id, "programs_discover", "programs_fetching", "programs_list",
          markdown.includes("Loading") ? "js_required" : "not_present",
          { links_found: 0 },
          tid);

        // Non-blocking: move to done even without programs (bridge wrote 0 URLs — acceptable)
        await updateStage(srv, university_id, "done");
        result.outcome = "no_programs_found";
      } else {
        await recordStep(srv, university_id, "programs_discover", "programs_fetching", "programs_list",
          "ok", { links_found: programLinks.length }, tid);

        // Store discovered program URLs in step_runs (telemetry)
        for (const link of programLinks.slice(0, 50)) {
          await srv.from("uniranks_step_runs").upsert({
            university_id,
            step_key: `program_url_${hashShort(link.url)}`,
            stage: "programs_fetching",
            section: "program_url",
            status: "ok",
            details_json: { url: link.url, title: link.title },
            trace_id: tid,
          }, { onConflict: "university_id,step_key,stage" });
        }

        // ====== BRIDGE: Write discovered URLs to program_urls (production table) ======
        let bridgedCount = 0;
        const bridgeErrors: string[] = [];
        let externalDomainRejected = 0;
        for (const link of programLinks.slice(0, 50)) {
          // HARD GATE: reject any URL with fragment before bridge insert
          if (link.url.includes("#")) continue;
          // HARD GATE: reject non-UniRanks domains
          try {
            const urlHost = new URL(link.url).hostname;
            if (!urlHost.endsWith("uniranks.com")) {
              externalDomainRejected++;
              continue;
            }
          } catch { continue; }
          const canonicalUrl = link.url.replace(/\/+$/, "").toLowerCase();
          const urlHash = hashShort(canonicalUrl);

          try {
            // host_key is GENERATED ALWAYS — do NOT include it
            const { error: bridgeErr } = await srv.from("program_urls").insert({
              university_id,
              url: link.url,
              canonical_url: canonicalUrl,
              url_hash: urlHash,
              kind: "program",
              discovered_from: `door2:${tid}`,
              status: "pending",
            });

            if (bridgeErr) {
              // Duplicate = success (idempotent)
              if (bridgeErr.code === '23505') {
                bridgedCount++;
              } else {
                bridgeErrors.push(`${link.url}: ${bridgeErr.message}`);
              }
            } else {
              bridgedCount++;
            }
          } catch (e: any) {
            bridgeErrors.push(`${link.url}: ${e?.message}`);
          }
        }
        if (bridgeErrors.length > 0) {
          console.warn(`[bridge] Errors for ${university_id}:`, bridgeErrors.slice(0, 3));
        }

        await recordStep(srv, university_id, "programs_bridge", "programs_fetching", "bridge",
          bridgedCount > 0 ? "ok" : "parse_error",
          { links_found: programLinks.length, bridged: bridgedCount, external_domain_rejected: externalDomainRejected },
          tid);

        // Stage finalization: done only after bridge completes
        await updateStage(srv, university_id, "done");
        result.outcome = "programs_discovered_and_bridged";
        result.programs_count = programLinks.length;
        result.bridged_count = bridgedCount;
      }

      await srv.from("uniranks_crawl_state").update({ last_ok_at: new Date().toISOString() }).eq("university_id", university_id);
    }

    // ========= Already done or quarantined =========
    else {
      result.outcome = "skipped";
      result.reason = `stage_is_${stage}`;
    }

    return json({ ok: true, ...result });
  } catch (err: any) {
    slog({ level: "error", action: "harvest_worker_error", error: String(err) });
    return json({ ok: false, error: err?.message }, 500);
  }
});

// ===== Helpers =====

async function fetchAndSnapshot(
  srv: any, universityId: string, url: string, pageType: string, traceId: string
): Promise<{ ok: boolean; markdown?: string; snapshotId?: number; error?: string }> {
  try {
    // Try Firecrawl first for better JS rendering
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY_1") || Deno.env.get("FIRECRAWL_API_KEY");

    let markdown = "";
    let statusCode = 0;

    if (apiKey) {
      const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          waitFor: 15000,
          onlyMainContent: false,
          timeout: 30000,
        }),
        signal: AbortSignal.timeout(35_000),
      });

      if (fcRes.ok) {
        const fcData = await fcRes.json();
        markdown = fcData?.data?.markdown || "";
        statusCode = fcData?.data?.metadata?.statusCode || 200;
      } else {
        await fcRes.text().catch(() => {});
        // Fallback to direct fetch
      }
    }

    // Fallback: direct HTML fetch
    if (!markdown) {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      statusCode = r.status;
      if (r.ok) {
        markdown = await r.text();
      } else {
        const errText = await r.text().catch(() => "");
        return { ok: false, error: `HTTP ${r.status}: ${errText.slice(0, 100)}` };
      }
    }

    // Content hash for dedup
    const hash = await sha256Short(markdown);

    // Snapshot-first insert
    const { data: snap, error: snapErr } = await srv
      .from("uniranks_page_snapshots")
      .upsert({
        university_id: universityId,
        normalized_url: normalizeUrl(url),
        content_hash: hash,
        status_code: statusCode,
        raw_markdown: markdown.slice(0, 500_000), // cap at 500KB
        page_type: pageType,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "normalized_url,content_hash" })
      .select("id")
      .single();

    return { ok: true, markdown, snapshotId: snap?.id };
  } catch (err: any) {
    return { ok: false, error: err?.message || "fetch_exception" };
  }
}

function parseProfilePage(markdown: string): {
  name?: string;
  rank?: string;
  score?: string;
  about?: string;
  logoUrl?: string;
  hasPrograms: boolean;
  uniranksRank?: number;
  verified?: boolean;
  recognized?: boolean;
  worldRank?: number;
  regionRank?: number;
  countryRank?: number;
  regionLabel?: string;
  topBuckets?: string[];
  badges?: string[];
  sectionsPresent?: string[];
  studentsCount?: number;
  acceptanceRate?: number;
  universityType?: string;
  officialWebsite?: string;
} {
  const result: any = { hasPrograms: false };

  // Try to extract name from first heading
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) result.name = h1Match[1].trim();

  // Look for rank info — UniRanks format: "| Rank7798 | Score37.06 |"
  const rankScoreMatch = markdown.match(/Rank\s*(\d+)\s*\|\s*Score\s*([\d.]+)/i);
  if (rankScoreMatch) {
    result.rank = rankScoreMatch[1];
    result.uniranksRank = parseInt(rankScoreMatch[1], 10);
    result.score = rankScoreMatch[2];
  } else {
    // Fallback
    const rankMatch = markdown.match(/(?:World|Global)\s*(?:Rank|Ranking)[:\s]*#?(\d+)/i);
    if (rankMatch) result.rank = rankMatch[1];
    const scoreMatch = markdown.match(/(?:Overall\s*)?Score[:\s]*([\d.]+)/i);
    if (scoreMatch) result.score = scoreMatch[1];
  }

  // Verified / Recognized status
  if (/Recognized,\s*Verified/i.test(markdown)) {
    result.verified = true;
    result.recognized = true;
  } else if (/Under Review/i.test(markdown)) {
    result.verified = false;
    result.recognized = false;
  } else {
    if (/\bVerified\b/i.test(markdown)) result.verified = true;
    if (/\bRecognized\b/i.test(markdown)) result.recognized = true;
  }

  // Region ranks — "Top Asia #1234" or "Top World #Not Listed"
  const topBuckets: string[] = [];
  const regionRankRegex = /Top\s+([\w\s]+?)\s+#(\d+|Not Listed)/gi;
  let regionMatch;
  while ((regionMatch = regionRankRegex.exec(markdown)) !== null) {
    const region = regionMatch[1].trim();
    const val = regionMatch[2];
    if (val !== "Not Listed") {
      const num = parseInt(val, 10);
      if (region.toLowerCase().includes("world")) result.worldRank = num;
      else if (region.toLowerCase().includes("europe") || region.toLowerCase().includes("asia") ||
               region.toLowerCase().includes("africa") || region.toLowerCase().includes("america") ||
               region.toLowerCase().includes("oceania")) {
        result.regionRank = num;
        result.regionLabel = region;
      }
      topBuckets.push(`${region} #${val}`);
    }
  }
  if (topBuckets.length > 0) result.topBuckets = topBuckets;

  // Badges — look for badge/award images or text
  const badges: string[] = [];
  if (/Uniranks Elite/i.test(markdown)) badges.push("elite");
  if (/Uniranks Gold/i.test(markdown)) badges.push("gold");
  if (/Uniranks Silver/i.test(markdown)) badges.push("silver");
  if (badges.length > 0) result.badges = badges;

  // Sections present
  const sections: string[] = [];
  if (/## About/i.test(markdown)) sections.push("about");
  if (/## .*Ranking/i.test(markdown)) sections.push("ranking");
  if (/## Student Statistics/i.test(markdown)) sections.push("students");
  if (/## .*Programs/i.test(markdown) || /## .*Courses/i.test(markdown)) sections.push("programs");
  if (/## .*Fees/i.test(markdown)) sections.push("fees");
  if (/International Students/i.test(markdown)) sections.push("international");
  if (sections.length > 0) result.sectionsPresent = sections;

  // Student Statistics — "Total students\n\n12345" or "Total students\n\n0"
  const studentsMatch = markdown.match(/Total students\s*\n+\s*([\d,]+)/i);
  if (studentsMatch) {
    const n = parseInt(studentsMatch[1].replace(/,/g, ""), 10);
    if (n > 0) result.studentsCount = n;
  }

  // Acceptance rate — "Acceptance Rate\n\n45%" or similar
  const acceptMatch = markdown.match(/Acceptance\s*Rate\s*\n+\s*([\d.]+)\s*%/i);
  if (acceptMatch) {
    const rate = parseFloat(acceptMatch[1]);
    if (rate > 0 && rate <= 100) result.acceptanceRate = rate;
  }

  // University type — "Public", "Private", "Non-Profit", "For-Profit"
  const typeMatch = markdown.match(/(?:Type|Institution\s*Type|Category)\s*[\n|:]+\s*(Public|Private|Non-Profit|For-Profit|Private Not-for-Profit|Private For-Profit|Public,?\s*Non-Profit|Private,?\s*Non-Profit|Private,?\s*For-Profit)/i);
  if (typeMatch) {
    result.universityType = typeMatch[1].trim();
  } else {
    if (/\bPublic,?\s*Non-Profit\b/i.test(markdown)) result.universityType = "Public, Non-Profit";
    else if (/\bPrivate,?\s*Non-Profit\b/i.test(markdown) || /\bPrivate Not-for-Profit\b/i.test(markdown)) result.universityType = "Private, Non-Profit";
    else if (/\bPrivate,?\s*For-Profit\b/i.test(markdown)) result.universityType = "Private, For-Profit";
    else {
      const publicInStructured = markdown.match(/(?:Type|Category|Status)\s*[\n|:]+\s*Public\b/i);
      if (publicInStructured) result.universityType = "Public";
    }
  }

  // Official website — explicit link (NOT uniranks/cloudfront)
  const websitePatterns = [
    /\[(?:Official\s+)?Website\]\((https?:\/\/[^\s)]+)\)/i,
    /(?:Official\s+)?Website\s*[\n|:]+\s*(https?:\/\/[^\s|]+)/i,
  ];
  for (const pat of websitePatterns) {
    const wm = markdown.match(pat);
    if (wm?.[1]) {
      const rawUrl = wm[1].trim();
      try {
        const host = new URL(rawUrl).hostname;
        if (!host.endsWith("uniranks.com") && !host.includes("cloudfront") && !host.includes("amazonaws.com")) {
          result.officialWebsite = rawUrl;
          break;
        }
      } catch { /* invalid URL, skip */ }
    }
  }

  // About section — UniRanks uses "## About <University Name>" heading
  const aboutPatterns = [
    /##\s+About\s+[^\n]+\n\n([\s\S]{50,2000}?)(?:\n\*\s*\*\s*\*|\n##\s|\n\n\n)/i,
    /(?:about|overview|description)[:\s]*\n+([\s\S]{50,500}?)(?:\n#|\n\n\n)/i,
  ];
  for (const pat of aboutPatterns) {
    const m = markdown.match(pat);
    if (m?.[1]) {
      result.about = m[1].trim().replace(/\s*Recognized and Verified by UNIRANKS\.?\s*$/i, "").trim();
      break;
    }
  }

  // Logo URL — UniRanks format: ![University Name Logo](cloudfront-url)
  const LOGO_EXCLUDE_RE = /Website-Logo|UR-ELITE-Logo|demo-NYU-Logo|icon-worldmap|uniranks\.com\/(?:universities\/(?:assets|new_assets)|assets|images|static)\//i;

  const logoPatterns = [
    /!\[([^\]]*Logo[^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi,
    /!\[.*?(?:emblem|crest|seal|badge|coat).*?\]\((https?:\/\/[^\s)]+)\)/gi,
    /!\[.*?\]\((https?:\/\/[^\s)]*(?:universities-logos|university.*logo)[^\s)]*)\)/gi,
  ];
  for (const pat of logoPatterns) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(markdown)) !== null) {
      const candidate = m[2] || m[1];
      if (!candidate.startsWith("http")) continue;
      if (LOGO_EXCLUDE_RE.test(candidate)) {
        if (!result._logoExcluded) result._logoExcluded = candidate;
        continue;
      }
      result.logoUrl = candidate;
      break;
    }
    if (result.logoUrl) break;
  }

  // Programs section presence
  result.hasPrograms = /(?:programs?|courses?|degrees?|facult)/i.test(markdown);

  return result;
}

function extractProgramLinks(markdown: string, baseUrl: string): { url: string; title: string }[] {
  const links: { url: string; title: string }[] = [];
  const seen = new Set<string>();
  const PROGRAM_RE = /(?:program|course|degree|bachelor|master|phd|faculty|diploma|certificate|major|minor|specializ|specialis)/i;

  let baseOrigin = "";
  try { baseOrigin = new URL(baseUrl).origin; } catch { /* ignore */ }

  function addLink(rawUrl: string, title: string) {
    // Reject fragment-only URLs (#programs, #, #anything)
    if (rawUrl.startsWith("#")) return;

    let resolved = rawUrl;
    // Handle relative URLs
    if (rawUrl.startsWith("/")) {
      if (!baseOrigin) return;
      resolved = baseOrigin + rawUrl;
    } else if (!rawUrl.startsWith("http")) {
      // Relative path like "programs/123"
      try {
        resolved = new URL(rawUrl, baseUrl).href;
      } catch { return; }
    }
    // Skip non-http, assets
    if (!resolved.startsWith("http")) return;
    if (/\.(pdf|jpg|jpeg|png|gif|svg|css|js|zip|doc|docx|mp4|webp)$/i.test(resolved)) return;

    // Strip any remaining fragment from resolved URL (toString() can leave trailing #)
    try {
      const u = new URL(resolved);
      u.hash = "";
      resolved = u.toString().replace(/#$/, "");
    } catch { /* keep as-is */ }

    // Hard reject if fragment somehow survived
    if (resolved.includes("#")) return;

    const normalized = resolved.replace(/\/+$/, "").toLowerCase();
    if (seen.has(normalized)) return;
    if (!PROGRAM_RE.test(title + " " + resolved)) return;

    seen.add(normalized);
    links.push({ url: resolved, title: title.trim() });
  }

  // 1. Markdown links: [title](url)
  const mdRegex = /\[([^\]]+)\]\(([^\s)]+)\)/g;
  let match;
  while ((match = mdRegex.exec(markdown)) !== null) {
    addLink(match[2], match[1]);
  }

  // 2. HTML <a href="..."> links (handles fallback HTML content)
  const htmlRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = htmlRegex.exec(markdown)) !== null) {
    const href = match[1];
    // Strip HTML tags from inner text
    const title = match[2].replace(/<[^>]*>/g, "").trim();
    addLink(href, title);
  }

  // 3. Bare URLs on their own lines (common in some markdown outputs)
  const bareRegex = /^(https?:\/\/[^\s]+)$/gm;
  while ((match = bareRegex.exec(markdown)) !== null) {
    addLink(match[1], "");
  }

  return links;
}

async function updateStage(srv: any, universityId: string, stage: string) {
  await srv.from("uniranks_crawl_state").update({
    stage,
    locked_until: null,
    locked_by: null,
  }).eq("university_id", universityId);
}

async function handleRetry(srv: any, universityId: string, reason: string) {
  const { data: state } = await srv
    .from("uniranks_crawl_state")
    .select("retry_count, retry_budget")
    .eq("university_id", universityId)
    .single();

  const retryCount = (state?.retry_count ?? 0) + 1;
  const budget = state?.retry_budget ?? 3;

  if (retryCount >= budget) {
    // Quarantine
    await srv.from("uniranks_crawl_state").update({
      stage: "quarantined",
      quarantine_reason: reason,
      quarantined_at: new Date().toISOString(),
      retry_count: retryCount,
      locked_until: null,
      locked_by: null,
      last_error_at: new Date().toISOString(),
    }).eq("university_id", universityId);
  } else {
    // Retry: reset lock, increment counter
    await srv.from("uniranks_crawl_state").update({
      retry_count: retryCount,
      locked_until: null,
      locked_by: null,
      last_error_at: new Date().toISOString(),
    }).eq("university_id", universityId);
  }
}

async function recordStep(
  srv: any, universityId: string, stepKey: string, stage: string,
  section: string, status: string, details: any, traceId: string, snapshotId?: number
) {
  await srv.from("uniranks_step_runs").upsert({
    university_id: universityId,
    step_key: stepKey,
    stage,
    section,
    status,
    details_json: details,
    trace_id: traceId,
    snapshot_id: snapshotId ?? null,
  }, { onConflict: "university_id,step_key,stage" });
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

async function sha256Short(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

function hashShort(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

async function writeErrorSnapshot(
  srv: any, universityId: string, url: string, pageType: string, error: string, traceId: string
) {
  try {
    const errorContent = `ERROR_SNAPSHOT: ${error}\nURL: ${url}\nTrace: ${traceId}\nAt: ${new Date().toISOString()}`;
    const hash = await sha256Short(errorContent);
    await srv.from("uniranks_page_snapshots").upsert({
      university_id: universityId,
      normalized_url: normalizeUrl(url),
      content_hash: hash,
      status_code: 0,
      raw_markdown: errorContent,
      page_type: pageType,
      fetched_at: new Date().toISOString(),
    }, { onConflict: "normalized_url,content_hash" });
  } catch { /* best-effort */ }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
