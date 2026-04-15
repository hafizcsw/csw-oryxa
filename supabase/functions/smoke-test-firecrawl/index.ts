/**
 * smoke-test-firecrawl: Direct Firecrawl scrape test — tries both keys
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: corsHeaders });

    // Raw fetch for HTML length
    let rawHtmlLen = 0;
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) rawHtmlLen = (await r.text()).length;
    } catch { /* ignore */ }

    // Try both keys
    const keys: [string, string | undefined][] = [
      ["FIRECRAWL_API_KEY", Deno.env.get("FIRECRAWL_API_KEY")],
      ["FIRECRAWL_API_KEY_1", Deno.env.get("FIRECRAWL_API_KEY_1")],
    ];
    const keyResults: any[] = [];

    for (const [name, k] of keys) {
      if (!k) { keyResults.push({ key: name, status: "not_set" }); continue; }
      try {
        const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url, formats: ["markdown"], waitFor: 5000, onlyMainContent: false }),
          signal: AbortSignal.timeout(60000),
        });
        const body = await r.json();
        if (r.ok) {
          const md = body.data?.markdown || "";
          const lines = md.split("\n");
          return new Response(JSON.stringify({
            fetch_method: "firecrawl",
            key_used: name,
            has_markdown: md.length > 500,
            raw_markdown_length: md.length,
            raw_html_length: rawHtmlLen,
            first_30_lines: lines.slice(0, 30),
            total_lines: lines.length,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        keyResults.push({ key: name, status: r.status, error: (body?.error || "").slice(0, 200) });
      } catch (e: any) {
        keyResults.push({ key: name, status: "exception", error: e?.message });
      }
    }

    return new Response(JSON.stringify({
      fetch_method: "all_keys_failed",
      key_results: keyResults,
      raw_html_length: rawHtmlLen,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
