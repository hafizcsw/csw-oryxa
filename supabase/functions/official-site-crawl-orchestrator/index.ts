import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-trace-id, x-orxya-ingress, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function supaAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  
  if (!token) {
    console.error("[OSC Auth] No token found in authorization header");
    throw new Error("Unauthorized: no token");
  }

  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      console.log("[OSC Auth] JWT role:", payload.role);
      if (payload.role === "service_role") return "service_role";
    }
  } catch (e) {
    console.warn("[OSC Auth] JWT decode failed:", e);
  }

  if (token === SERVICE_ROLE_KEY) return "service_role";

  const db = supaAdmin();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) {
    console.error("[OSC Auth] getUser failed:", error?.message, "token prefix:", token.slice(0, 20));
    throw new Error("Unauthorized");
  }
  
  console.log("[OSC Auth] User:", user.id, "app_metadata:", JSON.stringify(user.app_metadata));

  const isAdminClaim = (user.app_metadata as any)?.is_admin === true;
  if (isAdminClaim) return user.id;

  try {
    const { data: isAdminRpc, error: rpcErr } = await db.rpc("is_admin", { _user_id: user.id as any });
    console.log("[OSC Auth] is_admin RPC result:", isAdminRpc, "error:", rpcErr?.message);
    if (isAdminRpc) return user.id;
  } catch (e: any) {
    console.warn("[OSC Auth] is_admin RPC exception:", e.message);
  }

  const pilotIds = JSON.parse(Deno.env.get("UNIS_ASSISTANT_PILOT_USER_IDS") ?? "[]") as string[];
  console.log("[OSC Auth] Pilot IDs:", pilotIds.length, "User in list:", pilotIds.includes(user.id));
  if (pilotIds.includes(user.id)) return user.id;

  throw new Error("Forbidden");
}

/* ── Firecrawl Health Check ────────────────────────────── */

async function handleFirecrawlHealth() {
  const keys = [
    { name: "FIRECRAWL_API_KEY_1", value: Deno.env.get("FIRECRAWL_API_KEY_1") ?? "" },
    { name: "FIRECRAWL_API_KEY", value: Deno.env.get("FIRECRAWL_API_KEY") ?? "" },
  ];

  const results: any[] = [];

  for (const key of keys) {
    if (!key.value) {
      results.push({
        key_source: key.name, key_present: false, key_fingerprint_masked: null,
        provider_reachable: false, auth_valid: false, http_status: null,
        error_message: "Key not set in environment",
      });
      continue;
    }

    const fingerprint = `****${key.value.slice(-4)}`;

    try {
      const mapResp = await fetch("https://api.firecrawl.dev/v1/map", {
        method: "POST",
        headers: { Authorization: `Bearer ${key.value}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", limit: 1 }),
      });
      const mapBody = await mapResp.text();
      const mapOk = mapResp.ok;

      let scrapeStatus: number | null = null;
      let scrapeOk = false;
      if (mapOk) {
        try {
          const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: { Authorization: `Bearer ${key.value}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url: "https://example.com", formats: ["markdown"] }),
          });
          scrapeStatus = scrapeResp.status;
          scrapeOk = scrapeResp.ok;
          await scrapeResp.text();
        } catch (e: any) { scrapeStatus = null; }
      }

      results.push({
        key_source: key.name, key_present: true, key_fingerprint_masked: fingerprint,
        provider_reachable: true, auth_valid: mapOk,
        http_status_map: mapResp.status, http_status_scrape: scrapeStatus,
        map_ok: mapOk, scrape_ok: scrapeOk,
        error_message: mapOk ? null : mapBody.slice(0, 300),
      });
    } catch (e: any) {
      results.push({
        key_source: key.name, key_present: true, key_fingerprint_masked: fingerprint,
        provider_reachable: false, auth_valid: false, http_status: null,
        error_message: e.message,
      });
    }
  }

  const anyValid = results.some(r => r.auth_valid);
  const activeKey = results.find(r => r.auth_valid);

  return {
    healthy: anyValid,
    active_key: activeKey?.key_source ?? null,
    active_key_fingerprint: activeKey?.key_fingerprint_masked ?? null,
    keys_tested: results,
    timestamp: new Date().toISOString(),
    blocker: anyValid ? null : {
      issue: "ALL_KEYS_UNAUTHORIZED",
      required_secrets: ["FIRECRAWL_API_KEY or FIRECRAWL_API_KEY_1"],
      action: "Update Firecrawl API key via Settings → Connectors or add_secret",
    },
  };
}

/* ── Anti-bot / interstitial detection ────────────────── */

const ANTI_BOT_PATTERNS = [
  /captcha/i,
  /cloudflare/i,
  /verify you are human/i,
  /access denied/i,
  /please enable javascript/i,
  /just a moment/i,
  /checking your browser/i,
  /ray id/i,
  /attention required/i,
  /bot detection/i,
  /security check/i,
  /one more step/i,
  /are you a robot/i,
  /blocked by/i,
  /403 forbidden/i,
  /you have been blocked/i,
  /zoom verify/i,
];

