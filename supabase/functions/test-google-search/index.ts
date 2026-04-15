const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
  const cx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');

  if (!apiKey || !cx) {
    return new Response(JSON.stringify({
      error: 'Missing config',
      hasApiKey: !!apiKey,
      hasCx: !!cx,
      apiKeyLen: apiKey?.length,
      cxLen: cx?.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { query } = await req.json();
  const searchQuery = query || 'Aarhus University official website';

  const params = new URLSearchParams({ key: apiKey, cx, q: searchQuery, num: '5' });
  const url = `https://www.googleapis.com/customsearch/v1?${params}`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();

    return new Response(JSON.stringify({
      status: resp.status,
      ok: resp.ok,
      query: searchQuery,
      totalResults: data.searchInformation?.totalResults,
      items: (data.items || []).slice(0, 5).map((i: any) => ({
        title: i.title,
        link: i.link,
        snippet: i.snippet?.slice(0, 100),
      })),
      error: data.error,
    }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
