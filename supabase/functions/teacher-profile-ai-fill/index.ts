import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, currentProfile } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const systemPrompt = `You are a helpful assistant for language teachers building their public profile on an online tutoring platform.

Your job is to help teachers fill in their profile fields based on a conversation.

The teacher's current profile data (may be partially filled):
${JSON.stringify(currentProfile, null, 2)}

After gathering enough information through conversation, call the "fill_profile_fields" tool with the suggested values for each field. Only fill fields you have enough information for. Keep suggestions professional, warm, and student-friendly.

Write bios in third person if the teacher provides info in first person. Keep descriptions concise but compelling.

IMPORTANT: Always respond in the same language the teacher uses. If they write in Arabic, respond in Arabic. If English, respond in English.`;

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "fill_profile_fields",
          description: "Fill in one or more profile fields with suggested content based on the conversation.",
          parameters: {
            type: "object",
            properties: {
              display_name: { type: "string", description: "Teacher's display name" },
              bio: { type: "string", description: "About me / bio section (2-4 sentences)" },
              teaching_experience: { type: "string", description: "Teaching experience description" },
              education: { type: "string", description: "Education and qualifications" },
              specialty: { type: "string", description: "Teaching specialty" },
              languages_spoken: { type: "array", items: { type: "string" }, description: "Languages spoken with level" },
              country: { type: "string", description: "Country name" },
              country_code: { type: "string", description: "2-letter country code lowercase" },
              price_per_lesson: { type: "number", description: "Price per lesson in USD" },
              lesson_duration_minutes: { type: "number", description: "Lesson duration in minutes" },
            },
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("teacher-profile-ai-fill error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
