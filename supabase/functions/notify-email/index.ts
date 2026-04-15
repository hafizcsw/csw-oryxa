import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const enabled = Deno.env.get("INTEGRATION_ENABLED") === "true";
    const emailProvider = Deno.env.get("EMAIL_PROVIDER_URL");
    const emailToken = Deno.env.get("EMAIL_PROVIDER_TOKEN");
    const supabase = getSupabaseAdmin();

    console.log('[notify-email] Starting email notification processing');

    // Fetch queued email notifications
    const { data: items } = await supabase
      .from("notifications")
      .select("*")
      .eq("channel", "email")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(25);

    let sent = 0;
    for (const n of (items || [])) {
      try {
        if (!enabled || !emailProvider || !emailToken) {
          // Dry-run mode: mark as sent without actually sending
          await supabase
            .from("notifications")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", n.id);
          sent++;
          console.log(`[notify-email] Dry-run: ${n.id}`);
          continue;
        }

        // Production: send via email provider
        const emailPayload = {
          to: n.payload?.email,
          subject: n.subject || n.template_key,
          body: n.payload?.body || '',
          template: n.template_key,
          data: n.payload || {}
        };

        const res = await fetch(emailProvider, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${emailToken}`
          },
          body: JSON.stringify(emailPayload)
        });

        if (res.ok) {
          await supabase
            .from("notifications")
            .update({ 
              status: "sent", 
              sent_at: new Date().toISOString(), 
              last_error: null 
            })
            .eq("id", n.id);
          sent++;
          console.log(`[notify-email] Sent: ${n.id}`);
        } else {
          const err = await res.text();
          await supabase
            .from("notifications")
            .update({ 
              status: "error", 
              last_error: err.slice(0, 500) 
            })
            .eq("id", n.id);
          console.error(`[notify-email] Error sending ${n.id}:`, err);
        }
      } catch (e) {
        await supabase
          .from("notifications")
          .update({ 
            status: "error", 
            last_error: String(e).slice(0, 500) 
          })
          .eq("id", n.id);
        console.error(`[notify-email] Exception for ${n.id}:`, e);
      }
    }

    console.log(`[notify-email] Processed ${items?.length || 0} notifications, sent ${sent}`);

    return new Response(
      JSON.stringify({ ok: true, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error('[notify-email] Error:', e);
    return new Response(
      JSON.stringify({ error: "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
