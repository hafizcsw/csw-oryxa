import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { program_ids } = await req.json();

    if (!program_ids || !Array.isArray(program_ids) || program_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'program_ids required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch program details
    const { data: programs, error } = await supabase
      .from('programs_view')
      .select('*')
      .in('program_id', program_ids);

    if (error) {
      console.error('Error fetching programs:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate simple PDF content (HTML to PDF conversion would require external service)
    // For now, return structured data that frontend can use with a PDF library
    const pdfData = {
      title: 'مقارنة البرامج',
      generated_at: new Date().toISOString(),
      programs: programs?.map(p => ({
        title: p.title,
        university: p.university_name,
        country: p.country_slug,
        degree: p.degree_slug,
        city: p.city,
        annual_fees: p.annual_fees,
        monthly_living: p.monthly_living,
        languages: p.languages,
        next_intake: p.next_intake
      }))
    };

    console.log('[export-shortlist-pdf] Generated data for', programs?.length || 0, 'programs');

    return new Response(
      JSON.stringify({ ok: true, data: pdfData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('export-shortlist-pdf error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
