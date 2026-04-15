// LAV #15: Admin Update Payment Status
// Admin-only endpoint to update payment status with proper CORS and logging

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflight, generateTraceId, slog } from "../_shared/cors.ts";

interface UpdatePaymentRequest {
  application_id: string;
  payment_status: "none" | "pending" | "partial" | "full";
  note?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const tid = generateTraceId();
  const t0 = performance.now();

  // Handle CORS preflight
  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) {
    slog({ tid, kind: "preflight", origin });
    return preflightResponse;
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Parse request
    const body: UpdatePaymentRequest = await req.json();
    const { application_id, payment_status, note } = body;

    if (!application_id || !payment_status) {
      throw new Error("Missing required fields: application_id, payment_status");
    }

    // Call RPC to update payment status
    const { error } = await supabase.rpc("admin_update_payment_status", {
      p_application_id: application_id,
      p_payment_status: payment_status,
      p_note: note || null,
    });

    if (error) {
      throw error;
    }

    const response = {
      ok: true,
      tid,
      application_id,
      payment_status,
    };

    slog({
      tid,
      path: "/admin-update-payment",
      method: "POST",
      status: 200,
      dur_ms: Math.round(performance.now() - t0),
      application_id,
      payment_status,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(origin),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    slog({
      tid,
      level: "error",
      path: "/admin-update-payment",
      error: errorMessage,
      dur_ms: Math.round(performance.now() - t0),
    });

    return new Response(
      JSON.stringify({
        ok: false,
        tid,
        error: errorMessage,
      }),
      {
        status: error instanceof Error && error.message.includes("authorization") ? 401 : 500,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(origin),
        },
      }
    );
  }
});
