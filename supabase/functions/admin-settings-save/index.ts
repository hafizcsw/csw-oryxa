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

    const body = await req.json();
    const rows = (body.settings || []).map((x: any) => ({ 
      key: x.key, 
      value: x.value,
      updated_at: new Date().toISOString()
    }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'No settings provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { error } = await g.srv.from("feature_settings").upsert(rows, {
      onConflict: 'key'
    });

    if (error) {
      console.error("[admin-settings-save] Error:", error);
      return new Response(JSON.stringify({ ok: false, error: String(error) }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[admin-settings-save] Saved ${rows.length} settings successfully`);
    
    return new Response(JSON.stringify({ 
      ok: true, 
      saved: rows.length,
      message: `تم حفظ ${rows.length} إعداد بنجاح`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("[admin-settings-save] Exception:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
