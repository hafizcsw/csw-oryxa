import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = auth.srv;

    // Fetch all universities without city in batches
    const allRows: any[] = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("universities")
        .select("id, name, name_en, name_ar, country_code")
        .or("city.is.null,city.eq.,city.eq.NaN")
        .not("name_en", "is", null)
        .order("country_code", { ascending: true, nullsFirst: false })
        .order("name_en", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows.push(...data);
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    // Build CSV
    const header = "#,name_en,name_ar,country_code,city";
    const csvRows = allRows.map((r, i) => {
      const escape = (v: string | null) => {
        if (!v) return "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
      };
      return [i + 1, escape(r.name_en), escape(r.name_ar), r.country_code || "", ""].join(",");
    });

    const csv = [header, ...csvRows].join("\n");

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="universities_no_city_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    console.error("Export error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
