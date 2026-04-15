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
    const enabled = Deno.env.get('INTEGRATION_ENABLED') === 'true';
    const gw = Deno.env.get('WHATSAPP_GATEWAY_URL');
    const token = Deno.env.get('WHATSAPP_GATEWAY_TOKEN');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Fetch queued WhatsApp notifications
    const { data: items } = await supabase
      .from('notifications')
      .select('*')
      .eq('channel', 'whatsapp')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(25);

    let sent = 0;
    
    for (const n of (items || [])) {
      try {
        if (!enabled || !gw || !token) {
          // Mark as sent silently if integration is disabled (for dev/test)
          await supabase
            .from('notifications')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString() 
            })
            .eq('id', n.id);
          sent++;
          continue;
        }

        const res = await fetch(gw, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            to: n.payload?.phone,
            template: n.template_key,
            data: n.payload || {}
          })
        });

        if (res.ok) {
          await supabase
            .from('notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              last_error: null
            })
            .eq('id', n.id);
          sent++;
        } else {
          const err = await res.text();
          await supabase
            .from('notifications')
            .update({
              status: 'error',
              last_error: err.slice(0, 500)
            })
            .eq('id', n.id);
        }
      } catch (e) {
        await supabase
          .from('notifications')
          .update({
            status: 'error',
            last_error: String(e).slice(0, 500)
          })
          .eq('id', n.id);
      }
    }

    console.log(`[notify-whatsapp] Processed ${items?.length || 0} notifications, sent ${sent}`);

    return new Response(
      JSON.stringify({ ok: true, sent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[notify-whatsapp] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
