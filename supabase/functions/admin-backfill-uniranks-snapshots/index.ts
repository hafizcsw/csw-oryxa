import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * admin-backfill-uniranks-snapshots: Re-parse existing profile snapshots
 * and populate uniranks_* columns on universities table.
 * POST { batch_size?: number }
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error, trace_id: tid }, auth.status, cors);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body?.batch_size ?? 200, 500);
    const force = body?.force === true; // Re-process ALL snapshots (for new fields)
    const offset = body?.offset ?? 0;

    let targets: any[] | null = null;

    if (force) {
      // Force mode: re-parse ALL profile snapshots regardless of existing data
      const { data, error: qErr } = await srv
        .from("uniranks_page_snapshots")
        .select("university_id, raw_markdown")
        .eq("page_type", "profile")
        .not("raw_markdown", "is", null)
        .range(offset, offset + batchSize - 1)
        .order("university_id");

      if (qErr || !data || data.length === 0) {
        return json({ ok: true, trace_id: tid, found: 0, message: "no_snapshots_to_process", mode: "force" }, 200, cors);
      }
      targets = data;
    } else {
      // Normal mode: only universities missing snapshot_at
      const { data: needSnapshot, error: nsErr } = await srv
        .from("universities")
        .select("id")
        .not("uniranks_profile_url", "is", null)
        .is("uniranks_snapshot_at", null)
        .limit(batchSize);

      if (nsErr || !needSnapshot || needSnapshot.length === 0) {
        return json({ ok: true, trace_id: tid, found: 0, message: "no_universities_need_backfill" }, 200, cors);
      }

      const uniIds = needSnapshot.map(u => u.id);
      const { data } = await srv
        .from("uniranks_page_snapshots")
        .select("university_id, raw_markdown")
        .eq("page_type", "profile")
        .not("raw_markdown", "is", null)
        .in("university_id", uniIds)
        .limit(batchSize);

      targets = data;
    }

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const snap of (targets || [])) {
      try {
        const parsed = parseProfileSnapshot(snap.raw_markdown);
        const updates: Record<string, any> = {};

        if (parsed.uniranksRank != null) updates.uniranks_rank = parsed.uniranksRank;
        if (parsed.score != null) updates.uniranks_score = parsed.score;
        if (parsed.verified !== undefined) updates.uniranks_verified = parsed.verified;
        if (parsed.recognized !== undefined) updates.uniranks_recognized = parsed.recognized;
        if (parsed.worldRank != null) updates.uniranks_world_rank = parsed.worldRank;
        if (parsed.regionRank != null) updates.uniranks_region_rank = parsed.regionRank;
        if (parsed.countryRank != null) updates.uniranks_country_rank = parsed.countryRank;
        if (parsed.regionLabel) updates.uniranks_region_label = parsed.regionLabel;
        if (parsed.topBuckets?.length) updates.uniranks_top_buckets = parsed.topBuckets;
        if (parsed.badges?.length) updates.uniranks_badges = parsed.badges;
        if (parsed.sectionsPresent?.length) updates.uniranks_sections_present = parsed.sectionsPresent;
        if (parsed.studentsCount != null) updates.enrolled_students = parsed.studentsCount;
        if (parsed.acceptanceRate != null) updates.acceptance_rate = parsed.acceptanceRate;
        if (parsed.universityType) updates.university_type = parsed.universityType;

        const snapshotJson = {
          rank: parsed.uniranksRank, score: parsed.score,
          verified: parsed.verified, recognized: parsed.recognized,
          world_rank: parsed.worldRank, region_rank: parsed.regionRank, country_rank: parsed.countryRank,
          region_label: parsed.regionLabel, top_buckets: parsed.topBuckets, badges: parsed.badges,
          students_count: parsed.studentsCount, acceptance_rate: parsed.acceptanceRate,
          university_type: parsed.universityType, official_website: parsed.officialWebsite,
          sections_present: parsed.sectionsPresent,
        };

        updates.uniranks_snapshot = snapshotJson;
        updates.uniranks_snapshot_at = new Date().toISOString();
        updates.uniranks_snapshot_trace_id = tid;

        const snapshotStr = JSON.stringify(snapshotJson);
        const hash = await sha256Short(snapshotStr);
        updates.uniranks_snapshot_hash = hash;

        if (Object.keys(updates).length > 2) { // more than just snapshot_at + trace_id
          // SAFETY FREEZE: Only write snapshot metadata fields (not website/description/name)
          // Filter to ONLY safe snapshot columns — no content fields
          const safeSnapshotKeys = ['uniranks_snapshot', 'uniranks_snapshot_at', 'uniranks_snapshot_trace_id', 'uniranks_snapshot_hash'];
          const safeUpdates: Record<string, unknown> = {};
          for (const k of safeSnapshotKeys) {
            if (k in updates) safeUpdates[k] = updates[k];
          }
          await srv.from("universities").update(safeUpdates).eq("id", snap.university_id);
          
          // FROZEN: Best-effort website write removed. Website must go through review.
          if (parsed.officialWebsite) {
            console.warn(`[Backfill-FREEZE] Skipped direct website write for ${snap.university_id}: ${parsed.officialWebsite}`);
          }
          updated++;
        }
        processed++;
      } catch (e: any) {
        errors++;
        slog({ tid, level: "warn", action: "backfill_parse_error", university_id: snap.university_id, error: String(e) });
      }
    }

    // Telemetry
    await srv.from("pipeline_health_events").insert({
      pipeline: "snapshot_backfill",
      event_type: "metric",
      metric: "backfill_batch",
      value: updated,
      details_json: { trace_id: tid, batch_size: batchSize, force, offset, snapshots_found: targets?.length ?? 0, processed, updated, errors },
    });

    slog({ tid, level: "info", action: "backfill_complete", processed, updated, errors, force, offset });

    return json({
      ok: true, trace_id: tid, force, offset,
      snapshots_found: targets?.length ?? 0,
      processed, updated, errors,
    }, 200, cors);
  } catch (err: any) {
    slog({ tid, level: "error", action: "backfill_error", error: String(err) });
    return json({ ok: false, error: err?.message, trace_id: tid }, 500, cors);
  }
});

