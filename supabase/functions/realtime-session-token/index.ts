// Edge function: realtime-session-token
// Issues an ephemeral OpenAI Realtime API token for a CSW World live assessment session.
// Direct OpenAI API call (NOT via Lovable AI Gateway). No data persisted.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Latest production realtime model — significantly better understanding,
// faster turn-taking, and proper multilingual handling vs the 2024-12 preview.
const REALTIME_MODEL = "gpt-4o-realtime-preview-2025-06-03";

// 12-locale baseline for CSW World
const LANG_NAME: Record<string, string> = {
  ar: "Arabic", en: "English", es: "Spanish", fr: "French",
  de: "German", pt: "Portuguese", ru: "Russian", zh: "Mandarin Chinese",
  ja: "Japanese", ko: "Korean", hi: "Hindi", bn: "Bengali",
};

const VOICE_BY_LANG: Record<string, string> = {
  ar: "shimmer", en: "alloy", es: "nova", fr: "nova",
  de: "echo", pt: "nova", ru: "echo", zh: "shimmer",
  ja: "shimmer", ko: "shimmer", hi: "nova", bn: "nova",
};

interface StudentContext {
  displayName?: string;
  educationLevel?: string;
  interestedCountries?: string[];
  interestedFields?: string[];
  age?: number | string;
}

function normLang(input: string | undefined): string {
  const k = (input || "en").toLowerCase().slice(0, 2);
  return LANG_NAME[k] ? k : "en";
}

function buildVoiceChatInstructions(langCode: string, ctx: StudentContext | undefined): string {
  const langName = LANG_NAME[langCode];

  const ctxLines: string[] = [];
  if (ctx?.displayName) ctxLines.push(`- Student name: ${ctx.displayName}`);
  if (ctx?.educationLevel) ctxLines.push(`- Current education level: ${ctx.educationLevel}`);
  if (ctx?.interestedFields?.length)
    ctxLines.push(`- Fields of interest: ${ctx.interestedFields.slice(0, 5).join(", ")}`);
  if (ctx?.interestedCountries?.length)
    ctxLines.push(`- Countries of interest: ${ctx.interestedCountries.slice(0, 5).join(", ")}`);
  const studentBlock = ctxLines.length
    ? `Known about this student (use naturally, do NOT recite back):\n${ctxLines.join("\n")}`
    : ``;

  return [
    `You are Oryxa, the live voice assistant of CSW World — a global platform that helps students explore universities and programs across 12 supported countries (worldwide, not biased to any one country).`,
    ``,
    `This is a LIVE, free-form VOICE conversation, like a phone call with a friend. Behave EXACTLY like ChatGPT Advanced Voice Mode: warm, fast, natural, expressive, with real-time turn-taking. NO assessment, NO structured phases, NO long monologues.`,
    ``,
    `=== LANGUAGE — CRITICAL RULE ===`,
    `ALWAYS reply in the SAME LANGUAGE the user just spoke. This is non-negotiable.`,
    `  - User speaks English → you reply in English.`,
    `  - User speaks Arabic → you reply in Arabic.`,
    `  - User speaks French → you reply in French.`,
    `  - User code-switches mid-sentence → match their dominant language for that turn.`,
    `The interface language is ${langName}, so use ${langName} ONLY for your very first greeting if the user has not spoken yet. After that, ALWAYS mirror the user's spoken language. Never lecture them about language. Never refuse to switch.`,
    ``,
    `=== STYLE ===`,
    `  - Short, natural spoken sentences (1–3 sentences per turn typically).`,
    `  - Conversational fillers are fine ("hmm", "got it", "okay so…").`,
    `  - Pause after questions; let the user finish.`,
    `  - Be expressive — vary tone, show interest, react.`,
    `  - Never read URLs or long lists out loud.`,
    `  - If you don't know something specific (exact tuition, current deadlines), say so honestly and suggest exploring it on CSW World.`,
    `  - If interrupted, stop immediately and listen.`,
    ``,
    studentBlock,
    ``,
    `=== CAPABILITIES ===`,
    `  - Discuss countries, fields, programs, scholarships, language requirements, application steps.`,
    `  - General study-abroad guidance.`,
    `  - Encourage using CSW World for deep search, comparisons, and applications.`,
    ``,
    `=== HARD CONSTRAINTS ===`,
    `  - Never collect: passport numbers, ID numbers, addresses, payment info, parent contact info.`,
    `  - Never promise admission, scholarships, visas, or specific outcomes.`,
    `  - Never invent CSW World prices, ranks, or guarantees.`,
    `  - If asked something clearly off-topic (politics, medical advice), gently steer back.`,
    ``,
    `Greet the user briefly in ${langName} and ask how you can help. After that, MIRROR their language every turn.`,
  ].filter(Boolean).join("\n");
}

