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

    const { country_code, entity_type = "country" } = await req.json();

    if (!country_code) {
      throw new Error("country_code is required");
    }

    console.log(`[data-quality-scan] Scanning ${entity_type}: ${country_code}`);

    // Call DB function to calculate score
    const { data: score, error: scoreError } = await supabase.rpc(
      "calculate_country_quality_score",
      { p_country_code: country_code }
    );

    if (scoreError) throw scoreError;

    // Get detailed metrics
    const { data: metrics, error: metricsError } = await supabase
      .from("data_quality_rules")
      .select("*")
      .eq("enabled", true);

    if (metricsError) throw metricsError;

    const rules_passed = metrics?.filter((r: any) => score >= r.threshold).length || 0;
    const rules_failed = (metrics?.length || 0) - rules_passed;

    // Insert snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from("data_quality_snapshots")
      .insert({
        entity_type,
        entity_id: country_code,
        score: score || 0,
        metrics: { rules: metrics, details: { country_code } },
        rules_passed,
        rules_failed,
      })
      .select()
      .single();

    if (snapshotError) throw snapshotError;

    // Create alert if score is critical
    if (score < 60) {
      await supabase.from("system_alerts").insert({
        level: "critical",
        source: "data_quality",
        message: `Quality score for ${country_code} dropped to ${score}`,
        meta: { country_code, score, snapshot_id: snapshot.id },
      });
    }

    console.log(`[data-quality-scan] ${country_code} score: ${score}`);

    return new Response(
      JSON.stringify({
        ok: true,
        score,
        snapshot,
        rules_passed,
        rules_failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[data-quality-scan] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
