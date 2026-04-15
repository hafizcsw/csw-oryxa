import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Whitelist of allowed workers - strict security
const ALLOWED_WORKERS = ['notarized', 'catalog'] as const;
type WorkerType = typeof ALLOWED_WORKERS[number];

// Simple in-memory rate limiting (per function instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // max calls per window
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

function checkRateLimit(adminId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(adminId);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(adminId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // POST-only enforcement
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed", message: "Only POST requests are allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const requestId = crypto.randomUUID();
  const requestedAt = new Date().toISOString();

  try {
    // Verify admin JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error("[admin-trigger-worker] Auth error:", authError);
      return new Response(
        JSON.stringify({ ok: false, error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin status
    const srv = createClient(SUPABASE_URL, SRV_KEY);
    const { data: isAdmin } = await srv.rpc("is_admin", { _user_id: user.id });
    
    if (!isAdmin) {
      console.warn(`[admin-trigger-worker] Non-admin attempt: ${user.id}`);
      return new Response(
        JSON.stringify({ ok: false, error: "forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting check
    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      console.warn(`[admin-trigger-worker] Rate limit exceeded for admin: ${user.id}`);
      
      // Log rate limit event
      await srv.from('admin_audit').insert({
        admin_id: user.id,
        action: 'trigger_worker_rate_limited',
        table_name: 'admin-trigger-worker',
        row_key: requestId,
        diff: { request_id: requestId, requested_at: requestedAt }
      });

      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "rate_limit_exceeded", 
          message: "Too many requests. Please wait before trying again.",
          retry_after_seconds: 60
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body = await req.json().catch(() => ({})) as { worker?: string; limit?: number };
    const workerType = (body.worker || 'notarized') as string;
    const limit = Math.min(Math.max(body.limit || 10, 1), 50); // Clamp 1-50

    // Strict whitelist validation
    if (!ALLOWED_WORKERS.includes(workerType as WorkerType)) {
      console.warn(`[admin-trigger-worker] Invalid worker type attempted: ${workerType} by ${user.id}`);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "invalid_worker", 
          message: `Worker must be one of: ${ALLOWED_WORKERS.join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-trigger-worker] ✅ Admin ${user.id} triggering ${workerType}-worker (limit: ${limit})...`);

    // Get worker secret
    const WORKER_SECRET = Deno.env.get("TRANSLATION_WORKER_SECRET");
    if (!WORKER_SECRET) {
      return new Response(
        JSON.stringify({ ok: false, error: "TRANSLATION_WORKER_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which worker to call
    const workerName = workerType === 'catalog' ? 'translation-worker' : 'notarized-worker-mock';
    const workerUrl = `${SUPABASE_URL}/functions/v1/${workerName}`;
    
    const workerResponse = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SECRET,
      },
      body: JSON.stringify({ limit }),
    });

    const workerResult = await workerResponse.json();
    
    console.log(`[admin-trigger-worker] Worker response:`, workerResult);

    // Audit log - record successful trigger
    await srv.from('admin_audit').insert({
      admin_id: user.id,
      action: 'trigger_worker',
      table_name: workerName,
      row_key: requestId,
      diff: {
        request_id: requestId,
        requested_at: requestedAt,
        worker_type: workerType,
        limit: limit,
        worker_response_ok: workerResult.ok ?? null,
        processed_count: workerResult.processed ?? 0,
        rate_limit_remaining: rateCheck.remaining
      }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        request_id: requestId,
        triggered_by: user.id,
        worker: workerType,
        limit: limit,
        worker_result: workerResult,
        rate_limit_remaining: rateCheck.remaining
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[admin-trigger-worker] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error), request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
