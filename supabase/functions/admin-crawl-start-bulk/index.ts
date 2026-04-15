import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

/**
 * admin-crawl-start-bulk
 * Creates a large batch containing ALL eligible universities for the selected mode.
 * The existing pg_cron (crawl-runner-tick every minute) processes them gradually.
 * 
 * Body: { mode?: string }
 * Returns: { ok, batch_id, universities_count, message }
 */

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: auth.error, trace_id: tid }),
      { status: auth.status, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  const supabase = auth.srv;

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "uniranks";

    // Check if there's already an active batch
    const { data: activeBatch } = await supabase
      .from("crawl_batches")
      .select("id, status, universities_count")
      .in("status", ["pending", "websites", "discovery", "fetching", "extracting", "verifying"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (activeBatch) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "batch_already_active",
          active_batch_id: activeBatch.id,
          active_batch_status: activeBatch.status,
          universities_count: activeBatch.universities_count,
          trace_id: tid,
        }),
        { status: 409, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // Build query based on mode
    let query = supabase
      .from("universities")
      .select("id")
      .eq("is_active", true);

    if (mode === "official") {
      // Only universities with resolved official websites
      query = query
        .not("website", "is", null)
        .not("website_etld1", "is", null)
        .in("crawl_status", ["website_resolved", "pending"]);
    } else if (mode === "uniranks") {
      // Universities with uniranks profile URL
      query = query
        .not("uniranks_profile_url", "is", null)
        .in("crawl_status", ["pending", "no_official_website", "website_not_found", "website_resolved"]);
    } else if (mode === "hybrid") {
      // All universities that have either official website or uniranks profile
      query = query
        .in("crawl_status", ["pending", "no_official_website", "website_not_found", "website_resolved"]);
    } else {
      // QS or other
      query = query
        .in("crawl_status", ["pending", "website_resolved"]);
    }

    // Get count first
    const { count: totalCount } = await supabase
      .from("universities")
      .select("id", { head: true, count: "exact" })
      .eq("is_active", true)
      .in("crawl_status", mode === "official"
        ? ["website_resolved", "pending"]
        : ["pending", "no_official_website", "website_not_found", "website_resolved"]);

    if (!totalCount || totalCount === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "no_eligible_universities", trace_id: tid }),
        { status: 404, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // Create the batch
    const { data: batch, error: batchErr } = await supabase
      .from("crawl_batches")
      .insert({
        status: "pending",
        universities_count: totalCount,
      })
      .select("id")
      .single();

    if (batchErr || !batch) throw batchErr || new Error("Failed to create batch");

    // Fetch all eligible university IDs (in chunks of 1000)
    let assignedCount = 0;
    let offset = 0;
    const chunkSize = 1000;

    while (offset < totalCount) {
      let chunkQuery = supabase
        .from("universities")
        .select("id")
        .eq("is_active", true);

      if (mode === "official") {
        chunkQuery = chunkQuery
          .not("website", "is", null)
          .not("website_etld1", "is", null)
          .in("crawl_status", ["website_resolved", "pending"]);
      } else if (mode === "uniranks") {
        chunkQuery = chunkQuery
          .not("uniranks_profile_url", "is", null)
          .in("crawl_status", ["pending", "no_official_website", "website_not_found", "website_resolved"]);
      } else {
        chunkQuery = chunkQuery
          .in("crawl_status", ["pending", "no_official_website", "website_not_found", "website_resolved"]);
      }

      const { data: unis } = await chunkQuery
        .order("ranking", { ascending: true, nullsFirst: false })
        .range(offset, offset + chunkSize - 1);

      if (!unis?.length) break;

      const batchUnis = unis.map((u: any) => ({
        batch_id: batch.id,
        university_id: u.id,
      }));

      await supabase.from("crawl_batch_universities").insert(batchUnis);
      assignedCount += unis.length;
      offset += chunkSize;
    }

    // Make sure the crawl is NOT paused (auto-unpause)
    await supabase.rpc("rpc_set_crawl_paused", { p_paused: false });

    // Set the crawl policy mode
    const { data: currentPolicy } = await supabase
      .from("crawl_settings")
      .select("value")
      .eq("key", "crawl_policy")
      .single();

    const updatedPolicy = { ...(currentPolicy?.value || {}), mode };
    await supabase.rpc("rpc_set_crawl_policy", { p_policy: updatedPolicy });

    slog({ tid, level: "info", action: "bulk_batch_created", batch_id: batch.id, count: assignedCount, mode });

    return new Response(
      JSON.stringify({
        ok: true,
        batch_id: batch.id,
        universities_count: assignedCount,
        mode,
        message: `تم إنشاء دفعة زحف تحتوي ${assignedCount} جامعة. الـ cron سيعالجها تدريجياً.`,
        trace_id: tid,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors } }
    );
  } catch (err: any) {
    slog({ tid, level: "error", error: String(err) });
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || String(err), trace_id: tid }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } }
    );
  }
});
