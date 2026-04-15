import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function parseCsv(text: string): { name: string; country: string; city: string }[] {
  const lines = text.trim().split("\n");
  const rows: { name: string; country: string; city: string }[] = [];
  for (const line of lines) {
    const clean = line.replace(/^\uFEFF/, "").replace(/\r/g, "").trim();
    if (!clean || clean.includes("الجامعة")) continue;
    
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of clean) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { parts.push(current.trim()); current = ""; continue; }
      current += char;
    }
    parts.push(current.trim());
    
    if (parts.length >= 3 && parts[0] && parts[2]) {
      rows.push({ name: parts[0], country: parts[1], city: parts[2] });
    }
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "stats";

    if (action === "stats") {
      const { count: totalCount } = await supabase.from("universities").select("id", { count: "exact", head: true }).eq("is_active", true);
      const { count: missingCount } = await supabase.from("universities").select("id", { count: "exact", head: true }).is("city", null).eq("is_active", true);
      const { count: stagingCount } = await supabase.from("city_backfill_csv").select("id", { count: "exact", head: true });
      return json({
        ok: true, total_active: totalCount, missing_city: missingCount,
        has_city: (totalCount || 0) - (missingCount || 0),
        coverage_pct: totalCount ? (((totalCount - (missingCount || 0)) / totalCount) * 100).toFixed(1) : 0,
        staging_rows: stagingCount,
      });
    }

    // Step 1: Load CSV from URL into staging
    if (action === "load_from_url") {
      const csvUrl = body.csv_url as string;
      if (!csvUrl) return json({ ok: false, error: "csv_url required" }, 400);

      console.log(`[city-backfill] Fetching CSV from: ${csvUrl}`);
      const csvRes = await fetch(csvUrl);
      if (!csvRes.ok) return json({ ok: false, error: `Failed to fetch CSV: ${csvRes.status}` }, 400);
      
      const csvText = await csvRes.text();
      const rows = parseCsv(csvText);
      console.log(`[city-backfill] Parsed ${rows.length} CSV rows`);

      // Clear staging
      await supabase.from("city_backfill_csv").delete().gte("id", 0);

      // Insert in batches
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500).map(r => ({
          university_name: r.name, country_name: r.country, city: r.city,
        }));
        const { error } = await supabase.from("city_backfill_csv").insert(batch);
        if (error) {
          console.error(`[city-backfill] Batch ${i} error:`, error.message);
        } else {
          inserted += batch.length;
        }
        if (i % 2000 === 0) console.log(`[city-backfill] Loaded ${inserted}/${rows.length}...`);
      }

      return json({ ok: true, parsed: rows.length, inserted });
    }

    // Step 2: Execute backfill from staging via RPC
    if (action === "execute") {
      const { data: result, error } = await supabase.rpc("rpc_city_backfill_from_staging");
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, ...result });
    }

    // Combined: load + execute
    if (action === "load_and_execute") {
      const csvText = body.csv_data as string;
      if (!csvText) return json({ ok: false, error: "csv_data required" }, 400);

      const rows = parseCsv(csvText);
      await supabase.from("city_backfill_csv").delete().gte("id", 0);
      
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500).map(r => ({
          university_name: r.name, country_name: r.country, city: r.city,
        }));
        const { error } = await supabase.from("city_backfill_csv").insert(batch);
        if (!error) inserted += batch.length;
      }

      const { data: result, error } = await supabase.rpc("rpc_city_backfill_from_staging");
      if (error) return json({ ok: false, error: error.message, staging_inserted: inserted }, 500);
      return json({ ok: true, staging_inserted: inserted, ...result });
    }

    return json({ ok: false, error: "Use: stats, load_from_url, execute, load_and_execute" }, 400);
  } catch (e) {
    console.error("[city-backfill] Error:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
