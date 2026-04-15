import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAdmin(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { university_id, program_ids, filters } = await req.json();

    // Query from the unified view
    let query = supabase.from('vw_university_catalog').select('*');
    
    if (university_id) query = query.eq('university_id', university_id);
    if (program_ids?.length) query = query.in('program_id', program_ids);
    if (filters?.country_iso) query = query.eq('country_iso', filters.country_iso);
    if (filters?.level) query = query.eq('level', filters.level);
    if (filters?.study_language) query = query.eq('study_language', filters.study_language);

    const { data: programs, error } = await query;
    if (error) throw error;

    // Aggregate stats/warnings
    const tuitionVals = (programs || [])
      .map((p: any) => p.tuition_per_year)
      .filter((v: any) => typeof v === 'number');
    
    const stats = {
      programs_count: programs?.length || 0,
      tuition_min: tuitionVals.length ? Math.min(...tuitionVals) : null,
      tuition_max: tuitionVals.length ? Math.max(...tuitionVals) : null,
      tuition_avg: tuitionVals.length 
        ? Number((tuitionVals.reduce((a: number, b: number) => a + b, 0) / tuitionVals.length).toFixed(2))
        : null,
      languages: Array.from(new Set((programs || []).map((p: any) => p.study_language).filter(Boolean))),
      levels: Array.from(new Set((programs || []).map((p: any) => p.level).filter(Boolean))),
    };

    const warnings: string[] = [];
    for (const p of programs || []) {
      if (!p.study_language) warnings.push(`MISSING_LANGUAGE for program_id=${p.program_id}`);
      if (!p.tuition_per_year) warnings.push(`MISSING_TUITION for program_id=${p.program_id}`);
    }

    // Log telemetry event
    await supabase.rpc('log_unis_event', {
      p_event_type: 'assistant_context_built',
      p_user_id: null,
      p_job_id: null,
      p_context: { stats, warnings_count: warnings.length }
    });

    return new Response(
      JSON.stringify({ 
        context: { programs: programs || [] }, 
        stats, 
        warnings 
      }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in build-context:', error);
    const msg = String((error as Error).message || error);
    const code = msg === "FORBIDDEN" ? 403 : (msg === "NO_AUTH" || msg === "INVALID_USER") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }
});
