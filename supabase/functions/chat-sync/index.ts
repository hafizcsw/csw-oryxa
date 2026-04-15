import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRM_FUNCTIONS_URL = Deno.env.get('CRM_FUNCTIONS_URL');
const CRM_API_KEY = Deno.env.get('CRM_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, visitor_id, user_id } = await req.json();

    console.log('[chat-sync] Syncing chat session:', { session_id, visitor_id, user_id });

    if (!session_id || !visitor_id) {
      return new Response(
        JSON.stringify({ error: 'session_id and visitor_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // مزامنة مع CRM
    if (CRM_FUNCTIONS_URL && CRM_API_KEY) {
      try {
        const response = await fetch(`${CRM_FUNCTIONS_URL}/web-sync-conversation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': CRM_API_KEY,
          },
          body: JSON.stringify({
            web_user_id: user_id,
            visitor_id,
            session_id,
            channel: 'web',
            status: 'active',
          }),
        });

        if (!response.ok) {
          console.error('[chat-sync] CRM sync failed:', await response.text());
        } else {
          console.log('[chat-sync] CRM sync successful');
        }
      } catch (error) {
        console.error('[chat-sync] CRM sync error:', error);
      }
    } else {
      console.warn('[chat-sync] CRM credentials not configured');
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[chat-sync] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
