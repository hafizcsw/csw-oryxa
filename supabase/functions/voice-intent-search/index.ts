// LAV #15.E2: Voice Bot - STT → Intent → Search → TTS
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight, generateTraceId, slog } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Check if voice bot is enabled
async function isVoiceBotEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('key', 'feature.voice_bot_enabled')
    .single();
  
  return data?.enabled === true;
}

// STT adapter (stub - integrate with your STT provider)
async function doSTT(audioUrl: string): Promise<string> {
  // TODO: Fetch audio from URL and call STT provider
  // For now, return mock text for testing
  slog({ evt: 'stt_stub', audioUrl });
  return 'find universities in russia fees 4000 living 500';
}

// TTS adapter (stub - integrate with your TTS provider)
async function doTTS(text: string): Promise<Uint8Array> {
  // TODO: Call TTS provider and return audio bytes
  slog({ evt: 'tts_stub', text });
  return new TextEncoder().encode('AUDIO_PLACEHOLDER');
}

// Simple intent parser (regex-based, no LLM)
function parseIntent(text: string): {
  country?: string;
  fees_max?: number;
  living_max?: number;
  q_name?: string;
} {
  const intent: any = {};

  // Country detection
  const countryPatterns = [
    { pattern: /russia|روسيا/i, slug: 'russia' },
    { pattern: /turkey|تركيا/i, slug: 'turkey' },
    { pattern: /germany|ألمانيا/i, slug: 'germany' },
    { pattern: /canada|كندا/i, slug: 'canada' },
    { pattern: /uk|britain|بريطانيا/i, slug: 'uk' },
  ];

  for (const { pattern, slug } of countryPatterns) {
    if (pattern.test(text)) {
      intent.country_slug = slug;
      break;
    }
  }

  // Fees extraction
  const feesMatch = text.match(/fees?\s+(\d{3,5})/i);
  if (feesMatch) intent.fees_max = Number(feesMatch[1]);

  // Living cost extraction
  const livingMatch = text.match(/living\s+(\d{2,4})/i);
  if (livingMatch) intent.living_max = Number(livingMatch[1]);

  // University name search
  const nameMatch = text.match(/university\s+(\w+)/i);
  if (nameMatch) intent.q_name = nameMatch[1];

  return intent;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const tid = generateTraceId();
  const t0 = performance.now();

  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) {
    slog({ tid, kind: 'preflight', origin });
    return preflightResponse;
  }

  try {
    // Check feature flag
    const enabled = await isVoiceBotEnabled();
    if (!enabled) {
      return new Response(
        JSON.stringify({ ok: false, tid, error: 'Voice bot is disabled' }),
        {
          status: 403,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      );
    }

    const { audio_url, text_override } = await req.json();

    // Get text from STT or use override for testing
    const text = text_override || (audio_url ? await doSTT(audio_url) : null);
    
    if (!text) {
      throw new Error('No audio_url or text_override provided');
    }

    slog({ tid, evt: 'voice_text', text });

    // Parse intent
    const intent = parseIntent(text);
    slog({ tid, evt: 'intent_parsed', intent });

    // Build search payload
    const searchPayload = {
      sort: 'rank_asc',
      limit: 5,
      ...intent
    };

    // Call search-universities internally
    const searchUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/search-universities`;
    const searchRes = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(searchPayload)
    });

    const searchData = await searchRes.json();

    // Format response text
    let textReply: string;
    if (searchData.count > 0) {
      const lines = searchData.items
        .map((u: any, i: number) => 
          `${i + 1}) ${u.name} — Fees: ${u.annual_fees || 'N/A'}, Living: ${u.monthly_living || 'N/A'}`
        )
        .join('\n');
      textReply = `Found ${searchData.count} universities:\n${lines}`;
    } else {
      textReply = 'No universities matched your request. Try adjusting your criteria.';
    }

    slog({
      tid,
      evt: 'voice_search_complete',
      results_count: searchData.count,
      dur_ms: Math.round(performance.now() - t0)
    });

    // Optional: TTS (disabled by default for performance)
    // const audioBytes = await doTTS(textReply);
    // const audio_b64 = btoa(String.fromCharCode(...audioBytes));

    return new Response(
      JSON.stringify({
        ok: true,
        tid,
        text: textReply,
        results: searchData.items,
        count: searchData.count
        // audio_b64 // Uncomment if TTS is needed
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    );
  } catch (e: any) {
    slog({
      tid,
      level: 'error',
      error: String(e),
      dur_ms: Math.round(performance.now() - t0)
    });

    return new Response(
      JSON.stringify({ ok: false, tid, error: String(e) }),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    );
  }
});
