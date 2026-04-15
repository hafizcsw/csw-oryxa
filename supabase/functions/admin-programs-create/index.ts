import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyAdminJWT, corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await verifyAdminJWT(req.headers.get('authorization'));
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { university_id, degree_id, degree_slug, title, description, languages, accepted_certificates, next_intake, duration_months, is_active } = body;

    if (!university_id || (!degree_id && !degree_slug) || !title) {
      return new Response(JSON.stringify({ error: 'university_id, (degree_id or degree_slug), and title are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // Get degree ID (accept either id or slug)
    let finalDegreeId = degree_id;
    if (!finalDegreeId && degree_slug) {
      const { data: degree, error: degreeError } = await supabase
        .from('degrees')
        .select('id')
        .eq('slug', degree_slug)
        .single();

      if (degreeError || !degree) {
        return new Response(JSON.stringify({ error: 'Invalid degree_slug' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      finalDegreeId = degree.id;
    }

    // Create program
    const { data, error } = await supabase
      .from('programs')
      .insert([{
        university_id,
        degree_id: finalDegreeId,
        title,
        description,
        languages: languages || ['EN'],
        accepted_certificates: accepted_certificates || [],
        next_intake,
        duration_months,
        is_active: is_active ?? true,
      }])
      .select()
      .single();

    if (error) {
      console.error('Create program error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, program: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
