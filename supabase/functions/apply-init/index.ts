import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApplyPayload {
  visitor_id: string;
  full_name: string;
  email: string;
  phone: string;
  country_slug?: string;
  degree_slug?: string;
  language?: string;
  budget_fees?: number;
  budget_living?: number;
  program_ids: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const payload: ApplyPayload = await req.json();
    console.log('[apply-init] Received:', { 
      visitor_id: payload.visitor_id, 
      programs: payload.program_ids?.length 
    });

    // Check if site is in read-only mode
    const { data: settingsData } = await supabase
      .from('settings')
      .select('site_readonly')
      .eq('id', true)
      .single();

    if (settingsData?.site_readonly) {
      return new Response(
        JSON.stringify({ error: 'System is under maintenance. Please try again later.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate
    if (!payload.visitor_id || !payload.full_name || !payload.email || !payload.phone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check daily application limit (max 3 per day per visitor)
    const { data: recentApps } = await supabase
      .from('applications')
      .select('id')
      .eq('visitor_id', payload.visitor_id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (recentApps && recentApps.length >= 3) {
      return new Response(
        JSON.stringify({ error: 'Daily application limit reached. Please try again tomorrow.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.program_ids || payload.program_ids.length === 0 || payload.program_ids.length > 5) {
      return new Response(
        JSON.stringify({ error: 'Select 1-5 programs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Link phone to visitor
    if (payload.phone) {
      await supabase
        .from('phone_identities')
        .upsert({ 
          phone: payload.phone,
          visitor_id: payload.visitor_id
        }, { 
          onConflict: 'phone' 
        });
    }

    // Create application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        visitor_id: payload.visitor_id,
        full_name: payload.full_name,
        email: payload.email,
        phone: payload.phone,
        country_slug: payload.country_slug,
        degree_slug: payload.degree_slug,
        language: payload.language,
        budget_fees: payload.budget_fees,
        budget_living: payload.budget_living,
        source: 'web',
        status: 'new'
      })
      .select()
      .single();

    if (appError) {
      console.error('[apply-init] Application insert error:', appError);
      throw appError;
    }

    console.log('[apply-init] Created application:', application.id);

    // Link programs
    const programLinks = payload.program_ids.map(pid => ({
      application_id: application.id,
      program_id: pid
    }));

    const { error: progError } = await supabase
      .from('application_programs')
      .insert(programLinks);

    if (progError) {
      console.error('[apply-init] Programs link error:', progError);
    }

    // Create integration event for CRM
    const now = new Date();
    const dateHour = `${now.toISOString().split('T')[0]}_${now.getHours()}`;
    const idempotencyKey = `apply:${payload.visitor_id}:${dateHour}`;

    await supabase
      .from('integration_events')
      .insert({
        event_name: 'application.requested',
        target: 'crm',
        payload: {
          application_id: application.id,
          visitor_id: payload.visitor_id,
          full_name: payload.full_name,
          email: payload.email,
          phone: payload.phone,
          program_count: payload.program_ids.length,
          country: payload.country_slug,
          degree: payload.degree_slug
        },
        idempotency_key: idempotencyKey,
        status: 'queued'
      });

    console.log('[apply-init] Integration event queued:', idempotencyKey);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        application_id: application.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[apply-init] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
