import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function requestSpeech(options: {
  text: string;
  speed: number;
  apiKey: string;
  model: "gpt-4o-mini-tts" | "tts-1";
}) {
  const payload = options.model === "gpt-4o-mini-tts"
    ? {
        model: "gpt-4o-mini-tts",
        input: options.text,
        voice: "nova",
        speed: options.speed,
        response_format: "mp3",
        instructions:
          "Read the input naturally in its original language. For Russian Cyrillic text, use clear standard Russian pronunciation with correct lexical stress. Honor stress marks such as ё and combining acute accents. If the input is a single Cyrillic letter, pronounce the Russian letter name. If multiple Russian words are separated by punctuation, speak each one clearly with a short teacher-like pause.",
      }
    : {
        model: "tts-1",
        input: options.text,
        voice: "nova",
        speed: options.speed,
        response_format: "mp3",
      };

  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const rawSpeed = typeof body?.speed === "number" ? body.speed : Number(body?.speed);
    const speed = Number.isFinite(rawSpeed) ? Math.min(Math.max(rawSpeed, 0.7), 1.2) : 0.9;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let response = await requestSpeech({
      text,
      speed,
      apiKey: OPENAI_API_KEY,
      model: "gpt-4o-mini-tts",
    });

    if (!response.ok) {
      const primaryError = await response.text();
      console.error("gpt-4o-mini-tts error:", primaryError);

      response = await requestSpeech({
        text,
        speed,
        apiKey: OPENAI_API_KEY,
        model: "tts-1",
      });

      if (!response.ok) {
        const fallbackError = await response.text();
        console.error("tts-1 fallback error:", fallbackError);
        return new Response(JSON.stringify({ error: "TTS failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);

    return new Response(JSON.stringify({ audio: base64Audio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
