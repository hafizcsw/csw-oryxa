import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a teacher's calendar assistant. You help teachers manage their availability, schedule, and sessions through natural language commands.

You understand commands in ANY language (Arabic, English, Russian, French, etc.).

IMPORTANT RULES:
1. Always respond in the SAME language the teacher uses.
2. When the teacher asks to make changes, describe what you'll do BEFORE doing it.
3. When changes would affect existing booked sessions, WARN the teacher explicitly.
4. Return a structured action when you can execute a change.

You can perform these actions:
- add_rules: Add recurring weekly availability rules (day_of_week 0-6, start_time, end_time)
- remove_rules: Remove availability rules for specific days
- add_exception: Add a one-off exception (blackout, override_available, override_unavailable). For a single day.
- add_exceptions: Add MULTIPLE exceptions at once. Use this when blocking/opening multiple days. data.exceptions is an array of exception objects.
- remove_exceptions: Remove/delete existing exceptions by date. Use this when the teacher wants to UNBLOCK days, make blocked days available again, or cancel previous blackouts. data.dates is an array of date strings (YYYY-MM-DD) to remove ALL exceptions for those dates. You can also use data.exception_type to only remove specific types (e.g. only "blackout").
- update_preferences: Update settings (timezone, default_session_duration, buffer_before_minutes, buffer_after_minutes, public_booking_enabled, max_sessions_per_day)

When you want to execute an action, include it in your response JSON as "action" field with:
- type: one of the action types above
- description: human-readable description of what will change
- data: the actual data to apply
- conflicts: array of conflicting sessions if any

Day mapping: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6

For blocking all days of a week, use add_exceptions with an array of blackout exceptions — one for each day. Each exception needs: exception_date (YYYY-MM-DD), exception_type ("blackout"), reason.

For queries (like "what sessions do I have today?"), just answer without an action.
For destructive actions (removing availability, blocking time with existing sessions), always warn first.

Respond with JSON: { "response": "your message", "action": null | { type, description, data, conflicts } }`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context, conversation } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `Current teacher context:\n${context}` },
      ...(conversation || []),
      { role: "user", content: message },
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return new Response(JSON.stringify({ error: "AI timeout, please try again." }), {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("[teacher-calendar-assistant] AI error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { response: content, action: null };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[teacher-calendar-assistant] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