function buildInstructions(langCode: string, ctx: StudentContext | undefined): string {
  const langName = LANG_NAME[langCode];

  const ctxLines: string[] = [];
  if (ctx?.displayName) ctxLines.push(`- Student name: ${ctx.displayName}`);
  if (ctx?.age) ctxLines.push(`- Approximate age: ${ctx.age}`);
  if (ctx?.educationLevel) ctxLines.push(`- Current education level: ${ctx.educationLevel}`);
  if (ctx?.interestedFields?.length)
    ctxLines.push(`- Fields of interest: ${ctx.interestedFields.slice(0, 5).join(", ")}`);
  if (ctx?.interestedCountries?.length)
    ctxLines.push(`- Countries of interest: ${ctx.interestedCountries.slice(0, 5).join(", ")}`);
  const studentBlock = ctxLines.length
    ? `Known about this student (use naturally, do NOT recite back):\n${ctxLines.join("\n")}`
    : `You have no prior data about this student.`;

  return [
    `You are Oryxa, the official live guidance assistant of CSW World — a global platform that helps students explore universities and programs across 12 supported countries (worldwide, not biased to any single country).`,
    ``,
    `This is a LIVE voice + camera session. The student can hear you and you can hear them. Roughly every 3 seconds you also receive a still image from their camera as a context message — use it silently to confirm presence, engagement, and to look at any paper they hold up. Never describe their physical features. Never store anything.`,
    ``,
    `LANGUAGE RULE — STRICT:`,
    `Conduct the ENTIRE session in ${langName}. This includes greetings, all questions, transitions, encouragement, and the closing summary. If the student answers in another language, gently follow them but keep your default in ${langName}. Never default to English unless the session language IS English.`,
    ``,
    `Tone: warm, professional, curious — like a senior international admissions advisor, NOT a tutor and NOT a chatbot. Short clear sentences. Pause after each question.`,
    ``,
    studentBlock,
    ``,
    `=== SESSION GOAL ===`,
    `Run a quick, structured *preliminary* assessment so CSW World can later recommend programs that fit. You are gathering signal across 4 dimensions:`,
    `  1. Language proficiency in ${langName} (rough CEFR: A1, A2, B1, B2, C1, C2)`,
    `  2. Quantitative reasoning (basic arithmetic + one geometry item, using camera to see their work)`,
    `  3. Logical reasoning (one short item)`,
    `  4. Background & study goals (level, fields, countries, motivation)`,
    ``,
    `=== STRUCTURED FLOW (follow in order, ~6–8 minutes total) ===`,
    ``,
    `PHASE 1 — Greeting (≤30s)`,
    `  - Greet by name if known. Confirm audio works. State once: "This is a short preliminary chat, nothing is saved."`,
    ``,
    `PHASE 2 — Background (≤90s)`,
    `  - Ask: current education level, fields they care about, countries they're considering, and why CSW World.`,
    ``,
    `PHASE 3 — Language (≤2 min)`,
    `  - Ask 3 graded prompts in ${langName}:`,
    `    a) Simple self-description (A1/A2 signal)`,
    `    b) Describe a recent experience or opinion (B1/B2 signal)`,
    `    c) Take a position on an abstract topic relevant to study abroad (C1/C2 signal)`,
    `  - Listen for vocabulary range, fluency, grammar control, pronunciation.`,
    ``,
    `PHASE 4 — Quantitative (≤2 min)`,
    `  - Ask one arithmetic/percentage word problem out loud. Wait for verbal answer.`,
    `  - Then ask ONE geometry problem (e.g. area of a triangle with given base/height, or angle sum). Say clearly: "Please solve it on paper, then hold the paper up to the camera so I can see your work." Use the camera frames to read what they wrote. Comment on what you see.`,
    ``,
    `PHASE 5 — Logical reasoning (≤1 min)`,
    `  - One short sequence or simple deduction.`,
    ``,
    `PHASE 6 — Wrap-up (≤60s)`,
    `  - Give a short spoken summary in ${langName}: strengths, areas to develop, and one concrete suggested next step on CSW World (e.g., "explore engineering programs in Germany"). Make clear this is a preliminary impression, not a formal evaluation.`,
    `  - IMMEDIATELY AFTER your spoken summary, call the tool \`submit_assessment\` exactly once with your structured estimates. Do not announce the tool call to the student.`,
    ``,
    `=== HARD CONSTRAINTS ===`,
    `  - Never collect: passport numbers, ID numbers, addresses, payment info, parent contact info.`,
    `  - Never promise admission, scholarships, visas, or specific outcomes.`,
    `  - Never invent CSW World prices, ranks, or guarantees.`,
    `  - If asked something outside scope, say it briefly and steer back.`,
    `  - If camera is off, continue audio-only and skip the "show your work" step.`,
  ].join("\n");
}

