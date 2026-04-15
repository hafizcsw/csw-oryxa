import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/http.ts";
import { requireAdmin } from "../_shared/auth.ts";

serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  
  try {
    await requireAdmin(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { job_id, selections } = await req.json();

    // Load diff
    const { data: diffArt } = await supabase
      .from('ingest_artifacts')
      .select('*')
      .eq('job_id', job_id)
      .eq('kind', 'diff_json')
      .single();

    if (!diffArt) throw new Error('Diff not ready');

    const diff = diffArt.content;
    let university_id = diff.university_id;

    // Apply university changes
    if (selections?.university === 'create' && diff.university_action === 'create') {
      const { data: parsedArt } = await supabase
        .from('ingest_artifacts')
        .select('*')
        .eq('job_id', job_id)
        .eq('kind', 'parsed_json')
        .single();

      const parsed = parsedArt?.content;

      // Get country_id from geo_countries
      const { data: country } = await supabase
        .from('geo_countries')
        .select('id')
        .eq('iso2', parsed.university.country_iso)
        .single();

      if (!country) throw new Error('Country not found');

      // Insert university
      const { data: newUni, error: uniError } = await supabase
        .from('universities')
        .insert({
          name: parsed.university.name,
          country_id: country.id,
          is_active: true
        })
        .select('id')
        .single();

      if (uniError) throw uniError;
      university_id = newUni.id;

      // Insert aliases
      for (const alias of parsed.university.aliases || []) {
        await supabase.from('university_aliases').insert({
          university_id,
          alias,
          normalized_alias: alias.toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim()
        });
      }
    }

    // Apply program changes
    for (const p of diff.programs || []) {
      const selection = selections?.programs?.find((s: any) =>
        s.normalized_key === p.normalized_key || s.program_id === p.program_id
      );

      if (p.action === 'create' && selection?.action === 'create') {
        const d = p.data;

        // Get degree_id
        const { data: degree } = await supabase
          .from('degrees')
          .select('id')
          .eq('slug', d.level)
          .single();

        await supabase.from('programs').insert({
          university_id,
          title: d.name,
          degree_id: degree?.id || null,
          language: d.study_language,
          tuition_fee: d.tuition_per_year || null,
          duration_months: d.duration_semesters || null,
          intake_months: d.intakes || null,
          is_active: true
        });
      }

      if (p.action === 'update' && selection?.action === 'update') {
        const updates: any = {};
        if (p.diff.tuition_per_year) updates.tuition_fee = p.diff.tuition_per_year.to;
        if (p.diff.duration_semesters) updates.duration_months = p.diff.duration_semesters.to;

        if (Object.keys(updates).length > 0) {
          await supabase.from('programs').update(updates).eq('id', p.program_id);
        }
      }
    }

    // Update job status
    await supabase.from('ingest_jobs').update({
      status: 'applied'
    }).eq('id', job_id);

    // Refresh FTS materialized view
    await supabase.rpc('refresh_mv_unicat_fts');

    // Count changes
    const createCount = diff.programs.filter((p: any) => 
      p.action === 'create' && selections?.programs?.find((s: any) => s.action === 'create')
    ).length;
    const updateCount = diff.programs.filter((p: any) => 
      p.action === 'update' && selections?.programs?.find((s: any) => s.action === 'update')
    ).length;

    // Log telemetry event
    await supabase.rpc('log_unis_event', {
      p_event_type: 'ingest_applied',
      p_user_id: null,
      p_job_id: job_id,
      p_context: { 
        programs_created: createCount,
        programs_updated: updateCount,
        university_id
      }
    });

    return new Response(
      JSON.stringify({ ok: true, university_id }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in apply:', error);
    const msg = String((error as Error).message || error);
    const code = msg === "FORBIDDEN" ? 403 : (msg === "NO_AUTH" || msg === "INVALID_USER") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }
});