function detectAntiBotPage(text: string): boolean {
  if (!text || text.length < 20) return false;
  // Very short "page" content is suspicious
  if (text.length < 100) {
    const lower = text.toLowerCase();
    if (ANTI_BOT_PATTERNS.some(p => p.test(lower))) return true;
  }
  // Check first 2000 chars for anti-bot signals
  const snippet = text.slice(0, 2000).toLowerCase();
  const matchCount = ANTI_BOT_PATTERNS.filter(p => p.test(snippet)).length;
  return matchCount >= 2; // 2+ signals = anti-bot page
}

/* ── Sync job counters via RPC ───────────────────────── */

async function syncJobCounters(db: ReturnType<typeof supaAdmin>, jobId: string) {
  const { data } = await db.rpc("sync_osc_job_counters", { p_job_id: jobId });
  return data;
}

/* ── Handlers ─────────────────────────────────────────── */

async function handlePreflight(body: any) {
  const db = supaAdmin();
  const mode = body.rank_mode || "all";

  let query = db.from("universities").select("id", { count: "exact", head: true }).not("website", "is", null);
  if (mode === "top500") query = query.lte("uniranks_rank", 500);
  else if (mode === "top1000") query = query.lte("uniranks_rank", 1000);
  else if (mode === "pilot10") query = query.limit(10);

  const { count: withWebsite } = await query;

  let totalQuery = db.from("universities").select("id", { count: "exact", head: true });
  if (mode === "top500") totalQuery = totalQuery.lte("uniranks_rank", 500);
  else if (mode === "top1000") totalQuery = totalQuery.lte("uniranks_rank", 1000);
  else if (mode === "pilot10") totalQuery = totalQuery.limit(10);

  const { count: totalEligible } = await totalQuery;

  const { data: activeJobs } = await db
    .from("official_site_crawl_jobs")
    .select("id")
    .in("status", ["crawling", "verifying", "publishing"])
    .limit(1);

  const blockers: string[] = [];
  if (activeJobs && activeJobs.length > 0) blockers.push("يوجد مهمة نشطة بالفعل — أوقفها أولاً");
  if ((withWebsite || 0) === 0) blockers.push("لا توجد جامعات لديها موقع رسمي");

  return {
    total_eligible: totalEligible || 0,
    with_website: withWebsite || 0,
    without_website: (totalEligible || 0) - (withWebsite || 0),
    needs_crawl: withWebsite || 0,
    blockers,
  };
}

