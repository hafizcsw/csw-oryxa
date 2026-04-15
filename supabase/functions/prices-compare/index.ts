import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAdmin(req);
  if (!authResult.ok) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { srv } = authResult;
  const url = new URL(req.url);
  const university_id = url.searchParams.get('university_id');
  const program_id = url.searchParams.get('program_id');

  if (!university_id && !program_id) {
    return new Response(
      JSON.stringify({ error: 'university_id or program_id required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Fetch price observations
    let obsQuery = srv.from('price_observations').select(`
      *,
      source_registry!inner(reliability_score, source_type)
    `);

    if (university_id) {
      obsQuery = obsQuery.eq('university_id', university_id);
    }
    if (program_id) {
      obsQuery = obsQuery.eq('program_id', program_id);
    }

    obsQuery = obsQuery.order('observed_at', { ascending: false });

    const { data: observations, error: obsError } = await obsQuery;
    if (obsError) throw obsError;

    // Group by university/program/degree_level/audience
    const groups: Record<string, any[]> = {};
    
    for (const obs of observations || []) {
      const key = `${obs.university_id}|${obs.program_id || 'null'}|${obs.degree_level || 'null'}|${obs.audience}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(obs);
    }

    // Calculate weighted consensus for each group
    const recommendations = [];

    for (const [key, obs] of Object.entries(groups)) {
      const [uni_id, prog_id, degree_level, audience] = key.split('|');

      // Weighted average: weight = confidence * reliability_score
      let totalWeight = 0;
      let weightedSum = 0;

      for (const o of obs) {
        const reliability = o.source_registry?.reliability_score || 0.8;
        const weight = (o.confidence || 0.7) * reliability;
        weightedSum += o.amount * weight;
        totalWeight += weight;
      }

      const consensus_amount = totalWeight > 0 ? weightedSum / totalWeight : 0;
      const confidence_score = totalWeight / obs.length; // normalized confidence

      recommendations.push({
        university_id: uni_id === 'null' ? null : uni_id,
        program_id: prog_id === 'null' ? null : prog_id,
        degree_level: degree_level === 'null' ? null : degree_level,
        audience: audience,
        consensus_amount: Math.round(consensus_amount * 100) / 100,
        currency_code: obs[0]?.currency_code || 'USD',
        confidence_score: Math.round(confidence_score * 100) / 100,
        observation_count: obs.length,
        observations: obs.map((o: any) => ({
          amount: o.amount,
          source_type: o.source_registry?.source_type,
          observed_at: o.observed_at,
          confidence: o.confidence,
        })),
      });
    }

    return new Response(
      JSON.stringify({ recommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[prices-compare] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
