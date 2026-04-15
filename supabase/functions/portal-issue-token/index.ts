import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PORTAL_ORIGIN = Deno.env.get("PORTAL_ORIGIN") || Deno.env.get("PORTAL_SITE_URL")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!jwt) {
      return Response.json({ ok: false, error: 'missing jwt' }, { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Decode JWT to get user ID
    const user = JSON.parse(atob(jwt.split('.')[1] || 'e30='));
    const uid = user?.sub;
    
    if (!uid) {
      return Response.json({ ok: false, error: 'invalid jwt' }, { 
        status: 401,
        headers: corsHeaders
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    
    // Check if user is admin
    const { data: isAdminData } = await admin.rpc('is_admin', { _user_id: uid });
    
    if (!isAdminData) {
      return Response.json({ ok: false, error: 'forbidden' }, { 
        status: 403,
        headers: corsHeaders 
      });
    }

    const { profile_id, ttl_hours = 72 } = await req.json();
    
    if (!profile_id) {
      return Response.json({ ok: false, error: 'profile_id required' }, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const expires = new Date(Date.now() + Number(ttl_hours) * 3600 * 1000).toISOString();

    const { data: inserted, error: insErr } = await admin
      .from('portal_tokens')
      .insert({ 
        profile_id, 
        issued_by: uid, 
        expires_at: expires 
      })
      .select('token')
      .single();

    if (insErr || !inserted?.token) {
      console.error('Token insert error:', insErr);
      return Response.json({ ok: false, error: 'token-insert-failed' }, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const portal_url = `${PORTAL_ORIGIN}/portal/${inserted.token}`;
    
    return Response.json({ ok: true, portal_url }, { headers: corsHeaders });
  } catch (e) {
    console.error('Portal token error:', e);
    return Response.json({ ok: false, error: String(e) }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
