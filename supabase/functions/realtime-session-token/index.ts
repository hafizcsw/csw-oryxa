// Edge function: realtime-session-token
// Issues an ephemeral OpenAI Realtime API token for browser WebRTC sessions.
// No data is persisted. Direct OpenAI API call (NOT via Lovable AI Gateway).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REALTIME_MODEL = "gpt-4o-realtime-preview-2024-12-17";

function buildInstructions(language: string): string {
  const isArabicSession = language?.toLowerCase().startsWith("ar");
  const lang = isArabicSession ? "Arabic" : "English";
  return [
    `You are Oryxa, a friendly educational assessor for CSW World.`,
    `This is a LIVE voice + camera session with a prospective student.`,
    `Conduct the entire conversation in ${lang}. Match the student's tone — warm, encouraging, professional.`,
    ``,
    `Session goal: produce a quick, informal preliminary read on the student's:`,
    `- Language proficiency (listening, speaking, basic comprehension)`,
    `- Quantitative reasoning (simple arithmetic, geometry, word problems)`,
    `- Logical thinking (a short puzzle or sequence)`,
    `- Educational background and interests`,
    ``,
    `Use the camera images you receive to confirm the student is present and engaged. Acknowledge what you see briefly when relevant ("I can see you, great"). Never describe their physical features in detail. Never store or share images.`,
    ``,
    `Flow:`,
    `1. Greet warmly. Confirm you can hear them and they can hear you.`,
    `2. Ask them to introduce themselves briefly (name, current level, interests).`,
    `3. Ask 2–3 short language questions appropriate to their level.`,
    `4. Ask 1–2 quick math/geometry questions (kept simple).`,
    `5. Ask one short logical reasoning question.`,
    `6. Close with a brief spoken summary: a friendly preliminary impression — strengths, areas to develop, and a recommended next step. Make clear this is a preliminary impression, not a formal evaluation.`,
    ``,
    `Constraints:`,
    `- Keep total session under ~7 minutes.`,
    `- Speak in short, clear sentences. Pause to let the student answer.`,
    `- Never collect sensitive personal data (passport numbers, addresses, payment info).`,
    `- This is an experimental prototype — remind the student once at the start that nothing is saved.`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: { language?: string; voice?: string } = {};
    try {
      if (req.method === "POST") body = await req.json();
    } catch {
      // empty body is OK
    }

    const language = (body.language || "en").slice(0, 8);
    const voice = body.voice || "alloy";

    const instructions = buildInstructions(language);

    const openaiRes = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice,
        modalities: ["audio", "text"],
        instructions,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
        },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI session error", openaiRes.status, errText);
      return new Response(
        JSON.stringify({
          error: "openai_session_failed",
          status: openaiRes.status,
          details: errText.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await openaiRes.json();

    // Return only what the browser needs.
    return new Response(
      JSON.stringify({
        client_secret: data.client_secret,
        model: REALTIME_MODEL,
        voice,
        expires_at: data.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("realtime-session-token unexpected error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
