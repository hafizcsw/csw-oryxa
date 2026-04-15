const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const key1 = Deno.env.get("FIRECRAWL_API_KEY");
  const key2 = Deno.env.get("FIRECRAWL_API_KEY_1");

  const fingerprint = (k: string | undefined) => {
    if (!k) return "NOT_SET";
    return `${k.slice(0, 6)}...${k.slice(-4)} (len=${k.length})`;
  };

  const testKey = async (name: string, k: string) => {
    try {
      const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${k}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://example.com",
          formats: ["markdown"],
        }),
        signal: AbortSignal.timeout(30000),
      });
      const body = await r.json();
      return {
        key_name: name,
        fingerprint: fingerprint(k),
        http_status: r.status,
        success: r.ok,
        error: body?.error || null,
        markdown_length: body?.data?.markdown?.length || 0,
      };
    } catch (e: any) {
      return {
        key_name: name,
        fingerprint: fingerprint(k),
        http_status: "exception",
        success: false,
        error: e?.message,
      };
    }
  };

  const results: any[] = [];

  if (key1) results.push(await testKey("FIRECRAWL_API_KEY", key1));
  else results.push({ key_name: "FIRECRAWL_API_KEY", fingerprint: "NOT_SET" });

  if (key2) results.push(await testKey("FIRECRAWL_API_KEY_1", key2));
  else results.push({ key_name: "FIRECRAWL_API_KEY_1", fingerprint: "NOT_SET" });

  return new Response(JSON.stringify({ diag: results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
