import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PORTAL_SITE_URL = Deno.env.get("PORTAL_SITE_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "0.0.0.0";
    const payload = await req.json();

    const { full_name, email, phone, country, program, utm_source, utm_campaign, utm_medium } = payload ?? {};
    
    if (!email) {
      return Response.json(
        { ok: false, error: "missing email" },
        { status: 400, headers: corsHeaders }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Create or update customer record
    const { data: customer, error: customerError } = await admin
      .from("customers")
      .upsert(
        {
          email: String(email).toLowerCase(),
          full_name: full_name ?? null,
          phone: phone ?? null,
          address_country: country ?? null,
          interested_program: program ?? null,
          utm_source: utm_source ?? null,
          utm_campaign: utm_campaign ?? null,
          utm_medium: utm_medium ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )
      .select("id,email")
      .single();

    if (customerError || !customer) {
      console.error("Customer upsert error:", customerError);
      return Response.json(
        { ok: false, error: "database operation failed" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Generate magic link for portal access
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: customer.email!,
      options: { 
        redirectTo: `${PORTAL_SITE_URL}/student-portal` 
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Magic link generation error:", linkError);
      return Response.json(
        { ok: false, error: "cannot generate access link" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Log the event
    await admin
      .from("events")
      .insert({
        name: "web_lead_capture",
        visitor_id: payload?.visitor_id || null,
        properties: {
          email,
          phone,
          program,
          ip,
          source: "website",
        },
      });
    
    // Ignore logging errors - non-critical

    console.log(`Lead captured: ${email} -> ${customer.id}`);

    return Response.json(
      {
        ok: true,
        action_link: linkData.properties.action_link,
        customer_id: customer.id,
      },
      { headers: corsHeaders }
    );
  } catch (e) {
    console.error("Error in web-lead-capture:", e);
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500, headers: corsHeaders }
    );
  }
});
