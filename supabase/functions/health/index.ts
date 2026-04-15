// LAV #15: Health Endpoint for Monitoring
// Returns overall system health status

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Max-Age": "86400",
};

interface HealthCheck {
  overall_ok: boolean;
  ts: string;
  checks: {
    database: boolean;
    secrets: boolean;
  };
  version: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    const checks = {
      database: false,
      secrets: false,
    };

    // Check 1: Database connectivity
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      const { error } = await supabase
        .from("settings")
        .select("id")
        .limit(1)
        .single();
      
      checks.database = !error;
    } catch (e) {
      console.error("[health] DB check failed:", e);
    }

    // Check 2: Critical secrets exist
    checks.secrets = !!(
      Deno.env.get("SUPABASE_URL") &&
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const overall_ok = checks.database && checks.secrets;

    const health: HealthCheck = {
      overall_ok,
      ts: new Date().toISOString(),
      checks,
      version: "lav-15",
    };

    return new Response(JSON.stringify(health), {
      status: overall_ok ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("[health] Unexpected error:", error);
    
    return new Response(
      JSON.stringify({
        overall_ok: false,
        ts: new Date().toISOString(),
        error: String(error),
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
