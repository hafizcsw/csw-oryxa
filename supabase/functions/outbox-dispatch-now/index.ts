import { requireAdmin } from "../_shared/adminGuard.ts";

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

    // Check for super_admin role specifically
    const { data: userRoles } = await g.srv
      .from('user_roles')
      .select('role')
      .eq('user_id', g.user.id);
    
    if (!userRoles?.some(r => r.role === 'super_admin')) {
      return new Response(JSON.stringify({ ok: false, error: 'forbidden: super_admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get pending items
    const { data: pending, error: fetchError } = await g.srv
      .from('integration_outbox')
      .select('*')
      .eq('status', 'pending')
      .limit(50);

    if (fetchError) throw fetchError;

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const item of pending || []) {
      processed++;
      try {
        // Simulate dispatch (replace with actual CRM call)
        console.log(`[Dispatch] ${item.event_type} to ${item.target}`, item.payload);
        
        // Mark as sent
        await g.srv
          .from('integration_outbox')
          .update({ status: 'sent' })
          .eq('id', item.id);
        
        sent++;
      } catch (e: any) {
        console.error(`[Dispatch] Failed for ${item.id}:`, e);
        await g.srv
          .from('integration_outbox')
          .update({ 
            status: 'error', 
            last_error: String(e),
            attempts: item.attempts + 1
          })
          .eq('id', item.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("[outbox-dispatch-now] Error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
