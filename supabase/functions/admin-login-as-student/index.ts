import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type"
      }
    });
  }

  try {
    // Verify admin
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return new Response(
        JSON.stringify({ error: adminCheck.error }),
        { 
          status: adminCheck.status,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    const { srv } = adminCheck;
    const body = await req.json();
    const { user_email, user_id } = body;

    if (!user_email && !user_id) {
      return new Response(
        JSON.stringify({ error: "user_email or user_id required" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Get user by email or ID
    let targetUserId = user_id;
    
    if (!targetUserId && user_email) {
      const { data: profile } = await srv
        .from("profiles")
        .select("user_id")
        .eq("email", user_email)
        .single();
      
      if (!profile) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
      targetUserId = profile.user_id;
    }

    // Generate magic link using admin API
    const { data: linkData, error: linkErr } = await srv.auth.admin.generateLink({
      type: "magiclink",
      email: user_email || "",
      options: {
        redirectTo: `${Deno.env.get("PORTAL_SITE_URL") || "https://portal.yourdomain.com"}/student-portal`
      }
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("Magic link generation error:", linkErr);
      return new Response(
        JSON.stringify({ error: "Failed to generate login link" }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Log admin action
    const { error: auditError } = await srv.from("admin_audit").insert({
      admin_id: adminCheck.user.id,
      action: "LOGIN_AS_STUDENT",
      table_name: "auth.users",
      row_key: targetUserId,
      diff: { user_email, user_id: targetUserId }
    });
    
    if (auditError) {
      console.error("Audit log error:", auditError);
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        login_url: linkData.properties.action_link 
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("Admin login-as error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