// ─── handleCreate: paginated seeding with country targeting ───
async function handleCreate(body: any, userId: string) {
  const db = supaAdmin();
  const mode = body.rank_mode || "all";
  const traceId = `OSC-${Date.now()}`;
  const countryCodes: string[] | null = body.country_codes || null;
  const universityIds: string[] | null = body.university_ids || null;
  const seedUrls: string[] | null = body.seed_urls || null;
  const maxUniversities: number | null = body.max_universities || null;
  const maxPagesPerUni: number = body.max_pages_per_uni || 8;

  // ── Single-university shortcut ──
  if (universityIds && universityIds.length > 0) {
    const { data: unis, error: unisErr } = await db
      .from("universities")
      .select("id, name_en, name_ar, website, country_code")
      .in("id", universityIds);
    if (unisErr) throw new Error(`Fetch universities error: ${unisErr.message}`);
    if (!unis || unis.length === 0) throw new Error("No matching universities found");

    const { data: job, error: jobErr } = await db
      .from("official_site_crawl_jobs")
      .insert({
        status: "crawling", phase: "crawl", mode: "targeted",
        total_universities: unis.length, trace_id: traceId,
        requested_by: userId === "service_role" ? null : userId,
        started_at: new Date().toISOString(),
        max_pages_per_uni: maxPagesPerUni, source_policy: "official_only",
        stats_json: { scope_type: "targeted", university_ids: universityIds, seed_urls: seedUrls, max_pages_per_uni: maxPagesPerUni },
      })
      .select().single();
    if (jobErr) throw new Error(`Failed to create job: ${jobErr.message}`);

    const rows = unis.map(u => ({
      job_id: job.id, university_id: u.id,
      university_name: u.name_en || u.name_ar,
      website: u.website, crawl_status: "queued",
      country_code: u.country_code || null,
      coverage_plan: seedUrls ? { seed_urls: seedUrls } : null,
    }));
    await db.from("official_site_crawl_rows").insert(rows);

    // Auto-dispatch workers
    try {
      await Promise.all(Array.from({ length: 2 }, (_, i) =>
        fetch(`${SUPABASE_URL}/functions/v1/official-site-crawl-worker`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: job.id, worker_id: `targeted-${i}` }),
        }).catch(e => console.warn(`[OSC] Auto-dispatch ${i} failed:`, e))
      ));
    } catch (e) { console.warn("[OSC] Auto-dispatch failed:", e); }

    const counters = await syncJobCounters(db, job.id);
    return { job: { ...job, total_universities: unis.length }, seeded: unis.length, counters };
  }

  // Build base query with country filter
  function applyFilters(q: any) {
    q = q.not("website", "is", null);
    if (countryCodes && countryCodes.length > 0) {
      q = q.in("country_code", countryCodes);
    }
    if (mode === "top500") q = q.lte("uniranks_rank", 500);
    else if (mode === "top1000") q = q.lte("uniranks_rank", 1000);
    else if (mode === "pilot10") q = q.limit(10);
    return q;
  }

  let countQ = applyFilters(db.from("universities").select("id", { count: "exact", head: true }));
  const { count: totalEligible } = await countQ;

  const effectiveMax = maxUniversities ? Math.min(maxUniversities, totalEligible || 0) : (totalEligible || 0);

  const { data: job, error: jobErr } = await db
    .from("official_site_crawl_jobs")
    .insert({
      status: "crawling",
      phase: "crawl",
      mode,
      total_universities: effectiveMax,
      trace_id: traceId,
      requested_by: userId === "service_role" ? null : userId,
      started_at: new Date().toISOString(),
      country_codes: countryCodes,
      max_universities: maxUniversities,
      max_pages_per_uni: maxPagesPerUni,
      source_policy: "official_only",
      stats_json: {
        scope_type: "official_site_only",
        mode,
        country_codes: countryCodes,
        max_universities: maxUniversities,
        max_pages_per_uni: maxPagesPerUni,
        total_eligible: totalEligible || 0,
      },
    })
    .select()
    .single();

  if (jobErr) throw new Error(`Failed to create job: ${jobErr.message}`);

  const PAGE_SIZE = 1000;
  const INSERT_CHUNK = 200;
  let offset = 0;
  let seeded = 0;

  while (seeded < effectiveMax) {
    let query = db
      .from("universities")
      .select("id, name_en, name_ar, website, uniranks_rank, country_code")
      .not("website", "is", null)
      .order("uniranks_rank", { ascending: true, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (countryCodes && countryCodes.length > 0) {
      query = query.in("country_code", countryCodes);
    }
    if (mode === "top500") query = query.lte("uniranks_rank", 500);
    else if (mode === "top1000") query = query.lte("uniranks_rank", 1000);
    else if (mode === "pilot10") query = query.limit(10);

    const { data: unis, error: unisErr } = await query;
    if (unisErr) throw new Error(`Fetch page error: ${unisErr.message}`);
    if (!unis || unis.length === 0) break;

    const remaining = effectiveMax - seeded;
    const toSeed = unis.slice(0, remaining);

    for (let i = 0; i < toSeed.length; i += INSERT_CHUNK) {
      const chunk = toSeed.slice(i, i + INSERT_CHUNK).map((u) => ({
        job_id: job.id,
        university_id: u.id,
        university_name: u.name_en || u.name_ar,
        website: u.website,
        crawl_status: "queued",
        country_code: u.country_code || null,
      }));
      await db.from("official_site_crawl_rows").insert(chunk);
      seeded += chunk.length;
    }

    offset += PAGE_SIZE;
    if (mode === "pilot10") break;
    if (unis.length < PAGE_SIZE) break;
  }

  await db.from("official_site_crawl_jobs").update({
    total_universities: seeded,
    stats_json: {
      scope_type: "official_site_only",
      mode,
      country_codes: countryCodes,
      max_universities: maxUniversities,
      max_pages_per_uni: maxPagesPerUni,
      total_eligible: totalEligible || 0,
      seeded_into_job: seeded,
    },
  }).eq("id", job.id);

  // Auto-dispatch 3 parallel workers
  try {
    const workerPromises = Array.from({ length: 3 }, (_, i) =>
      fetch(`${SUPABASE_URL}/functions/v1/official-site-crawl-worker`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_id: job.id, worker_id: `auto-${i}` }),
      }).catch(e => console.warn(`[OSC] Auto-dispatch ${i} failed:`, e))
    );
    await Promise.all(workerPromises);
  } catch (e) {
    console.warn("[OSC] Auto-dispatch failed:", e);
  }

  const counters = await syncJobCounters(db, job.id);
  return { job: { ...job, total_universities: seeded }, seeded, counters };
}

/* ── Tick: auto-dispatch loop without pg_cron ─────────── */

