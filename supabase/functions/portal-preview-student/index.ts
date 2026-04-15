import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("PORTAL_SITE_URL") || Deno.env.get("PORTAL_ORIGIN")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    
    if (!token) {
      return Response.json(
        { ok: false, error: "missing jwt" }, 
        { status: 401, headers: corsHeaders }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    
    // Verify user from token
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) {
      return Response.json(
        { ok: false, error: "invalid jwt" }, 
        { status: 401, headers: corsHeaders }
      );
    }

    const uid = user.id;

    // Check if user is admin using the is_admin function
    const { data: isAdminResult, error: adminCheckError } = await admin
      .rpc("is_admin", { _user_id: uid });

    if (adminCheckError || !isAdminResult) {
      console.log("Admin check failed:", adminCheckError);
      return Response.json(
        { ok: false, error: "forbidden - admin access required" }, 
        { status: 403, headers: corsHeaders }
      );
    }

    // Get or create sandbox customer
    const { data: sandboxId, error: sandboxErr } = await admin
      .rpc("rpc_get_or_create_sandbox_customer_for_staff");

    if (sandboxErr || !sandboxId) {
      console.error("Sandbox creation error:", sandboxErr);
      return Response.json(
        { ok: false, error: "sandbox-failed" }, 
        { status: 500, headers: corsHeaders }
      );
    }

    // Create portal token
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const tokenValue = crypto.randomUUID();
    
    const { data: tokenData, error: tokenErr } = await admin
      .from("portal_tokens")
      .insert({
        token: tokenValue,
        profile_id: sandboxId,
        expires_at: expiresAt,
        consumed_at: null
      })
      .select("token")
      .single();

    if (tokenErr || !tokenData?.token) {
      console.error("Token creation error:", tokenErr);
      return Response.json(
        { ok: false, error: "token-insert-failed" }, 
        { status: 500, headers: corsHeaders }
      );
    }

    const portalUrl = `${SITE_URL}/portal/${tokenData.token}`;
    
    return Response.json(
      { ok: true, portal_url: portalUrl }, 
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error("Preview student error:", e);
    return Response.json(
      { ok: false, error: String(e) }, 
      { status: 500, headers: corsHeaders }
    );
  }
});
