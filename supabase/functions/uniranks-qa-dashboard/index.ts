import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Door 8: Evidence Pack automated collection
    const { count: draftCount } = await supabase
      .from('program_draft')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: evidenceCount } = await supabase
      .from('source_evidence')
      .select('*', { count: 'exact', head: true })
      .not('program_draft_id', 'is', null);

    // Count rejected titles (with garbage characters)
    const { data: rejectedTitles } = await supabase
      .from('program_draft')
      .select('title, missing_fields')
      .or('title.ilike.%#%,title.ilike.%)%,title.ilike.%(%')
      .limit(20);

    // Count extraction errors (from logs)
    const { data: extractionErrors } = await supabase
      .from('program_draft')
      .select('title, missing_fields')
      .filter('missing_fields', 'cs', '{"degree_id","discipline_id"}')
      .limit(20);

    // Quarantine query
    const { count: quarantineCount } = await supabase
      .from('program_quarantine')
      .select('*', { count: 'exact', head: true });

    // Problematic universities (city=NaN)
    const { data: badUniversities } = await supabase
      .from('universities')
      .select('id, name, city')
      .eq('city', 'NaN')
      .limit(10);

    return new Response(
      JSON.stringify({
        ok: true,
        evidence_pack: {
          draft_programs: draftCount || 0,
          evidence_rows: evidenceCount || 0,
          rejected_titles: rejectedTitles?.length || 0,
          extraction_errors: extractionErrors?.length || 0,
          quarantined_programs: quarantineCount || 0,
          bad_universities_count: badUniversities?.length || 0,
        },
        details: {
          sample_rejected_titles: rejectedTitles?.slice(0, 5).map(r => r.title),
          sample_bad_universities: badUniversities?.slice(0, 5).map(u => ({ id: u.id, name: u.name, city: u.city })),
        },
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[uniranks-qa-dashboard] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
