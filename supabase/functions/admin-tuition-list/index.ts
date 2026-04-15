import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const { country_code, degree_level = "pg", audience = "international", limit = 100 } = await req.json();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch universities with their country info
    let query = supabase
      .from("universities")
      .select("id, name, city")
      .limit(limit);

    const { data: universities, error: uniError } = await query;
    if (uniError) throw uniError;

    // For each university, get latest official snapshot and calculate secondary sources median
    const results = await Promise.all(
      (universities || []).map(async (uni: any) => {
        // Latest official snapshot
        const { data: official } = await supabase
          .from("tuition_snapshots")
          .select("*")
          .eq("university_id", uni.id)
          .eq("degree_level", degree_level)
          .eq("audience", audience)
          .eq("is_official", true)
          .order("captured_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Secondary sources (last 30 days)
        const { data: auxSnapshots } = await supabase
          .from("tuition_snapshots")
          .select("amount")
          .eq("university_id", uni.id)
          .eq("degree_level", degree_level)
          .eq("audience", audience)
          .eq("is_official", false)
          .gte("captured_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        // Calculate median
        let auxMedian = null;
        if (auxSnapshots && auxSnapshots.length > 0) {
          const amounts = auxSnapshots.map((s: any) => Number(s.amount)).sort((a: number, b: number) => a - b);
          const mid = Math.floor(amounts.length / 2);
          auxMedian = amounts.length % 2 === 0 
            ? (amounts[mid - 1] + amounts[mid]) / 2 
            : amounts[mid];
        }

        // Calculate difference
        let diffPercent = null;
        if (official?.amount && auxMedian) {
          diffPercent = ((auxMedian - Number(official.amount)) / Number(official.amount)) * 100;
        }

        return {
          ...uni,
          official_amount: official?.amount,
          currency: official?.currency,
          academic_year: official?.academic_year,
          source_url: official?.source_url,
          aux_median: auxMedian,
          diff_percent: diffPercent
        };
      })
    );

    return new Response(
      JSON.stringify({ ok: true, universities: results }),
      {
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[admin-tuition-list] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" }
      }
    );
  }
});
