import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { program_ids } = await req.json();

    if (!program_ids || !Array.isArray(program_ids)) {
      return new Response(
        JSON.stringify({ error: 'program_ids array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 50 items
    const limited = program_ids.slice(0, 50);

    // Delete all existing shortlist items for user
    await supabase
      .from('user_shortlists')
      .delete()
      .eq('user_id', user.id);

    // Insert new items
    if (limited.length > 0) {
      const items = limited.map(pid => ({
        user_id: user.id,
        program_id: pid
      }));

      const { error: insertError } = await supabase
        .from('user_shortlists')
        .insert(items);

      if (insertError) throw insertError;
    }

    // Log integration event
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await adminClient
      .from('integration_events')
      .insert({
        event_name: 'shortlist.synced',
        target: 'crm',
        payload: {
          user_id: user.id,
          count: limited.length
        },
        idempotency_key: `shortlist_sync:${user.id}:${Date.now()}`,
        status: 'queued'
      });

    console.log('[shortlist-sync] Synced shortlist:', { user_id: user.id, count: limited.length });

    return new Response(
      JSON.stringify({ ok: true, count: limited.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[shortlist-sync] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
