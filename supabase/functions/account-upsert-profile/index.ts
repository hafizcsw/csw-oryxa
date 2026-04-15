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

    const { full_name, phone, email } = await req.json();

    // Check if this is first time profile creation
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    const isNewProfile = !existingProfile;

    // Upsert profile
    const { error: upsertError } = await adminClient
      .from('profiles')
      .upsert({
        user_id: user.id,
        full_name: full_name || null,
        phone: phone || null,
        email: email || user.email || null
      });

    if (upsertError) throw upsertError;

    // If new profile, create integration event
    if (isNewProfile) {
      await adminClient
        .from('integration_events')
        .insert({
          event_name: 'user.created',
          target: 'crm',
          payload: {
            user_id: user.id,
            email: email || user.email,
            phone: phone || null,
            full_name: full_name || null
          },
          idempotency_key: `user_created:${user.id}`,
          status: 'queued'
        });

      console.log('[account-upsert-profile] New user created:', user.id);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[account-upsert-profile] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