const ASSESSMENT_TOOL = {
  type: "function",
  name: "submit_assessment",
  description:
    "Submit the structured preliminary assessment at the end of the session. Call exactly once after the spoken wrap-up.",
  parameters: {
    type: "object",
    properties: {
      session_language: { type: "string", description: "ISO 639-1 code of the session language" },
      language_level_estimate: {
        type: "string",
        enum: ["A1", "A2", "B1", "B2", "C1", "C2", "unknown"],
      },
      language_notes: { type: "string", description: "Short, factual notes on language signal." },
      quantitative_level: {
        type: "string",
        enum: ["weak", "basic", "solid", "strong", "unknown"],
      },
      quantitative_notes: { type: "string" },
      logical_level: {
        type: "string",
        enum: ["weak", "basic", "solid", "strong", "unknown"],
      },
      logical_notes: { type: "string" },
      current_education_level: { type: "string" },
      interests_detected: { type: "array", items: { type: "string" } },
      countries_mentioned: { type: "array", items: { type: "string" } },
      recommended_next_step: { type: "string" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      session_notes_short: { type: "string" },
    },
    required: [
      "session_language",
      "language_level_estimate",
      "quantitative_level",
      "logical_level",
      "recommended_next_step",
      "confidence",
    ],
  },
};

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

    let body: {
      language?: string;
      voice?: string;
      studentContext?: StudentContext;
      mode?: "assessment" | "voice_chat";
    } = {};
    try {
      if (req.method === "POST") body = await req.json();
    } catch {
      // empty body OK
    }

    const langCode = normLang(body.language);
    const voice = body.voice || VOICE_BY_LANG[langCode] || "alloy";
    const mode = body.mode === "voice_chat" ? "voice_chat" : "assessment";

    const instructions =
      mode === "voice_chat"
        ? buildVoiceChatInstructions(langCode, body.studentContext)
        : buildInstructions(langCode, body.studentContext);

    const sessionPayload: Record<string, unknown> = {
      model: REALTIME_MODEL,
      voice,
      modalities: ["audio", "text"],
      instructions,
      // Tuned for snappy, ChatGPT-Voice-like turn-taking + accurate multilingual transcription.
      // No `language` hint → Whisper auto-detects per turn so EN/AR/etc. all transcribe correctly.
      input_audio_transcription: { model: "whisper-1" },
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      temperature: 0.8,
      turn_detection: {
        type: "server_vad",
        threshold: 0.55,
        prefix_padding_ms: 250,
        silence_duration_ms: 380,
        create_response: true,
        interrupt_response: true,
      },
    };

    if (mode === "assessment") {
      sessionPayload.tools = [ASSESSMENT_TOOL];
      sessionPayload.tool_choice = "auto";
    }

    const openaiRes = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionPayload),
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

    return new Response(
      JSON.stringify({
        client_secret: data.client_secret,
        model: REALTIME_MODEL,
        voice,
        language: langCode,
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
