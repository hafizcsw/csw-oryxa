// supabase/functions/bridge-emit/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canonicalV1, hmacSha256Hex, timingSafeEqual } from "../_shared/bridge_hmac_v1.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hmac-signature, x-hmac-timestamp, x-hmac-nonce, x-hmac-version, x-forwarded-uri",
};

function json(status: number, obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePath(p: string) {
  // remove trailing slashes
  return (p || "").replace(/\/+$/, "") || "/";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const rawBody = await req.text();

  const sig = (req.headers.get("x-hmac-signature") ?? "").trim();
  const ts  = (req.headers.get("x-hmac-timestamp") ?? "").trim();
  const nonce = (req.headers.get("x-hmac-nonce") ?? "").trim();

  // 🔍 PROBE LOG
  console.log("BRIDGE_EMIT_HIT", {
    url: req.url,
    has_sig: !!sig,
    has_ts: !!ts,
    has_nonce: !!nonce,
  });

  if (!sig || !ts || !nonce) {
    console.error("❌ Missing HMAC headers", { sig: !!sig, ts: !!ts, nonce: !!nonce });
    return json(401, { ok: false, error: "missing_hmac_headers" });
  }

  const secret = Deno.env.get("HMAC_SHARED_SECRET");
  if (!secret) {
    console.error("❌ HMAC_SHARED_SECRET not configured");
    return json(500, { ok: false, error: "hmac_not_configured" });
  }

  // Timestamp: unix seconds only
  if (ts.includes("T") || ts.includes("-")) {
    console.error("❌ Timestamp is ISO format", { ts });
    return json(401, { ok: false, error: "timestamp_iso_not_allowed" });
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) {
    console.error("❌ Invalid timestamp", { ts });
    return json(401, { ok: false, error: "timestamp_invalid" });
  }
  if (tsNum > 9999999999) {
    console.error("❌ Timestamp is milliseconds", { ts });
    return json(401, { ok: false, error: "timestamp_ms_not_allowed" });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > 300) {
    console.error("❌ Timestamp expired", { ts: tsNum, now: nowSec, diff: Math.abs(nowSec - tsNum) });
    return json(401, { ok: false, error: "timestamp_expired" });
  }

  const url = new URL(req.url);
  const fwd = (req.headers.get("x-forwarded-uri") ?? "").trim();

  // pathname + search من x-forwarded-uri لو موجود
  const fwdPath = fwd ? fwd.split("?")[0] : "";
  const fwdSearch = fwd && fwd.includes("?") ? "?" + fwd.split("?").slice(1).join("?") : "";

  const pathname = (fwdPath || url.pathname).replace(/\/+$/, "");
  const search = (fwd ? fwdSearch : (url.search || ""));

  // ✅ Canonical v1: 7 lines, NO prefixes
  const canonical = canonicalV1({
    ts,
    nonce,
    method: req.method,
    pathname,
    search,
    bodyRaw: rawBody ?? ""
  });

  const expected = await hmacSha256Hex(secret, canonical);

  // Safe debug log (no signature leak)
  console.log("🔐 Verifying HMAC", {
    receivedSig: sig.substring(0, 8) + "...",
    method: req.method,
    pathname,
    search: search || "(empty)",
    bodyLen: rawBody?.length ?? 0
  });

  if (!timingSafeEqual(sig.toLowerCase(), expected.toLowerCase())) {
    console.error("❌ Invalid signature");
    return json(401, { ok: false, error: "invalid_signature" });
  }

  console.log("✅ HMAC verified");

  // Service role client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Nonce de-dup (FAIL CLOSED)
  const { error: nonceErr } = await supabase.from("hmac_nonces").insert({ nonce });
  if (nonceErr) {
    // duplicate
    if ((nonceErr as any).code === "23505") {
      console.error("❌ Nonce replay blocked", { nonce: nonce.substring(0, 8) + "..." });
      return json(401, { ok: false, error: "nonce_replay" });
    }
    console.error("❌ Nonce store failed", { error: nonceErr });
    return json(503, { ok: false, error: "nonce_store_failed" });
  }

  console.log("✅ Nonce accepted", { nonce: nonce.substring(0, 8) + "..." });

  // Parse body AFTER auth
  let body: any = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    console.error("❌ Invalid JSON");
    return json(400, { ok: false, error: "invalid_json" });
  }

  const eventName = body.event_name ?? body.eventName;
  const payload = body.payload ?? body.data;
  if (!eventName || !payload) {
    console.error("❌ Missing event_name or payload");
    return json(400, { ok: false, error: "event_name_and_payload_required" });
  }

  console.log("📦 Processing event", { eventName });

  // Apply
  if (eventName === "service_selection_updated") {
    const {
      auth_user_id,
      country_code,
      state_rev,
      selected_services,
      selected_addons,
      selected_package_id,
      pay_plan,
      pricing_snapshot,
      pricing_version,
      source,
      status,
    } = payload;

    if (!auth_user_id || !country_code) {
      console.error("❌ Missing auth_user_id or country_code");
      return json(400, { ok: false, error: "missing_auth_user_or_country" });
    }
    if (state_rev === undefined || state_rev === null) {
      console.error("❌ Missing state_rev");
      return json(400, { ok: false, error: "state_rev_required" });
    }

    const { data, error } = await supabase.rpc("mirror_service_selection", {
      p_auth_user_id: auth_user_id,
      p_country_code: country_code,
      p_selected_services: selected_services ?? [],
      p_selected_addons: selected_addons ?? [],
      p_selected_package_id: selected_package_id ?? null,
      p_pay_plan: pay_plan ?? "full",
      p_pricing_snapshot: pricing_snapshot ?? {},
      p_pricing_version: pricing_version ?? "v1",
      p_source: source ?? "crm",
      p_state_rev: state_rev, // bigint in SQL will accept numeric
      p_status: status ?? "active",
    });

    if (error) {
      console.error("❌ mirror_service_selection failed", { error });
      return json(500, { ok: false, error: "mirror_rpc_failed" });
    }

    console.log("✅ mirror_service_selection applied", { auth_user_id, country_code, state_rev, result: data });
    return json(200, data ?? { ok: true });
  }

  if (eventName === "service_selection_deleted") {
    const { auth_user_id, country_code, state_rev } = payload;

    if (!auth_user_id || !country_code) {
      console.error("❌ Missing auth_user_id or country_code");
      return json(400, { ok: false, error: "missing_auth_user_or_country" });
    }
    if (state_rev === undefined || state_rev === null) {
      console.error("❌ Missing state_rev for delete");
      return json(400, { ok: false, error: "delete_state_rev_required" });
    }

    const { data, error } = await supabase.rpc("delete_service_selection", {
      p_auth_user_id: auth_user_id,
      p_country_code: country_code,
      p_state_rev: state_rev,
    });

    if (error) {
      console.error("❌ delete_service_selection failed", { error });
      return json(500, { ok: false, error: "delete_rpc_failed" });
    }

    console.log("✅ delete_service_selection applied", { auth_user_id, country_code, state_rev, result: data });
    return json(200, data ?? { ok: true });
  }

  console.log("⚠️ Unknown event ignored", { eventName });
  return json(200, { ok: true, ignored: true, eventName });
});
