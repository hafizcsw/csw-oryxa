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

    const url = new URL(req.url);
    const university_id = url.searchParams.get('university_id');
    const program_id = url.searchParams.get('program_id');

    if (!university_id && !program_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'university_id or program_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch observations
    let query = g.srv
      .from('admissions_observations')
      .select('*');

    if (university_id) {
      query = query.eq('university_id', university_id);
    }
    if (program_id) {
      query = query.eq('program_id', program_id);
    }

    const { data: observations, error: obsError } = await query;
    if (obsError) throw obsError;

    // Group by university/program/degree/audience
    const groups: Record<string, any[]> = {};
    for (const obs of observations || []) {
      const key = `${obs.university_id}_${obs.program_id}_${obs.degree_level}_${obs.audience}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(obs);
    }

    // Calculate weighted consensus for each group
    const recommendations = [];
    for (const [key, groupObs] of Object.entries(groups)) {
      const [uni_id, prog_id, degree, aud] = key.split('_');
      
      let totalWeight = 0;
      let weightedGpa = 0;
      let weightedIelts = 0;
      let weightedToefl = 0;
      const allRequirements: any[] = [];

      for (const obs of groupObs) {
        const sourceReliability = 0.7; // Default reliability since we don't have source_registry
        const weight = obs.confidence * sourceReliability;
        totalWeight += weight;

        if (obs.min_gpa) weightedGpa += obs.min_gpa * weight;
        if (obs.min_ielts) weightedIelts += obs.min_ielts * weight;
        if (obs.min_toefl) weightedToefl += obs.min_toefl * weight;
        if (obs.other_requirements) {
          allRequirements.push(...(obs.other_requirements as any[]));
        }
      }

      const consensusGpa = totalWeight > 0 ? weightedGpa / totalWeight : null;
      const consensusIelts = totalWeight > 0 ? weightedIelts / totalWeight : null;
      const consensusToefl = totalWeight > 0 ? Math.round(weightedToefl / totalWeight) : null;
      const confidenceScore = Math.min(totalWeight / groupObs.length, 1.0);

      recommendations.push({
        university_id: uni_id,
        program_id: prog_id,
        degree_level: degree,
        audience: aud,
        consensus_min_gpa: consensusGpa,
        consensus_min_ielts: consensusIelts,
        consensus_min_toefl: consensusToefl,
        consensus_other_requirements: allRequirements,
        confidence_score: confidenceScore,
        observations_count: groupObs.length,
        observations: groupObs.map(o => ({
          id: o.id,
          min_gpa: o.min_gpa,
          min_ielts: o.min_ielts,
          min_toefl: o.min_toefl,
          other_requirements: o.other_requirements,
          confidence: o.confidence,
          source_reliability: 0.7,
          observed_at: o.observed_at
        }))
      });
    }

    return new Response(
      JSON.stringify({ ok: true, recommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[admissions-compare] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
