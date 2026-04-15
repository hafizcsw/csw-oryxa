import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
  const status = url.searchParams.get('status') || 'draft';
  const university_id = url.searchParams.get('university_id');
  const country_code = url.searchParams.get('country_code');

  try {
    let query = srv.from('scholarships').select(`
      *,
      universities (
        id,
        name,
        logo_url,
        country_id
      )
    `);

    if (status) {
      query = query.eq('status', status);
    }

    if (university_id) {
      query = query.eq('university_id', university_id);
    }

    if (country_code) {
      query = query.eq('country_code', country_code);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return new Response(
      JSON.stringify({ scholarships: data || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[admin-scholarships-list] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
