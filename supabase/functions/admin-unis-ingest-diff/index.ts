import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/http.ts";
import { normalize } from "../_shared/normalize.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }
    
    const supabase = auth.srv;

    const { job_id } = await req.json();

    // Get parsed data
    const { data: parsedArt, error: e1 } = await supabase
      .from('ingest_artifacts')
      .select('*')
      .eq('job_id', job_id)
      .eq('kind', 'parsed_json')
      .single();

    if (e1) throw e1;
    const parsed = parsedArt?.content;
    if (!parsed) throw new Error('No parsed data found');

    const uniKey = `${parsed.university.country_iso}:${normalize(parsed.university.name)}`;

    // Try to match university
    const { data: catalog } = await supabase
      .from('vw_university_catalog')
      .select('university_id, university_name, country_iso')
      .eq('country_iso', parsed.university.country_iso);

    const byName = (catalog || []).find((u: any) => 
      normalize(u.university_name) === normalize(parsed.university.name)
    );

    let university_action = 'create';
    let university_id = null;

    if (byName) {
      university_action = 'match';
      university_id = byName.university_id;
    }

    const programs = [];

    if (university_action === 'match' && university_id) {
      // Fetch existing programs
      const { data: existing } = await supabase
        .from('vw_university_catalog')
        .select('*')
        .eq('university_id', university_id);

      for (const pr of parsed.programs || []) {
        const key = `${normalize(pr.level)}:${normalize(pr.name)}:${normalize(pr.study_language)}`;
        const match = (existing || []).find((e: any) =>
          `${normalize(e.level)}:${normalize(e.program_name)}:${normalize(e.study_language)}` === key
        );

        if (!match) {
          programs.push({ action: 'create', normalized_key: key, data: pr });
        } else {
          const diff: any = {};
          if ((match.tuition_per_year || null) !== (pr.tuition_per_year || null)) {
            diff.tuition_per_year = { from: match.tuition_per_year, to: pr.tuition_per_year };
          }
          if ((match.duration_semesters || null) !== (pr.duration_semesters || null)) {
            diff.duration_semesters = { from: match.duration_semesters, to: pr.duration_semesters };
          }

          const reqFrom = (match.requirements||"").split(" | ").filter(Boolean).sort().join("|");
          const reqTo = (pr.requirements||[]).map((r:any)=>`${r.type}:${r.value}`).sort().join("|");
          if (reqFrom!==reqTo) diff.requirements = { from: reqFrom, to: reqTo };

          const inFrom = (match.intakes||"").split(",").filter(Boolean).map(normalize).sort().join(",");
          const inTo = (pr.intakes||[]).map(normalize).sort().join(",");
          if (inFrom!==inTo) diff.intakes = { from: inFrom, to: inTo };

          if (Object.keys(diff).length > 0) {
            programs.push({ action: 'update', program_id: match.program_id, diff });
          } else {
            programs.push({ action: 'noop', program_id: match.program_id });
          }
        }
      }
    } else {
      // New university - all programs are new
      for (const pr of parsed.programs || []) {
        const key = `${normalize(pr.level)}:${normalize(pr.name)}:${normalize(pr.study_language)}`;
        programs.push({ action: 'create', normalized_key: key, data: pr });
      }
    }

    const diff = {
      university_action,
      university_id,
      programs,
      stats: {
        create: programs.filter(p => p.action === 'create').length,
        update: programs.filter(p => p.action === 'update').length,
        noop: programs.filter(p => p.action === 'noop').length
      }
    };

    // Save diff
    await supabase.from('ingest_artifacts').insert({
      job_id,
      kind: 'diff_json',
      content: diff
    });

    // Update job status
    await supabase.from('ingest_jobs').update({
      status: 'diff_ready'
    }).eq('id', job_id);

    // Log telemetry event
    await supabase.rpc('log_unis_event', {
      p_event_type: 'ingest_diff_ready',
      p_user_id: null,
      p_job_id: job_id,
      p_context: diff.stats
    });

    return new Response(
      JSON.stringify({ ok: true, diff }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in diff:', error);
    const msg = String((error as Error).message || error);
    const code = msg === "FORBIDDEN" ? 403 : (msg === "NO_AUTH" || msg === "INVALID_USER") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }
});
