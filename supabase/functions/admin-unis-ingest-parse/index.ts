import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }
    
    const supabase = auth.srv;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { job_id, evidence_mode = true } = await req.json();

    console.log(`[parse] job_id=${job_id}, evidence_mode=${evidence_mode}`);

    // Get extracted text
    const { data: artifact } = await supabase
      .from('ingest_artifacts')
      .select('*')
      .eq('job_id', job_id)
      .eq('kind', 'text')
      .single();

    const text = artifact?.content?.text || '';
    if (!text) throw new Error('No text found for this job');

    const evidencePrompt = evidence_mode 
      ? `For each numeric field (tuition_per_year, duration_semesters), include an "evidence" object:
{
  "page": number or null,
  "value_str": "exact string from text",
  "snippet": "surrounding text (20-50 chars)"
}` 
      : '';

    const systemPrompt = `You are a data extraction expert. Extract ALL university programs from the text.

CRITICAL RULES:
1. If the text contains multiple universities, extract the FIRST university and ALL its programs
2. Extract ALL programs mentioned for that university - do not skip any
3. The text may be in Arabic - handle Arabic text properly
4. Be thorough - extract every program you find

Output JSON with this exact structure:
{
  "university": {
    "name": "string (university name)",
    "country_iso": "string (2-letter ISO code like US, GB, CA)",
    "aliases": ["string"] (optional),
    "contacts": [{"type": "string", "value": "string"}] (optional)
  },
  "programs": [
    {
      "name": "string (program name)",
      "level": "bachelor" | "master" | "phd" | "diploma" | "certificate",
      "study_language": "string (language of instruction)",
      "tuition_per_year": number or null,
      "duration_semesters": number or null,
      "requirements": [{"type": "ielts|toefl|academic|other", "value": "string"}],
      "intakes": ["January", "September", etc],
      "evidence": {
        "tuition_evidence": {"page": null, "value_str": "exact number from text", "snippet": "surrounding text"},
        "duration_evidence": {"page": null, "value_str": "exact duration from text", "snippet": "surrounding text"}
      }
    }
  ]
}

${evidencePrompt}

Extract ONLY information explicitly stated in the text. Be precise with numbers and provide evidence.`;

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
          { role: 'user', content: `TEXT:\n${text.slice(0, 100000)}` }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const geminiParsed = JSON.parse(content);

    console.log(`[parse] Gemini parsed ${geminiParsed.programs?.length || 0} programs`);

    // Apply evidence validation and flags if evidence_mode is enabled
    if (evidence_mode && geminiParsed.programs) {
      for (const prog of geminiParsed.programs) {
        prog.flags = prog.flags || [];
        
        // Check if evidence exists and is valid
        const hasValidTuitionEvidence = prog.evidence?.tuition_evidence?.snippet && 
                                        prog.evidence?.tuition_evidence?.value_str;
        const hasValidDurationEvidence = prog.evidence?.duration_evidence?.snippet && 
                                         prog.evidence?.duration_evidence?.value_str;
        
        if (prog.tuition_per_year && !hasValidTuitionEvidence) {
          prog.flags.push('MISSING_TUITION_EVIDENCE');
        }
        
        if (prog.duration_semesters && !hasValidDurationEvidence) {
          prog.flags.push('MISSING_DURATION_EVIDENCE');
        }
      }
    }

    // Save parsed data
    await supabase.from('ingest_artifacts').insert({
      job_id,
      kind: 'parsed_json',
      content: geminiParsed
    });

    // Update job status
    await supabase.from('ingest_jobs').update({
      status: 'parsed'
    }).eq('id', job_id);

    // Log telemetry event
    await supabase.rpc('log_unis_event', {
      p_event_type: 'ingest_parsed',
      p_user_id: null,
      p_job_id: job_id,
      p_context: { 
        programs_count: geminiParsed.programs?.length || 0,
        evidence_mode
      }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        university: geminiParsed.university?.name,
        programs_count: geminiParsed.programs?.length || 0 
      }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in parse:', error);
    const msg = String((error as Error).message || error);
    const code = msg === "FORBIDDEN" ? 403 : (msg === "NO_AUTH" || msg === "INVALID_USER") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }
});
