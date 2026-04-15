import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAdmin(req);
    const { context, policy } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Import Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load active policy if not provided
    let policyResolved = policy;
    if (!policyResolved) {
      const { data: polRows } = await supabase
        .from('unis_assistant_policies')
        .select('*')
        .eq('is_active', true);
      policyResolved = { rules: polRows || [] };
    }

    const systemPrompt = `You are an internal universities evaluator. USE ONLY the provided CONTEXT & POLICY. No external knowledge. Output strictly JSON with these fields:
- decision: "accept" | "reject" | "needs_more_data"
- confidence: number (0-1)
- reasons: array of {code: string, text: string}
- per_program_flags: array of {program_id: string, issues: string[]}
- required_fixes: string[]
- go_lives: array of {program_id: string, why: string}`;

    const userPrompt = `CONTEXT=${JSON.stringify(context)}
POLICY=${JSON.stringify(policyResolved)}
TASK=Evaluate and produce a decision & reasons & flags & required fixes & go_lives ONLY from context.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    // Log telemetry event
    await supabase.rpc('log_unis_event', {
      p_event_type: 'assistant_analyzed',
      p_user_id: null,
      p_job_id: null,
      p_context: {
        programs_count: (context?.programs || []).length,
        policy_rules: (policyResolved?.rules || []).length,
        decision: parsed.decision
      }
    });

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze:', error);
    const msg = String((error as Error).message || error);
    const code = msg === "FORBIDDEN" ? 403 : (msg === "NO_AUTH" || msg === "INVALID_USER") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }
});
