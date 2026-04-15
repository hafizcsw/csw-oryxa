import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { scope = 'fees' } = await req.json();

    console.log(`[golden-set-test] Starting test for scope: ${scope}`);

    const { data: golden, error: goldenError } = await supabase
      .from('golden_universities')
      .select('university_id, verified_data');

    if (goldenError) throw goldenError;

    if (!golden || golden.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No golden set defined' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let correctCount = 0;
    const details: any[] = [];

    for (const g of golden) {
      const verifiedFees = g.verified_data?.fees;
      if (scope === 'fees' && verifiedFees) {
        const { data: consensus } = await supabase
          .from('tuition_consensus')
          .select('final_amount_usd, final_currency')
          .eq('university_id', g.university_id)
          .order('calculated_at', { ascending: false })
          .limit(1)
          .single();

        const expectedUSD = verifiedFees.amount_usd;
        const actualUSD = consensus?.final_amount_usd;

        const diff = actualUSD ? Math.abs(actualUSD - expectedUSD) / expectedUSD : 1;
        const isCorrect = diff <= 0.10;

        if (isCorrect) correctCount++;

        details.push({
          university_id: g.university_id,
          expected: expectedUSD,
          actual: actualUSD,
          diff: diff.toFixed(3),
          correct: isCorrect
        });
      }
    }

    const total = details.length;
    const precision = total > 0 ? correctCount / total : 0;

    const testRun = {
      scope,
      total_tested: total,
      correct_count: correctCount,
      precision,
      recall: precision,
      details,
      passed: precision >= 0.85
    };

    await supabase.from('quality_test_runs').insert(testRun);

    console.log(`[golden-set-test] Completed: ${correctCount}/${total} correct (${(precision * 100).toFixed(1)}%)`);

    return new Response(
      JSON.stringify({ ok: true, test_run: testRun }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[golden-set-test] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
