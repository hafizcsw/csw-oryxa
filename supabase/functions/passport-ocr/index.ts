// ═══════════════════════════════════════════════════════════════
// Door 2 — Passport OCR Edge Function
// ═══════════════════════════════════════════════════════════════
// Receives image (base64) or already-rasterized PDF page from the
// browser, sends it to Lovable AI Gateway (Gemini Vision) and asks
// the model to return ONLY the raw MRZ band text (or empty if none).
// The MRZ parsing itself happens client-side in passport-lane.ts.
//
// Architecture decision (Door 2):
//   • OCR/images → THIS edge function (server-side)
//   • PDF text layer → still client-side (free + fast)
//   • Tesseract.js → REMOVED from client
// ═══════════════════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface Body {
  image_base64: string; // raw base64 (no data: prefix)
  mime_type: string;    // e.g. image/jpeg, image/png
  document_id?: string; // for logging only
}

const SYSTEM_PROMPT = `You are an OCR engine specialised in passport / national-ID Machine-Readable Zone (MRZ) extraction.

Rules:
- Return ONLY the raw MRZ text, exactly two lines (TD3) or three lines (TD1) as printed.
- Preserve '<' filler characters exactly.
- If no MRZ band is visible or readable, return the literal string: NO_MRZ
- Do not add explanations, markdown, or any other text.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'lovable_api_key_missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = (await req.json()) as Body;
    if (!body?.image_base64 || !body?.mime_type) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const t0 = Date.now();
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the MRZ band only.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${body.mime_type};base64,${body.image_base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[passport-ocr] gateway error', aiRes.status, errText);
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'ai_gateway_failed',
          http_status: aiRes.status,
          details: errText.slice(0, 500),
        }),
        {
          status: aiRes.status === 429 ? 429 : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const data = await aiRes.json();
    const raw: string =
      data?.choices?.[0]?.message?.content?.toString()?.trim() ?? '';

    const mrz_text = raw === 'NO_MRZ' || raw.length < 20 ? '' : raw;
    const elapsed = Date.now() - t0;

    console.log('[passport-ocr] ok', {
      document_id: body.document_id,
      mrz_chars: mrz_text.length,
      elapsed_ms: elapsed,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        mrz_text,
        engine: 'lovable-ai/gemini-2.5-flash',
        elapsed_ms: elapsed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('[passport-ocr] threw', e);
    return new Response(
      JSON.stringify({ ok: false, error: 'unhandled', details: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
