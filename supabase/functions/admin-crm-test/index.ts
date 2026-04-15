const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, token } = await req.json();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'Idempotency-Key': 'test-' + Date.now()
      },
      body: JSON.stringify({ ping: 'crm_test', timestamp: new Date().toISOString() })
    }).catch(e => ({
      ok: false,
      status: 0,
      text: () => Promise.resolve(String(e))
    } as any));

    const body = await (response.text?.() ?? Promise.resolve(''));

    return new Response(
      JSON.stringify({
        ok: response.ok,
        status: response.status ?? 0,
        body: body?.slice?.(0, 200) ?? ''
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
