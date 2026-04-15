import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FETCH_TIMEOUT_MS = 12000;
const UA = "LavistaCrawler/1.0 (+https://connectstudyworld.com)";

function generateTraceId(): string {
  return crypto.randomUUID();
}

async function insertIngestError(supabase: any, payload: Record<string, unknown>) {
  const details = payload.details_json ?? payload.details ?? {};
  const { details: _, ...rest } = payload;
  await supabase.from("ingest_errors").insert({ ...rest, details_json: details });
}

interface FetchRequest {
  action: "fetch_batch" | "retry_failed";
  batch_id: string;
  limit?: number;
  // Admin-only debugging: when true, include the locked URL IDs in the response
  return_ids?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // SECURITY: Require admin authentication
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return new Response(
        JSON.stringify({ error: adminCheck.error }),
        { status: adminCheck.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = adminCheck.srv;
    const body: FetchRequest = await req.json();
    console.log(`[crawl-fetch-worker] Action: ${body.action}, Batch: ${body.batch_id}, User: ${adminCheck.user.id}`);

    switch (body.action) {
      case "fetch_batch":
        return await fetchBatch(supabase, body);
      case "retry_failed":
        return await retryFailed(supabase, body);
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("[crawl-fetch-worker] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fetchBatch(supabase: any, body: FetchRequest) {
  const { batch_id, limit = 50 } = body;

  // FIXED: Use the real SKIP LOCKED RPC function
  const { data: urls, error: selectError } = await supabase.rpc("rpc_lock_program_urls_for_fetch", {
    p_batch_id: batch_id,
    p_limit: limit,
    p_locked_by: `fetch-worker-${Date.now()}`,
  });

  if (selectError) {
    throw new Error(`Failed to lock URLs: ${selectError.message}`);
  }

  const lockedUrlIds = (urls || []).map((u: any) => u.id);

  let fetched = 0;
  let failed = 0;
  let retried = 0;
  let needsRender = 0;

  for (const urlRecord of urls || []) {
    try {
      const result = await fetchAndStoreContent(supabase, urlRecord);

      if (result.success) {
        // Update program_url with raw_page_id - lock already set by RPC
        await supabase
          .from("program_urls")
          .update({
            status: "fetched",
            raw_page_id: result.rawPageId,
            locked_at: null,
            locked_by: null,
          })
          .eq("id", urlRecord.id);

        fetched++;
        if (result.needsRender) needsRender++;
      } else if (result.retry) {
        // Schedule retry
        await supabase
          .from("program_urls")
          .update({
            status: "retry",
            retry_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
            fetch_error: result.error,
            locked_at: null,
            locked_by: null,
          })
          .eq("id", urlRecord.id);

        await insertIngestError(supabase, { pipeline: "crawl_pipeline", batch_id, entity_hint: "page", source_url: urlRecord.url, stage: "fetch", reason: "retry_scheduled", details_json: { error: result.error, url_id: urlRecord.id } });
        retried++;
      } else {
        // Mark as failed
        await supabase
          .from("program_urls")
          .update({
            status: "failed",
            fetch_error: result.error,
            locked_at: null,
            locked_by: null,
          })
          .eq("id", urlRecord.id);

        await insertIngestError(supabase, { pipeline: "crawl_pipeline", batch_id, entity_hint: "page", source_url: urlRecord.url, stage: "fetch", reason: "fetch_failed", details_json: { error: result.error, url_id: urlRecord.id } });
        failed++;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error fetching ${urlRecord.url}:`, error);
      failed++;

      await supabase
        .from("program_urls")
        .update({
          status: "failed",
          fetch_error: message,
          locked_at: null,
          locked_by: null,
        })
        .eq("id", urlRecord.id);

      await insertIngestError(supabase, { pipeline: "crawl_pipeline", batch_id, entity_hint: "page", source_url: urlRecord.url, stage: "fetch", reason: "exception", details_json: { error: message, url_id: urlRecord.id } });
    }
  }

  // Update batch status
  await supabase
    .from("crawl_batches")
    .update({ status: "fetching" })
    .eq("id", batch_id);

  return new Response(
    JSON.stringify({
      fetched,
      failed,
      retried,
      needs_render: needsRender,
      ...(body.return_ids ? { locked_url_ids: lockedUrlIds } : {}),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

interface FetchResult {
  success: boolean;
  rawPageId?: number;
  needsRender?: boolean;
  retry?: boolean;
  error?: string;
}

async function fetchAndStoreContent(supabase: any, urlRecord: { id: number; url: string; university_id: string }): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(urlRecord.url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const statusCode = response.status;

    // Handle redirects - update canonical URL
    if (response.redirected) {
      await supabase
        .from("program_urls")
        .update({ canonical_url: response.url.toLowerCase() })
        .eq("id", urlRecord.id);
    }

    // Handle rate limiting
    if (statusCode === 429 || statusCode === 403) {
      return { success: false, retry: true, error: `Rate limited: ${statusCode}` };
    }

    if (!response.ok) {
      return { success: false, retry: false, error: `HTTP ${statusCode}` };
    }

    const contentType = response.headers.get("content-type") || "";
    const html = await response.text();

    // Clean the HTML to extract text
    const textContent = cleanHtmlToText(html);
    const needsRender = textContent.length < 2000 && html.length > 5000; // Likely JS-rendered

    // Calculate hash
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(textContent));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const bodyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Check if we already have this page
    const { data: existing } = await supabase
      .from("raw_pages")
      .select("id, fetch_attempts")
      .eq("url", urlRecord.url)
      .single();

    let rawPageId: number;

    if (existing) {
      // Update existing - using explicit increment (read value already fetched)
      const { data: updated, error: updateError } = await supabase
        .from("raw_pages")
        .update({
          status_code: statusCode,
          content_type: contentType,
          fetched_at: new Date().toISOString(),
          body_sha256: bodyHash,
          text_content: textContent,
          fetch_attempts: (existing.fetch_attempts || 0) + 1,
          fetch_error: null,
          needs_render: needsRender,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) throw updateError;
      rawPageId = updated.id;
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await supabase
        .from("raw_pages")
        .insert({
          url: urlRecord.url,
          university_id: urlRecord.university_id,
          status_code: statusCode,
          content_type: contentType,
          fetched_at: new Date().toISOString(),
          body_sha256: bodyHash,
          text_content: textContent,
          etag: response.headers.get("etag"),
          last_modified: response.headers.get("last-modified"),
          fetch_attempts: 1,
          needs_render: needsRender,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      rawPageId = inserted.id;
    }

    return { success: true, rawPageId, needsRender };
  } catch (error: unknown) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, retry: true, error: "Timeout" };
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, retry: false, error: message };
  }
}

function cleanHtmlToText(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  
  // Remove nav, footer, header (common non-content areas)
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ");
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ");
  text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, " ");
  
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
  
  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();
  
  return text;
}

async function retryFailed(supabase: any, body: FetchRequest) {
  const { batch_id, limit = 20 } = body;

  // Get failed URLs that are due for retry
  const { data: urls, error } = await supabase
    .from("program_urls")
    .select("id, url, university_id")
    .eq("batch_id", batch_id)
    .eq("status", "retry")
    .lte("retry_at", new Date().toISOString())
    .limit(limit);

  if (error) throw new Error(`Failed to fetch retry URLs: ${error.message}`);

  let retried = 0;
  let stillFailed = 0;

  for (const urlRecord of urls || []) {
    const result = await fetchAndStoreContent(supabase, urlRecord);

    if (result.success) {
      await supabase
        .from("program_urls")
        .update({
          status: "fetched",
          raw_page_id: result.rawPageId,
          fetch_error: null,
          retry_at: null,
        })
        .eq("id", urlRecord.id);

      retried++;
    } else {
      // Check if we should give up
      const { data: current } = await supabase
        .from("raw_pages")
        .select("fetch_attempts")
        .eq("url", urlRecord.url)
        .single();

      if (current && current.fetch_attempts >= 3) {
        await supabase
          .from("program_urls")
          .update({
            status: "failed",
            fetch_error: `Max retries exceeded: ${result.error}`,
            retry_at: null,
          })
          .eq("id", urlRecord.id);
      } else {
        // Schedule another retry
        await supabase
          .from("program_urls")
          .update({
            retry_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
            fetch_error: result.error,
          })
          .eq("id", urlRecord.id);
      }

      stillFailed++;
    }
  }

  return new Response(
    JSON.stringify({ retried, still_failed: stillFailed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
