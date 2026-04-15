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

  try {
    const body = await req.json();
    const { recommendation } = body;

    if (!recommendation || !recommendation.university_id) {
      return new Response(
        JSON.stringify({ error: 'Invalid recommendation data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert into tuition_consensus (non-destructive)
    const consensusData = {
      university_id: recommendation.university_id,
      program_id: recommendation.program_id || null,
      degree_level: recommendation.degree_level || null,
      audience: recommendation.audience || 'international',
      consensus_amount: recommendation.consensus_amount,
      currency_code: recommendation.currency_code || 'USD',
      confidence_score: recommendation.confidence_score,
      observation_count: recommendation.observation_count,
      last_updated_at: new Date().toISOString(),
      is_stale: false,
    };

    const { data, error } = await srv
      .from('tuition_consensus')
      .upsert(consensusData, {
        onConflict: 'university_id,program_id,degree_level,audience',
      })
      .select()
      .single();

    if (error) throw error;

    console.log('[prices-accept] Consensus accepted:', data.id);

    return new Response(
      JSON.stringify({ ok: true, consensus: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[prices-accept] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
