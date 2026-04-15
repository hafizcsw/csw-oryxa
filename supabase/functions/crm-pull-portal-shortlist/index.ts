import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = `pull_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const safeId = (id?: string | null) => (id ? `${id.slice(0, 6)}…${id.slice(-6)}` : 'null');
  console.log(`[crm-pull-portal-shortlist] ${requestId} START`);

  try {
    const { customer_id } = await req.json();

    if (!customer_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "customer_id مطلوب", request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Portal Supabase client (for reading user_shortlists + vw_program_search)
    const portalClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // CRM Supabase client (for reading customers + writing shortlist)
    const crmClient = createClient(
      Deno.env.get("CRM_URL")!,
      Deno.env.get("CRM_SERVICE_ROLE_KEY")!
    );

    // 1) Verify staff authentication
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      console.log(`[crm-pull-portal-shortlist] ${requestId} - No auth token`);
      return new Response(
        JSON.stringify({ ok: false, error: "غير مصرح", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user in Portal
    const { data: { user } } = await portalClient.auth.getUser(token);
    if (!user) {
      console.log(`[crm-pull-portal-shortlist] ${requestId} - Invalid token`);
      return new Response(
        JSON.stringify({ ok: false, error: "غير مصرح", request_id: requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is staff
    const { data: staff } = await portalClient
      .from("staff")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!staff) {
      console.log(`[crm-pull-portal-shortlist] ${requestId} - Not staff: ${user.id}`);
      return new Response(
        JSON.stringify({ ok: false, error: "صلاحيات غير كافية", request_id: requestId }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[crm-pull-portal-shortlist] ${requestId} - Staff verified: ${user.id}, role: ${staff.role}`);

    // 2) Get customer info from CRM (including auth_user_id)
    const { data: customer, error: custError } = await crmClient
      .from("customers")
      .select("id, auth_user_id, full_name")
      .eq("id", customer_id)
      .single();

    if (custError || !customer) {
      console.error(`[crm-pull-portal-shortlist] ${requestId} - Customer not found:`, custError);
      return new Response(
        JSON.stringify({ ok: false, error: "العميل غير موجود", request_id: requestId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!customer.auth_user_id) {
      console.log(`[crm-pull-portal-shortlist] ${requestId} - Customer has no Portal account`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "no_portal_account",
          message: "هذا العميل ليس لديه حساب في البورتال",
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[crm-pull-portal-shortlist] ${requestId} customer_id=${safeId(customer_id)} auth_user_id=${safeId(customer.auth_user_id)} name=${customer.full_name}`);

    // 3) Read shortlist from Portal (user_shortlists table)
    const { data: shortlistItems, error: shortlistError } = await portalClient
      .from("user_shortlists")
      .select("program_id, created_at")
      .eq("user_id", customer.auth_user_id);

    if (shortlistError) {
      console.error(`[crm-pull-portal-shortlist] ${requestId} - Shortlist read error:`, shortlistError);
      return new Response(
        JSON.stringify({ ok: false, error: shortlistError.message, request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shortlistItems || shortlistItems.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`[crm-pull-portal-shortlist] ${requestId} - No favorites found`);
      return new Response(
        JSON.stringify({
          ok: true,
          synced: 0,
          enriched: 0,
          total: 0,
          programs: [],
          message: "لا توجد برامج مفضلة في حساب الطالب",
          duration_ms: duration,
          request_id: requestId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const programIds = shortlistItems.map((item) => item.program_id);
    console.log(`[crm-pull-portal-shortlist] ${requestId} portal_count=${programIds.length}`);

    // 4) Enrich from Portal KB (vw_program_search)
    const { data: programs, error: enrichError } = await portalClient
      .from("vw_program_search")
      .select(`
        program_id,
        program_name_en,
        program_name_ar,
        program_slug,
        university_id,
        university_name_en,
        university_name_ar,
        university_slug,
        country_id,
        country_name_en,
        country_name_ar,
        country_code,
        degree_level,
        language,
        duration_months,
        tuition_usd_min,
        tuition_usd_max,
        ranking_global,
        logo_url
      `)
      .in("program_id", programIds);

    if (enrichError) {
      console.error(`[crm-pull-portal-shortlist] ${requestId} - Enrichment error:`, enrichError);
      // Continue without enrichment - use program_ids only
    }

    // Build enriched program map
    const programMap = new Map<string, Record<string, unknown>>();
    if (programs) {
      for (const prog of programs) {
        programMap.set(prog.program_id, prog);
      }
    }

    console.log(`[crm-pull-portal-shortlist] ${requestId} enriched_count=${programMap.size}/${programIds.length}`);

    // 5) Build snapshots for CRM sync
    const portalBaseUrl = Deno.env.get("PORTAL_SITE_URL") || "https://lavista-launchpad.lovable.app";
    const syncItems: Array<{ program_ref_id: string; snapshot: Record<string, unknown> }> = [];

    for (const item of shortlistItems) {
      const enriched = programMap.get(item.program_id);
      const portalUrl = enriched?.program_slug
        ? `${portalBaseUrl}/programs/${enriched.program_slug}`
        : `${portalBaseUrl}/programs/${item.program_id}`;

      const snapshot: Record<string, unknown> = {
        program_name_en: enriched?.program_name_en || null,
        program_name_ar: enriched?.program_name_ar || null,
        university_name_en: enriched?.university_name_en || null,
        university_name_ar: enriched?.university_name_ar || null,
        country_name_en: enriched?.country_name_en || null,
        country_name_ar: enriched?.country_name_ar || null,
        country_code: enriched?.country_code || null,
        degree_level: enriched?.degree_level || null,
        language: enriched?.language || null,
        duration_months: enriched?.duration_months || null,
        tuition_usd_min: enriched?.tuition_usd_min || null,
        tuition_usd_max: enriched?.tuition_usd_max || null,
        ranking_global: enriched?.ranking_global || null,
        logo_url: enriched?.logo_url || null,
        portal_url: portalUrl,
        synced_at: new Date().toISOString(),
        synced_by: "crm-pull-portal-shortlist",
        added_at_portal: item.created_at,
      };

      syncItems.push({
        program_ref_id: item.program_id,
        snapshot,
      });
    }

    // 6) Sync to CRM via rpc_sync_student_shortlist_from_portal_v2
    const rpcName = 'rpc_sync_student_shortlist_from_portal_v2';
    console.log(`[crm-pull-portal-shortlist] ${requestId} rpc_start name=${rpcName} keys=[p_auth_user_id,p_items]`);
    const rpcT0 = Date.now();
    
    const { data: syncResult, error: syncError } = await crmClient.rpc(
      rpcName,
      {
        p_auth_user_id: customer.auth_user_id,
        p_items: syncItems,
      }
    );
    
    const rpcDuration = Date.now() - rpcT0;
    console.log(`[crm-pull-portal-shortlist] ${requestId} rpc_done name=${rpcName} ok=${!syncError} ms=${rpcDuration}${syncError ? ` err=${syncError.message}` : ''}`);

    if (syncError) {
      console.error(`[crm-pull-portal-shortlist] ${requestId} - CRM sync error:`, syncError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "crm_sync_failed",
          message: syncError.message,
          request_id: requestId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[crm-pull-portal-shortlist] ${requestId} COMPLETE synced=${syncItems.length} duration_ms=${duration}`);

    // 7) Return response with enriched programs for UI display
    const responsePrograms = syncItems.map((item) => ({
      program_id: item.program_ref_id,
      program_name_en: item.snapshot.program_name_en,
      program_name_ar: item.snapshot.program_name_ar,
      university_name_en: item.snapshot.university_name_en,
      university_name_ar: item.snapshot.university_name_ar,
      country_name_ar: item.snapshot.country_name_ar,
      degree_level: item.snapshot.degree_level,
      portal_url: item.snapshot.portal_url,
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        synced: syncItems.length,
        enriched: programMap.size,
        total: shortlistItems.length,
        programs: responsePrograms,
        sync_result: syncResult,
        message: `تم مزامنة ${syncItems.length} برنامج من البورتال`,
        duration_ms: duration,
        request_id: requestId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error(`[crm-pull-portal-shortlist] ${requestId} - Error:`, e);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage, duration_ms: duration, request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
