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
    const { id, degree_id, degree_slug, ...updates } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();
    let finalUpdates = { ...updates };

    // If degree_id or degree_slug provided, resolve to degree_id
    if (degree_id) {
      finalUpdates.degree_id = degree_id;
    } else if (degree_slug) {
      const { data: degree } = await supabase
        .from('degrees')
        .select('id')
        .eq('slug', degree_slug)
        .single();

      if (degree) {
        finalUpdates.degree_id = degree.id;
      }
    }

    const { data, error } = await supabase
      .from('programs')
      .update(finalUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update program error:', error);
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