function parseProfileSnapshot(markdown: string) {
  const result: any = {};

  // Rank & Score — "| Rank7798 | Score37.06 |"
  const rankScoreMatch = markdown.match(/Rank\s*(\d+)\s*\|\s*Score\s*([\d.]+)/i);
  if (rankScoreMatch) {
    result.uniranksRank = parseInt(rankScoreMatch[1], 10);
    result.score = parseFloat(rankScoreMatch[2]);
  }

  // Verified / Recognized
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

  // Region ranks
  const topBuckets: string[] = [];
  const regionRankRegex = /Top\s+([\w\s]+?)\s+#(\d+|Not Listed)/gi;
  let m;
  while ((m = regionRankRegex.exec(markdown)) !== null) {
    const region = m[1].trim();
    const val = m[2];
    if (val !== "Not Listed") {
      const num = parseInt(val, 10);
      if (region.toLowerCase().includes("world")) result.worldRank = num;
      else {
        result.regionRank = num;
        result.regionLabel = region;
      }
      topBuckets.push(`${region} #${val}`);
    }
  }
  if (topBuckets.length > 0) result.topBuckets = topBuckets;

  // Badges
  const badges: string[] = [];
  if (/Uniranks Elite/i.test(markdown)) badges.push("elite");
  if (/Uniranks Gold/i.test(markdown)) badges.push("gold");
  if (/Uniranks Silver/i.test(markdown)) badges.push("silver");
  if (badges.length > 0) result.badges = badges;

  // Sections
  const sections: string[] = [];
  if (/## About/i.test(markdown)) sections.push("about");
  if (/## .*Ranking/i.test(markdown)) sections.push("ranking");
  if (/## Student Statistics/i.test(markdown)) sections.push("students");
  if (/## .*Programs/i.test(markdown) || /## .*Courses/i.test(markdown)) sections.push("programs");
  if (/## .*Fees/i.test(markdown)) sections.push("fees");
  if (/International Students/i.test(markdown)) sections.push("international");
  if (sections.length > 0) result.sectionsPresent = sections;

  // Student count
  const studentsMatch = markdown.match(/Total students\s*\n+\s*([\d,]+)/i);
  if (studentsMatch) {
    const n = parseInt(studentsMatch[1].replace(/,/g, ""), 10);
    if (n > 0) result.studentsCount = n;
  }

  // Acceptance rate
  const acceptMatch = markdown.match(/Acceptance\s*Rate\s*\n+\s*([\d.]+)\s*%/i);
  if (acceptMatch) {
    const rate = parseFloat(acceptMatch[1]);
    if (rate > 0 && rate <= 100) result.acceptanceRate = rate;
  }

  // University type
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

  // Official website (NOT uniranks/cloudfront)
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
      } catch { /* skip */ }
    }
  }

  return result;
}

async function sha256Short(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

function json(data: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
