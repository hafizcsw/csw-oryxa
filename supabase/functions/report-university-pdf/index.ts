import { requireAdmin } from "../_shared/adminGuard.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    if (!university_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'university_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch university data
    const { data: university, error: uniError } = await g.srv
      .from('universities')
      .select('*')
      .eq('id', university_id)
      .single();

    if (uniError || !university) {
      throw new Error('University not found');
    }

    // Fetch programs
    const { data: programs } = await g.srv
      .from('programs')
      .select('*')
      .eq('university_id', university_id);

    // Fetch tuition consensus
    const { data: tuition } = await g.srv
      .from('tuition_consensus')
      .select('*')
      .eq('university_id', university_id)
      .order('academic_year', { ascending: false })
      .limit(1)
      .single();

    // Generate simple text-based PDF content (simplified version)
    // In production, you'd use pdf-lib or similar library
    const pdfContent = `
University Report
=================

Name: ${university.name}
City: ${university.city}
Ranking: ${university.ranking || 'N/A'}

Programs: ${programs?.length || 0}
${programs?.map((p: any) => `- ${p.title} (${p.degree_id})`).join('\n') || 'None'}

Tuition:
${tuition ? `${tuition.consensus_amount} ${tuition.currency} (${tuition.academic_year})` : 'N/A'}

Generated: ${new Date().toISOString()}
    `.trim();

    // Convert to blob (in production, generate actual PDF)
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const arrayBuffer = await blob.arrayBuffer();

    // Upload to Supabase Storage
    const fileName = `university-${university_id}-${Date.now()}.txt`;
    const { data: uploadData, error: uploadError } = await g.srv
      .storage
      .from('reports')
      .upload(fileName, arrayBuffer, {
        contentType: 'text/plain',
        upsert: false
      });

    if (uploadError) {
      console.error('[report-university-pdf] Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = g.srv
      .storage
      .from('reports')
      .getPublicUrl(fileName);

    // Log telemetry
    await g.srv.from('events').insert({
      name: 'report_university_pdf_generated',
      visitor_id: 'admin',
      properties: {
        university_id,
        file_name: fileName,
        programs_count: programs?.length || 0
      }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        url: urlData.publicUrl,
        file_name: fileName 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[report-university-pdf] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
