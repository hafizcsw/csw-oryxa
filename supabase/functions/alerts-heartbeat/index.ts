import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get system health via function
    const { data: health, error: healthError } = await supabase.rpc("get_system_health_v2");
    if (healthError) throw healthError;

    // Get recent unacknowledged alerts
    const { data: alerts, error: alertsError } = await supabase
      .from("system_alerts")
      .select("*")
      .eq("acknowledged", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (alertsError) throw alertsError;

    // Check for critical issues and create alerts if needed
    const criticalIssues: string[] = [];
    
    if (health.harvest?.failed_jobs > 5) {
      criticalIssues.push(`High harvest failures: ${health.harvest.failed_jobs}`);
    }
    
    if (health.outbox?.errors > 10) {
      criticalIssues.push(`High outbox errors: ${health.outbox.errors}`);
    }
    
    if (health.alerts?.critical > 0) {
      criticalIssues.push(`${health.alerts.critical} critical alerts unacknowledged`);
    }

    // Insert new critical alerts if any
    for (const issue of criticalIssues) {
      await supabase.from("system_alerts").insert({
        level: "critical",
        source: "heartbeat",
        message: issue,
        meta: { health },
      });
    }

    const result = {
      health,
      alerts,
      critical_issues: criticalIssues,
      status: criticalIssues.length > 0 ? "warning" : "healthy",
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[alerts-heartbeat] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
