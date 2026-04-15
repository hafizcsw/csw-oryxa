import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const g = await requireAdmin(req);
    if (!g.ok) {
      return new Response(JSON.stringify({ ok: false, error: g.error }), {
        status: g.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { recommendation } = body;

    if (!recommendation) {
      return new Response(
        JSON.stringify({ ok: false, error: 'recommendation required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert into admissions_consensus
    const consensusData = {
      university_id: recommendation.university_id,
      program_id: recommendation.program_id,
      degree_level: recommendation.degree_level,
      audience: recommendation.audience,
      consensus_min_gpa: recommendation.consensus_min_gpa,
      consensus_min_ielts: recommendation.consensus_min_ielts,
      consensus_min_toefl: recommendation.consensus_min_toefl,
      consensus_other_requirements: recommendation.consensus_other_requirements || [],
      confidence_score: recommendation.confidence_score,
      observations_count: recommendation.observations_count,
      is_stale: false,
      last_updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await g.srv
      .from('admissions_consensus')
      .upsert(consensusData, {
        onConflict: 'university_id,program_id,degree_level,audience'
      });

    if (upsertError) throw upsertError;

    // Log telemetry
    await g.srv.from('events').insert({
      name: 'admissions_consensus_accepted',
      visitor_id: 'admin',
      properties: {
        university_id: recommendation.university_id,
        program_id: recommendation.program_id,
        confidence: recommendation.confidence_score
      }
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[admissions-accept] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