async function handleTick(jobId: string) {
  const db = supaAdmin();

  const { data: job } = await db
    .from("official_site_crawl_jobs")
    .select("id, status, phase")
    .eq("id", jobId)
    .single();

  if (!job || !["crawling"].includes(job.status)) {
    return { skipped: true, reason: "job not in crawling status" };
  }

  const leaseOwner = `tick-${crypto.randomUUID().slice(0, 8)}`;
  const { data: leaseAcquired } = await db.rpc("rpc_osc_claim_tick_lease", {
    p_job_id: jobId,
    p_owner: leaseOwner,
    p_ttl_seconds: 90,
  });

  if (!leaseAcquired) {
    return { skipped: true, reason: "tick lease held by another worker" };
  }

  try {
    const workerPromises = Array.from({ length: 5 }, (_, i) =>
      fetch(`${SUPABASE_URL}/functions/v1/official-site-crawl-worker`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_id: jobId, worker_id: `tick-${Date.now()}-${i}` }),
      }).then(r => r.json()).catch(e => ({ error: e.message }))
    );
    const workerResults = await Promise.all(workerPromises);

    const { count: queuedCount } = await db
      .from("official_site_crawl_rows")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("crawl_status", "queued");

    const { count: fetchingCount } = await db
      .from("official_site_crawl_rows")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("crawl_status", "fetching");

    const jobDone = (queuedCount || 0) === 0 && (fetchingCount || 0) === 0;

    if (jobDone) {
      await db.from("official_site_crawl_jobs").update({
        phase: "verify",
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
    }

    // Always sync counters after tick
    const counters = await syncJobCounters(db, jobId);

    return {
      ok: true,
      worker_results: workerResults,
      job_done: jobDone,
      queued_remaining: queuedCount || 0,
      counters,
    };
  } finally {
    await db.rpc("rpc_osc_release_tick_lease", {
      p_job_id: jobId,
      p_owner: leaseOwner,
    }).then(() => {}, () => {});
  }
}

/* ── Row counters helper (kept for backward compat) ──── */

async function getRowCounters(db: ReturnType<typeof supaAdmin>, jobId: string) {
  const { data: statusRows } = await db
    .from("official_site_crawl_rows")
    .select("crawl_status")
    .eq("job_id", jobId);

  const rowStats: Record<string, number> = {};
  for (const r of statusRows || []) {
    rowStats[r.crawl_status] = (rowStats[r.crawl_status] || 0) + 1;
  }
  return rowStats;
}

/* ── Status ───────────────────────────────────────────── */
/*
  Status Mapping Contract:
  ─────────────────────────
  Raw DB crawl_status values → UI counter mapping:
  
  queued           → (not counted as processed)
  fetching         → (not counted as processed)
  extracting       → (not counted as processed)
  verifying        → crawled (processing done, awaiting verify)
  verified         → crawled + verified
  published        → crawled + verified + published (actual DB writes happened)
  published_partial→ crawled + verified + published (obs marked published, no DB write needed)
  quarantined      → quarantined
  failed           → failed
  special          → special_queue
  
  UI "تم النشر" = published + published_partial (combined)
  UI "تم الزحف" = verifying + verified + published + published_partial + quarantined
  UI "تم التحقق" = verified + published + published_partial
*/

