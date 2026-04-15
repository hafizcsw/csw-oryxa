const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { url, line_start, line_end, search_terms } = await req.json();
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "no key" }), { status: 500, headers: corsHeaders });

  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], waitFor: 5000, onlyMainContent: false }),
      signal: AbortSignal.timeout(60000),
    });
    const body = await r.json();
    if (!r.ok) return new Response(JSON.stringify({ error: body?.error, status: r.status }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const md = body.data?.markdown || "";
    const lines = md.split("\n");

    // Return requested line range
    const start = line_start || 0;
    const end = Math.min(line_end || lines.length, lines.length);
    
    // Search for specific terms and return surrounding context
    const searchResults: any[] = [];
    if (search_terms && Array.isArray(search_terms)) {
      for (const term of search_terms) {
        const regex = new RegExp(term, "gi");
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            searchResults.push({
              term,
              line_num: i,
              context: lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join("\n"),
            });
            if (searchResults.filter(r => r.term === term).length >= 3) break;
          }
        }
      }
    }

    return new Response(JSON.stringify({
      total_lines: lines.length,
      requested_lines: lines.slice(start, end),
      search_results: searchResults,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
