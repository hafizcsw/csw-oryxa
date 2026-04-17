// ═══════════════════════════════════════════════════════════════
// analyze-document — Lovable AI document classifier + field extractor
// ═══════════════════════════════════════════════════════════════
// Returns:
//   - document_type, document_type_label
//   - quality, quality_score, confidence, is_relevant
//   - warnings[], summary, detected_fields[]
//   - extracted_fields[] : per-field { path, label, value, confidence, status }
//     status ∈ accepted | pending_review | unresolved
// ═══════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a strict student-file document classifier and field extractor for a university applications portal.

SCOPE LOCK — only these document types matter for v1:
  passport, transcript, high_school_certificate, university_degree (graduation),
  ielts, toefl, duolingo, other_language_certificate.
Anything else → mark is_relevant=false OR set document_type=unsupported_in_v1.

Look at the uploaded file (image or PDF page) and decide:

1) document_type — one of:
   passport, transcript, high_school_certificate, university_degree,
   ielts, toefl, duolingo, other_language_certificate,
   unknown, not_a_document, unsupported_in_v1

2) quality — excellent | good | acceptable | poor | unreadable

3) is_relevant — false for selfies, memes, screenshots, blank pages, unrelated docs.

4) extracted_fields — an array. ONLY include a field if you can actually see it in the document.
   For each, return: { path, label, value (string), confidence (0..1), status }.
   status MUST follow these rules HONESTLY:
     - "accepted"        : confidence >= 0.9 AND value clearly readable AND no ambiguity
     - "pending_review"  : confidence 0.5..0.9 OR partially readable / cropped / handwritten
     - "unresolved"      : you tried but cannot extract reliably (still emit the field with empty value and unresolved status)

   Field paths per document_type:
     passport →
       passport_name, passport_number, citizenship,
       date_of_birth, gender, passport_expiry_date, passport_issuing_country
     transcript →
       student_name, institution_name, gpa_or_average, grading_scale,
       graduation_or_completion_date, subject_count
     high_school_certificate / university_degree →
       student_name, institution_name, degree_or_certificate_name,
       graduation_date, final_grade
     ielts / toefl / duolingo / other_language_certificate →
       candidate_name, english_test_type, english_total_score,
       test_date, expiry_date, sub_scores (string summary if present)

5) detected_fields — short labels of what you actually saw (used for chips).

6) warnings — short human-readable in the requested locale, for any of:
   low_ocr_quality, expired_document, missing_fields,
   classification_uncertain, conflict_with_existing_truth, partial_scan,
   unsupported_in_v1, irrelevant_document

7) summary — one short sentence in the requested locale.

NEVER invent values. If a field is not visible, either omit it OR include with empty value + status=unresolved.`;

const TOOL = {
  type: "function",
  function: {
    name: "report_document_analysis",
    description:
      "Return the structured classification + extraction of the uploaded student-file document.",
    parameters: {
      type: "object",
      properties: {
        document_type: {
          type: "string",
          enum: [
            "passport",
            "transcript",
            "high_school_certificate",
            "university_degree",
            "ielts",
            "toefl",
            "duolingo",
            "other_language_certificate",
            "unknown",
            "not_a_document",
            "unsupported_in_v1",
          ],
        },
        document_type_label: { type: "string" },
        quality: {
          type: "string",
          enum: ["excellent", "good", "acceptable", "poor", "unreadable"],
        },
        quality_score: { type: "number" },
        confidence: { type: "number" },
        is_relevant: { type: "boolean" },
        detected_fields: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
        extracted_fields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              label: { type: "string" },
              value: { type: "string" },
              confidence: { type: "number" },
              status: {
                type: "string",
                enum: ["accepted", "pending_review", "unresolved"],
              },
            },
            required: ["path", "label", "value", "confidence", "status"],
            additionalProperties: false,
          },
        },
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
        "extracted_fields",
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
        JSON.stringify({ error: "file_name, mime_type and base64 are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isVisual =
      mime_type.startsWith("image/") || mime_type === "application/pdf";

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text:
          `File name: ${file_name}\n` +
          `MIME: ${mime_type}\n` +
          `Locale: ${locale}\n\n` +
          `Classify this file AND extract the per-field truth via the tool. ` +
          `Honest statuses only.`,
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
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "payment_required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
      try { parsed = JSON.parse(args); } catch { parsed = null; }
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