async function handleStatus() {
  const db = supaAdmin();

  const { data: jobs } = await db
    .from("official_site_crawl_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!jobs || jobs.length === 0) return { job: null, coverage: null, reason_codes: [], row_stats: null, synced_counters: null };

  const job = jobs[0];
  const rowStats = await getRowCounters(db, job.id);

  // Sync counters from RPC (single source of truth)
  const synced = await syncJobCounters(db, job.id);

  // Reason codes
  const { data: rows } = await db
    .from("official_site_crawl_rows")
    .select("reason_codes")
    .eq("job_id", job.id)
    .not("reason_codes", "is", null);

  const codeMap: Record<string, number> = {};
  for (const row of rows || []) {
    if (Array.isArray(row.reason_codes)) {
      for (const code of row.reason_codes) {
        codeMap[code] = (codeMap[code] || 0) + 1;
      }
    }
  }
  const reason_codes = Object.entries(codeMap)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  // Coverage from observations
  const { data: obsAgg } = await db
    .from("official_site_observations")
    .select("field_name, status")
    .eq("job_id", job.id);

  const coverageFields = ["description", "logo", "programs", "fees", "housing", "images", "contact"];
  const coverage: Record<string, { attempted: number; found: number; verified: number; published: number }> = {};
  for (const f of coverageFields) coverage[f] = { attempted: 0, found: 0, verified: 0, published: 0 };
  for (const obs of obsAgg || []) {
    const f = obs.field_name;
    if (coverage[f]) {
      coverage[f].attempted++;
      if (["new", "verified", "published"].includes(obs.status)) coverage[f].found++;
      if (["verified", "published"].includes(obs.status)) coverage[f].verified++;
      if (obs.status === "published") coverage[f].published++;
    }
  }

  // Special queue breakdown
  const { data: specialRows } = await db
    .from("official_site_crawl_rows")
    .select("reason_codes")
    .eq("job_id", job.id)
    .eq("crawl_status", "special");

  const specialBreakdown: Record<string, number> = {};
  for (const s of specialRows || []) {
    if (Array.isArray(s.reason_codes)) {
      for (const code of s.reason_codes) {
        specialBreakdown[code] = (specialBreakdown[code] || 0) + 1;
      }
    }
  }

  return { job, coverage, reason_codes, row_stats: rowStats, synced_counters: synced, special_breakdown: specialBreakdown };
}

/* ── Verify Logic (strengthened with anti-bot detection) ── */

const BLOCKED_DOMAINS = ["uniranks.com", "4icu.org", "topuniversities.com", "webometrics.info"];

function isOfficialSource(sourceUrl: string, universityWebsite: string): boolean {
  try {
    const sourceHost = new URL(sourceUrl).hostname.toLowerCase();
    const uniHost = new URL(universityWebsite.startsWith("http") ? universityWebsite : `https://${universityWebsite}`).hostname.toLowerCase();
    if (BLOCKED_DOMAINS.some(d => sourceHost.endsWith(d))) return false;
    return sourceHost === uniHost || sourceHost.endsWith(`.${uniHost}`);
  } catch { return false; }
}

async function handleVerify(jobId: string) {
  const db = supaAdmin();

  const { data: rows, error } = await db
    .from("official_site_crawl_rows")
    .select("id, university_id, website")
    .eq("job_id", jobId)
    .eq("crawl_status", "verifying")
    .limit(500);

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return { verified: 0, quarantined: 0, special: 0, message: "No rows to verify" };

  let verified = 0, quarantined = 0, special = 0;

  for (const row of rows) {
    const { data: obs } = await db
      .from("official_site_observations")
      .select("*")
      .eq("row_id", row.id);

    if (!obs || obs.length === 0) {
      await db.from("official_site_crawl_rows").update({
        crawl_status: "quarantined",
        reason_codes: ["NO_OBSERVATIONS"],
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      quarantined++;
      continue;
    }

    const issues: string[] = [];
    let hasVerifiedObs = false;

    for (const o of obs) {
      const obsIssues: string[] = [];

      // Rule 0: Anti-bot / interstitial page detection
      const evidenceText = (o.evidence_snippet || "") + " " + (o.value_raw || "");
      if (detectAntiBotPage(evidenceText)) {
        obsIssues.push("ANTI_BOT_PAGE");
      }

      // Rule 1: source_url must be within official domain
      if (o.source_url && row.website && !isOfficialSource(o.source_url, row.website)) {
        obsIssues.push("NON_OFFICIAL_SOURCE");
      }

      // Rule 2: evidence_snippet must exist
      if (!o.evidence_snippet || o.evidence_snippet.trim().length < 10) {
        obsIssues.push("WEAK_EVIDENCE");
      }

      // Rule 3: trace_id must exist
      if (!o.trace_id) {
        obsIssues.push("MISSING_TRACE_ID");
      }

      // Rule 4: For fees — strict 2025/2026 checks only
      if (o.field_name === "fees") {
        const cycleText = (o.cycle_detected || o.evidence_snippet || "").toString();
        if (!/202[5-6]/.test(cycleText)) {
          obsIssues.push("STALE_CYCLE");
        }
        if (!o.currency) obsIssues.push("MISSING_CURRENCY");
        if (!o.billing_period) obsIssues.push("MISSING_BILLING_PERIOD");
        
        const numVal = parseFloat(o.value_normalized || o.value_raw || "0");
        if (numVal > 0 && (numVal < 50 || numVal > 200000)) {
          obsIssues.push("PRICE_OUTLIER");
        }

        if (o.currency && o.billing_period) {
          const raw = (o.value_raw || "").toLowerCase();
          if ((raw.includes("usd") && raw.includes("eur")) || 
              (raw.includes("per year") && raw.includes("per semester"))) {
            obsIssues.push("AMBIGUOUS_CURRENCY_OR_PERIOD");
          }
        }
      }

      // Rule 5: Missing metadata checks
      if (!o.fetched_at) obsIssues.push("MISSING_FETCHED_AT");
      if (!o.parser_version) obsIssues.push("MISSING_PARSER_VERSION");

      // Rule 6: Conflict with published data
      if (o.field_name === "description" || o.field_name === "logo") {
        const { data: existing } = await db.from("universities")
          .select(o.field_name === "description" ? "description" : "logo_url")
          .eq("id", row.university_id).single();
        const existingVal = o.field_name === "description" ? existing?.description : existing?.logo_url;
        if (existingVal && o.value_raw && existingVal !== o.value_raw) {
          obsIssues.push("CONFLICT_WITH_PUBLISHED");
        }
      }

      // Rule 7: Confidence threshold
      if (o.confidence < 0.4) {
        obsIssues.push("LOW_CONFIDENCE");
      }

      // Rule 8: Hard-sites truth-policy enforcement
      // verify_tier is stamped by osc-hard-sites-worker; enforce it here
      const vTier = o.verify_tier || "auto_verify";
      if (vTier === "never_publish") {
        obsIssues.push("TRUTH_POLICY_NEVER_PUBLISH");
      } else if (vTier === "review_only") {
        obsIssues.push("TRUTH_POLICY_REVIEW_ONLY");
      }
      // "verify_only" passes verification but gets flagged for publish gate
      // "auto_verify" passes normally

      // Set observation status
      if (obsIssues.length === 0) {
        await db.from("official_site_observations").update({ status: "verified" }).eq("id", o.id);
        hasVerifiedObs = true;
      } else if (obsIssues.length === 1 && obsIssues[0] === "TRUTH_POLICY_REVIEW_ONLY") {
        // review_only: mark as review, not quarantined
        await db.from("official_site_observations").update({
          status: "review",
          reason_code: "TRUTH_POLICY_REVIEW_ONLY",
        }).eq("id", o.id);
        // Still count as partially verified for row-level
      } else {
        await db.from("official_site_observations").update({
          status: "quarantined",
          reason_code: obsIssues[0],
        }).eq("id", o.id);
        issues.push(...obsIssues);
      }
    }

    // Determine row-level verdict
    const uniqueIssues = [...new Set(issues)];
    const hasCritical = uniqueIssues.some(i => 
      ["NON_OFFICIAL_SOURCE", "PRICE_OUTLIER", "STALE_CYCLE", "AMBIGUOUS_CURRENCY_OR_PERIOD", "ANTI_BOT_PAGE"].includes(i)
    );

    if (hasVerifiedObs && !hasCritical) {
      await db.from("official_site_crawl_rows").update({
        crawl_status: "verified",
        reason_codes: uniqueIssues.length > 0 ? uniqueIssues : null,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      verified++;
    } else {
      await db.from("official_site_crawl_rows").update({
        crawl_status: "quarantined",
        reason_codes: uniqueIssues,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      quarantined++;
    }
  }

  return { verified, quarantined, special, total_processed: rows.length };
}

/* ── Publish Logic (Lanes) ────────────────────────────── */

const LANE_A_FIELDS = ["logo", "images", "contact", "description"]; // Low risk
const LANE_B_FIELDS = ["programs", "housing"];                       // Medium risk
const LANE_C_FIELDS = ["fees"];                                      // High risk — deferred

async function handlePublish(jobId: string, userId: string) {
  const db = supaAdmin();

  const { data: rows, error } = await db
    .from("official_site_crawl_rows")
    .select("id, university_id")
    .eq("job_id", jobId)
    .eq("crawl_status", "verified")
    .limit(500);

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return { published: 0, message: "No verified rows to publish" };

  const { data: batch } = await db.from("official_site_publish_batches").insert({
    job_id: jobId, batch_type: "lane_a_b", status: "applying",
    total_items: rows.length, requested_by: userId === "service_role" ? null : userId,
  }).select().single();

  let appliedLow = 0, appliedMed = 0, skippedHigh = 0;
  const publishLog: any[] = [];

  for (const row of rows) {
    const { data: obs } = await db
      .from("official_site_observations")
      .select("*")
      .eq("row_id", row.id)
      .eq("status", "verified");

    if (!obs || obs.length === 0) {
      publishLog.push({ university_id: row.university_id, action: "skipped", reason: "no_verified_obs" });
      continue;
    }

    const uniUpdate: Record<string, any> = {};

    for (const o of obs) {
      // ── Lane A: Low risk — fill-empty only ──
      if (LANE_A_FIELDS.includes(o.field_name)) {
        if (o.field_name === "description" && o.value_raw) {
          const { data: existing } = await db.from("universities").select("description").eq("id", row.university_id).single();
          if (!existing?.description) {
            uniUpdate.description = o.value_raw;
            publishLog.push({ university_id: row.university_id, field: "description", action: "applied", reason: "fill_empty" });
          } else {
            publishLog.push({ university_id: row.university_id, field: "description", action: "skipped_existing", reason: "already_has_value" });
          }
        }
        if (o.field_name === "logo" && o.value_raw) {
          const { data: existing } = await db.from("universities").select("logo_url").eq("id", row.university_id).single();
          if (!existing?.logo_url) {
            uniUpdate.logo_url = o.value_raw;
            publishLog.push({ university_id: row.university_id, field: "logo", action: "applied", reason: "fill_empty" });
          } else {
            publishLog.push({ university_id: row.university_id, field: "logo", action: "skipped_existing", reason: "already_has_value" });
          }
        }
        if (o.field_name === "contact" || o.field_name === "images") {
          publishLog.push({ university_id: row.university_id, field: o.field_name, action: "obs_only", reason: "no_target_column" });
        }
        appliedLow++;
        await db.from("official_site_observations").update({ status: "published" }).eq("id", o.id);
      }

      // ── Lane B: Medium risk — obs_published_only ──
      if (LANE_B_FIELDS.includes(o.field_name)) {
        appliedMed++;
        await db.from("official_site_observations").update({ status: "published" }).eq("id", o.id);
        publishLog.push({ university_id: row.university_id, field: o.field_name, action: "obs_published_only", reason: "lane_b_no_direct_write" });
      }

      // ── Lane C: High risk (fees) — DO NOT apply ──
      if (LANE_C_FIELDS.includes(o.field_name)) {
        skippedHigh++;
        publishLog.push({ university_id: row.university_id, field: "fees", action: "quarantined", reason: "lane_c_high_risk" });
      }
    }

    if (Object.keys(uniUpdate).length > 0) {
      await db.from("universities").update(uniUpdate).eq("id", row.university_id);
    }

    const hasActualWrite = Object.keys(uniUpdate).length > 0;
    await db.from("official_site_crawl_rows").update({
      crawl_status: hasActualWrite ? "published" : "published_partial",
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
  }

  if (batch) {
    await db.from("official_site_publish_batches").update({
      status: "done",
      applied_items: appliedLow + appliedMed,
      completed_at: new Date().toISOString(),
    }).eq("id", batch.id);
  }

  return {
    published: rows.length,
    lane_a_applied: appliedLow,
    lane_b_applied: appliedMed,
    lane_c_skipped: skippedHigh,
    publish_log: publishLog.slice(0, 20),
  };
}

/* ── Dispatch Worker ─────────────────────────────────── */

async function handleDispatch(jobId: string) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/official-site-crawl-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job_id: jobId, worker_id: `dispatch-${Date.now()}` }),
  });
  const result = await resp.json();
  return result;
}

async function handleJobAction(action: string, jobId: string, userId: string) {
  const db = supaAdmin();

  if (action === "tick") {
    return await handleTick(jobId);
  }

  if (action === "start_verify") {
    await db.from("official_site_crawl_jobs").update({
      status: "verifying", phase: "verify", updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    
    let totalResult = { verified: 0, quarantined: 0, special: 0, total_processed: 0 };
    let hasMore = true;
    while (hasMore) {
      const batch = await handleVerify(jobId);
      totalResult.verified += batch.verified || 0;
      totalResult.quarantined += batch.quarantined || 0;
      totalResult.special += batch.special || 0;
      totalResult.total_processed += batch.total_processed || 0;
      hasMore = (batch.total_processed || 0) > 0;
    }
    
    await db.from("official_site_crawl_jobs").update({
      phase: "publish", updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    // Sync counters after verify
    const counters = await syncJobCounters(db, jobId);
    
    return { ...totalResult, counters };
  }

  if (action === "start_publish") {
    await db.from("official_site_crawl_jobs").update({
      status: "publishing", phase: "publish", updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    
    let totalResult = { published: 0, lane_a_applied: 0, lane_b_applied: 0, lane_c_skipped: 0, publish_log: [] as any[] };
    let hasMore = true;
    while (hasMore) {
      const batch = await handlePublish(jobId, userId);
      totalResult.published += batch.published || 0;
      totalResult.lane_a_applied += batch.lane_a_applied || 0;
      totalResult.lane_b_applied += batch.lane_b_applied || 0;
      totalResult.lane_c_skipped += batch.lane_c_skipped || 0;
      if (batch.publish_log) totalResult.publish_log.push(...batch.publish_log);
      hasMore = (batch.published || 0) > 0;
    }
    
    await db.from("official_site_crawl_jobs").update({
      status: "done", phase: "idle", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    
    // Sync counters after publish
    const counters = await syncJobCounters(db, jobId);
    
    totalResult.publish_log = totalResult.publish_log.slice(0, 50);
    return { ...totalResult, counters };
  }

  if (action === "dispatch_worker") {
    return await handleDispatch(jobId);
  }

  const statusMap: Record<string, { status: string; phase?: string }> = {
    pause: { status: "paused" },
    resume: { status: "crawling", phase: "crawl" },
    cancel: { status: "cancelled" },
  };

  const update = statusMap[action];
  if (!update) throw new Error(`Unknown action: ${action}`);

  await db.from("official_site_crawl_jobs").update({
    ...update, updated_at: new Date().toISOString(),
  }).eq("id", jobId);

  if (action === "resume") {
    try { await handleDispatch(jobId); } catch (e) { console.warn("Resume dispatch failed:", e); }
  }

  // Sync counters after any action
  const counters = await syncJobCounters(db, jobId);

  return { ok: true, counters };
}

/* ── Auto-run: unified cron handler ───────────────────── */

async function handleAutoRun() {
  const db = supaAdmin();

  // Find the latest active job
  const { data: jobs } = await db
    .from("official_site_crawl_jobs")
    .select("id, status, phase")
    .in("status", ["crawling", "verifying", "publishing"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (!jobs || jobs.length === 0) {
    return { ok: true, message: "No active job", action_taken: "none" };
  }

  const job = jobs[0];
  const actions: string[] = [];

  // Phase 1: If crawling, tick
  if (job.status === "crawling") {
    const tickResult = await handleTick(job.id);
    actions.push(`tick: queued=${tickResult.queued_remaining ?? "?"}`);

    // If tick marked job done (phase→verify), fall through to verify
    const { data: refreshed } = await db
      .from("official_site_crawl_jobs")
      .select("status, phase")
      .eq("id", job.id)
      .single();

    if (refreshed?.phase !== "verify") {
      const counters = await syncJobCounters(db, job.id);
      return { ok: true, job_id: job.id, actions, counters, phase: "crawl" };
    }
    // else fall through to verify
  }

  // Phase 2: Verify all pending rows
  const { count: verifyingCount } = await db
    .from("official_site_crawl_rows")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id)
    .eq("crawl_status", "verifying");

  if ((verifyingCount || 0) > 0) {
    // Set status to verifying if not already
    if (job.status !== "verifying") {
      await db.from("official_site_crawl_jobs").update({
        status: "verifying", phase: "verify", updated_at: new Date().toISOString(),
      }).eq("id", job.id);
    }

    let totalVerified = 0, totalQuarantined = 0;
    let hasMore = true;
    while (hasMore) {
      const batch = await handleVerify(job.id);
      totalVerified += batch.verified || 0;
      totalQuarantined += batch.quarantined || 0;
      hasMore = (batch.total_processed || 0) > 0;
    }
    actions.push(`verify: verified=${totalVerified}, quarantined=${totalQuarantined}`);

    await db.from("official_site_crawl_jobs").update({
      phase: "publish", updated_at: new Date().toISOString(),
    }).eq("id", job.id);
  }

  // Phase 3: Publish all verified rows
  const { count: verifiedCount } = await db
    .from("official_site_crawl_rows")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id)
    .eq("crawl_status", "verified");

  if ((verifiedCount || 0) > 0) {
    if (job.status !== "publishing") {
      await db.from("official_site_crawl_jobs").update({
        status: "publishing", phase: "publish", updated_at: new Date().toISOString(),
      }).eq("id", job.id);
    }

    let totalPublished = 0, laneA = 0, laneB = 0, laneC = 0;
    let hasMore = true;
    while (hasMore) {
      const batch = await handlePublish(job.id, "service_role");
      totalPublished += batch.published || 0;
      laneA += batch.lane_a_applied || 0;
      laneB += batch.lane_b_applied || 0;
      laneC += batch.lane_c_skipped || 0;
      hasMore = (batch.published || 0) > 0;
    }
    actions.push(`publish: total=${totalPublished}, a=${laneA}, b=${laneB}, c_skip=${laneC}`);
  }

  // Check if all rows are terminal (no more queued/fetching/extracting/verifying/verified)
  const { count: pendingCount } = await db
    .from("official_site_crawl_rows")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id)
    .in("crawl_status", ["queued", "fetching", "extracting", "verifying", "verified"]);

  if ((pendingCount || 0) === 0) {
    await db.from("official_site_crawl_jobs").update({
      status: "done", phase: "idle", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    actions.push("job_complete");
  }

  const counters = await syncJobCounters(db, job.id);
  return { ok: true, job_id: job.id, actions, counters };
}

/* ── Retry Special: dispatch hard-sites worker ────────── */

async function handleRetrySpecial(jobId: string, body: any) {
  const db = supaAdmin();
  const universityIds: string[] | undefined = body.university_ids;
  const maxRows: number = body.max_rows || 5;

  // Count eligible rows
  let countQ = db.from("official_site_crawl_rows")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .in("crawl_status", ["special", "failed"]);
  if (universityIds?.length) countQ = countQ.in("university_id", universityIds);
  const { count } = await countQ;

  if (!count || count === 0) return { ok: true, message: "No special/failed rows to retry", count: 0 };

  // Dispatch hard-sites worker
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/osc-hard-sites-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_id: jobId,
      university_ids: universityIds,
      max_rows: maxRows,
    }),
  });

  const result = await resp.json();
  return { ok: true, eligible: count, dispatched: true, hard_sites_result: result };
}

/* ── Main ─────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await requireAdmin(req);
    const body = await req.json();
    const { action, job_id } = body;

    let result: any;

    switch (action) {
      case "preflight":
        result = await handlePreflight(body);
        break;
      case "firecrawl_health":
        result = await handleFirecrawlHealth();
        break;
      case "create":
        result = await handleCreate(body, userId);
        break;
      case "status":
        result = await handleStatus();
        break;
      case "auto_run":
        result = await handleAutoRun();
        break;
      case "pause":
      case "resume":
      case "cancel":
      case "tick":
      case "start_verify":
      case "start_publish":
      case "dispatch_worker":
        if (!job_id) throw new Error("job_id required");
        result = await handleJobAction(action, job_id, userId);
        break;
      case "retry_special":
        if (!job_id) throw new Error("job_id required");
        result = await handleRetrySpecial(job_id, body);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("OSC Orchestrator error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }
});
