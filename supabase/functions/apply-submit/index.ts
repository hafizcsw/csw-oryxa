import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { 
      full_name, 
      email, 
      phone = null, 
      country_slug = null, 
      notes = null, 
      universities = [], 
      programs = [], 
      student_id = null 
    } = await req.json();

    if (!full_name || !email) {
      throw new Error("Missing required fields: full_name and email");
    }

    console.log(`[apply-submit] Creating application for ${email}`);

    // 1) أنشئ طلب التقديم
    const { data: app, error } = await supabase
      .from("applications")
      .insert({
        full_name,
        email,
        phone,
        country_slug,
        notes,
        user_id: student_id
      })
      .select("id")
      .single();

    if (error) throw error;

    console.log(`[apply-submit] Created application: ${app.id}`);

    // 2) عناصر الطلب (جامعات/برامج)
    const items: any[] = [];
    
    for (const u of (universities || [])) {
      items.push({ 
        application_id: app.id, 
        university_id: u, 
        program_id: null 
      });
    }
    
    for (const p of (programs || [])) {
      items.push({ 
        application_id: app.id, 
        university_id: p.university_id, 
        program_id: p.program_id 
      });
    }

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("application_items")
        .insert(items);
      
      if (itemsError) throw itemsError;
      
      console.log(`[apply-submit] Added ${items.length} items to application`);
    }

    // Check if CRM integration is enabled and queue event
    const { data: crmSettings } = await supabase
      .from('feature_settings')
      .select('value')
      .eq('key', 'crm_enabled')
      .maybeSingle();

    if (crmSettings?.value?.enabled === true) {
      const { error: outboxError } = await supabase.from('integration_outbox').insert({
        event_type: 'application.created',
        payload: {
          application_id: app.id,
          full_name,
          email,
          phone,
          country_slug,
          notes,
          universities,
          programs,
          created_at: new Date().toISOString()
        }
      });
      
      if (!outboxError) {
        console.log(`[apply-submit] Queued CRM event for application ${app.id}`);
      } else {
        console.warn(`[apply-submit] Failed to queue CRM event:`, outboxError);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, application_id: app.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error("[apply-submit] Error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
