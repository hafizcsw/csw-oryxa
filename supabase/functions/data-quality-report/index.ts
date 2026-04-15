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

    const url = new URL(req.url);
    const entity_type = url.searchParams.get("entity_type") || "country";
    const entity_id = url.searchParams.get("entity_id");
    const days = parseInt(url.searchParams.get("days") || "30");

    // Get latest snapshot
    let query = supabase
      .from("data_quality_snapshots")
      .select("*")
      .eq("entity_type", entity_type)
      .order("created_at", { ascending: false })
      .limit(1);

    if (entity_id) {
      query = query.eq("entity_id", entity_id);
    }

    const { data: latest, error: latestError } = await query.single();
    if (latestError && latestError.code !== "PGRST116") throw latestError;

    // Get historical snapshots (time series)
    let historyQuery = supabase
      .from("data_quality_snapshots")
      .select("*")
      .eq("entity_type", entity_type)
      .gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: true });

    if (entity_id) {
      historyQuery = historyQuery.eq("entity_id", entity_id);
    }

    const { data: history, error: historyError } = await historyQuery;
    if (historyError) throw historyError;

    // Get all rules
    const { data: rules, error: rulesError } = await supabase
      .from("data_quality_rules")
      .select("*")
      .eq("enabled", true);

    if (rulesError) throw rulesError;

    const report = {
      latest_snapshot: latest,
      history: history || [],
      rules,
      summary: {
        current_score: latest?.score || 0,
        trend: history && history.length > 1
          ? latest?.score - history[0].score
          : 0,
        snapshots_count: history?.length || 0,
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[data-quality-report] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
