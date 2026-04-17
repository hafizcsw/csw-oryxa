// ═══════════════════════════════════════════════════════════════
// analyze-document — Lovable AI document classifier + quality check
// ═══════════════════════════════════════════════════════════════
// Input:  { file_name: string, mime_type: string, base64: string }
// Output: { document_type, document_type_label, quality, quality_score,
//           confidence, detected_fields[], warnings[], is_relevant,
//           summary }
// Uses Lovable AI Gateway (google/gemini-2.5-flash) with tool calling
// for structured extraction. Vision is enabled — accepts images + PDF.
// ═══════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a strict student-file document classifier for an international university applications portal.

Look at the uploaded file (image or PDF page) and decide:

1) document_type — one of:
   passport, national_id, birth_certificate, personal_photo,
   high_school_certificate, university_degree, transcript,
   ielts, toefl, duolingo, other_language_certificate,
   recommendation_letter, motivation_letter, cv_resume,
   financial_proof, medical_document, work_experience,
   unknown, not_a_document

2) quality — one of: excellent, good, acceptable, poor, unreadable
   - excellent: sharp, full document, all fields readable, no glare
   - good: clearly readable, minor issues
   - acceptable: usable but cropped/tilted/low light
   - poor: hard to read, missing parts, blurry — should be re-uploaded
   - unreadable: cannot extract any meaningful info

3) is_relevant — true if it belongs in a student application file, false otherwise (selfie, meme, screenshot of unrelated app, blank page).

4) detected_fields — short list of meaningful fields you actually saw, e.g.
   ["full name", "passport number", "expiry date", "issuing country"].

5) warnings — short human-readable warnings in the SAME LANGUAGE as the user prompt locale (default English) for any of:
   - low quality / blurry
   - irrelevant document
   - expired document if visible
   - missing fields
   - duplicate / partial scan
   - wrong document for student file

6) summary — one short sentence in the same locale, e.g.
   "Passport detected, all key fields readable."

Be honest. Do NOT invent fields you cannot see. If unsure, say unknown and add a warning.`;

const TOOL = {
  type: "function",
  function: {
    name: "report_document_analysis",
    description:
      "Return the structured classification of the uploaded student-file document.",
    parameters: {
      type: "object",
      properties: {
        document_type: {
          type: "string",
          enum: [
            "passport",
            "national_id",
            "birth_certificate",
            "personal_photo",
            "high_school_certificate",
            "university_degree",
            "transcript",
            "ielts",
            "toefl",
            "duolingo",
            "other_language_certificate",
            "recommendation_letter",
            "motivation_letter",
            "cv_resume",
            "financial_proof",
            "medical_document",
            "work_experience",
            "unknown",
            "not_a_document",
          ],
        },
        document_type_label: {
          type: "string",
          description:
            "Human-readable label of the document type, in the requested locale.",
        },
        quality: {
          type: "string",
          enum: ["excellent", "good", "acceptable", "poor", "unreadable"],
        },
        quality_score: {
          type: "number",
          description: "0..100 quality score.",
        },
        confidence: {
          type: "number",
          description: "0..1 confidence in document_type.",
        },
        is_relevant: { type: "boolean" },
        detected_fields: {
          type: "array",
          items: { type: "string" },
        },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
        summary: { type: "string" },
      },
      required: [
        "document_type",
        "document_type_label",
        "quality",
        "quality_score",
        "confidence",
        "is_relevant",
        "detected_fields",
        "warnings",
        "summary",
      ],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      file_name,
      mime_type,
      base64,
      locale = "en",
    } = body as {
      file_name?: string;
      mime_type?: string;
      base64?: string;
      locale?: string;
    };

    if (!base64 || !mime_type || !file_name) {
      return new Response(
        JSON.stringify({
          error: "file_name, mime_type and base64 are required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Vision input — Lovable AI accepts data URLs for images.
    // For non-image MIME types (PDF/Word), we still pass the file name + a hint;
    // Gemini multimodal can read PDF as image_url with the right MIME.
    const isVisual =
      mime_type.startsWith("image/") || mime_type === "application/pdf";

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text:
          `File name: ${file_name}\n` +
          `MIME: ${mime_type}\n` +
          `Locale for warnings/labels: ${locale}\n\n` +
          `Classify this file as a student-application document and return the structured result via the tool.`,
      },
    ];

    if (isVisual) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mime_type};base64,${base64}` },
      });
    }

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          tools: [TOOL],
          tool_choice: {
            type: "function",
            function: { name: "report_document_analysis" },
          },
        }),
      },
    );

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "payment_required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      return new Response(
        JSON.stringify({ error: "ai_gateway_error", detail: txt.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;

    let parsed: Record<string, unknown> | null = null;
    if (typeof args === "string") {
      try {
        parsed = JSON.parse(args);
      } catch (_e) {
        parsed = null;
      }
    } else if (args && typeof args === "object") {
      parsed = args as Record<string, unknown>;
    }

    if (!parsed) {
      return new Response(
        JSON.stringify({
          error: "no_structured_output",
          raw: data?.choices?.[0]?.message?.content ?? null,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-document error:", e);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
