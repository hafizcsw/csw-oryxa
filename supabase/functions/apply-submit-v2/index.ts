import { createClient } from "npm:@supabase/supabase-js@2";

type AppBody = {
  student_name: string;
  email: string;
  phone?: string | null;
  program_id?: string | null;
  privacy_consent: boolean;
  whatsapp_opt_in: boolean;
  extras?: {
    status?: string | null;
    country_id?: string | number | null;
    source?: string | null;
    session_id?: string | null;
    utm?: Record<string, unknown> | null;
  };
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

async function checkRateLimit(ip: string, endpoint: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

  const { data } = await supabase
    .from("rate_limits")
    .select("requests_count, window_start")
    .eq("domain", ip)
    .eq("endpoint", endpoint)
    .single();

  if (data) {
    const dataWindowStart = new Date(data.window_start);
    if (dataWindowStart > windowStart && data.requests_count >= RATE_LIMIT_MAX) {
      return false; // rate limited
    }
    if (dataWindowStart <= windowStart) {
      // Reset window
      await supabase
        .from("rate_limits")
        .update({ requests_count: 1, window_start: now.toISOString(), last_request_at: now.toISOString() })
        .eq("domain", ip)
        .eq("endpoint", endpoint);
    } else {
      await supabase
        .from("rate_limits")
        .update({ requests_count: data.requests_count + 1, last_request_at: now.toISOString() })
        .eq("domain", ip)
        .eq("endpoint", endpoint);
    }
  } else {
    await supabase.from("rate_limits").insert({
      domain: ip,
      endpoint,
      requests_count: 1,
      window_start: now.toISOString(),
      last_request_at: now.toISOString(),
    });
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Rate limiting by IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const allowed = await checkRateLimit(clientIp, "apply-submit-v2");
  if (!allowed) {
    return json({ ok: false, error: "too_many_requests" }, 429);
  }

  const idemHeader = req.headers.get("Idempotency-Key") ?? null;

  try {
    const body = (await req.json()) as AppBody;

    // Validate required fields
    const student_name = String(body?.student_name || "").trim().slice(0, 200);
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 255);
    const phone = body?.phone ? String(body.phone).trim().slice(0, 30) : null;
    const program_id = (body?.program_id ?? null) as string | null;
    const privacy_consent = !!body?.privacy_consent;
    const whatsapp_opt_in = !!body?.whatsapp_opt_in;

    if (!student_name || !email || privacy_consent !== true) {
      return json({ ok: false, error: "invalid_payload" }, 400);
    }

    // Validate email format
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email)) {
      return json({ ok: false, error: "invalid_email" }, 400);
    }

    // Validate phone format if provided
    if (phone && !/^\+?[\d\s\-()]{6,25}$/.test(phone)) {
      return json({ ok: false, error: "invalid_phone" }, 400);
    }

    // Validate program_id UUID format if provided
    if (program_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(program_id)) {
      return json({ ok: false, error: "invalid_program_id" }, 400);
    }

    // Deduplication: same (email+program) within 60 minutes
    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let dupQuery = supabase
      .from("applications")
      .select("id,created_at")
      .gte("created_at", sinceIso)
      .eq("email", email);

    if (program_id && program_id !== "") {
      dupQuery = dupQuery.eq("program_id", program_id);
    } else {
      dupQuery = dupQuery.is("program_id", null);
    }

    const { data: dup } = await dupQuery.limit(1);

    if (dup && dup.length > 0) {
      console.log(`[apply-submit-v2] Dedup hit: ${email}, app_id: ${dup[0].id}`);
      return json({
        ok: true,
        id: dup[0].id,
        deduped: true,
        since: dup[0].created_at,
      });
    }

    // Prepare payload
    const payload: Record<string, unknown> = {
      student_name,
      email,
      phone,
      program_id,
      privacy_consent,
      whatsapp_opt_in,
      status: body?.extras?.status ?? "new",
      country_id: body?.extras?.country_id ?? null,
      source: body?.extras?.source ?? "website",
      session_id: body?.extras?.session_id ?? null,
      utm: body?.extras?.utm ?? null,
    };

    // Insert application
    const { data: app, error } = await supabase
      .from("applications")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[apply-submit-v2] Insert error:", error);
      throw error;
    }

    console.log(`[apply-submit-v2] Created application: ${app.id}`);

    // Queue for CRM if enabled (LAV #17)
    const { data: crmFlag } = await supabase
      .from("feature_flags")
      .select("value")
      .eq("key", "crm_enabled")
      .maybeSingle();
    
    if (crmFlag?.value?.enabled === true) {
      const idemKey = idemHeader || `${new Date().toISOString().slice(0, 13)}:00::${email}::${program_id || ""}`;
      
      await supabase.from("integration_outbox").insert({
        target: "crm",
        event_type: "application.created",
        idempotency_key: idemKey,
        payload: { application: app },
        status: "pending",
        next_attempt_at: new Date().toISOString()
      });
      
      console.log(`[apply-submit-v2] Queued for CRM: ${app.id}`);
    }

    return json({ ok: true, id: app.id, deduped: false });
  } catch (e) {
    console.error("[apply-submit-v2] Error:", e);
    return json({ ok: false, error: "submission_failed" }, 400);
  }
});
