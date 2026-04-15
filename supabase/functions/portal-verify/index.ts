import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CRM Project URLs - Portal acts as proxy
const CRM_FUNCTIONS_URL = Deno.env.get("CRM_FUNCTIONS_URL") || "https://hlrkyoxwbjsgqbncgzpi.supabase.co/functions/v1";
const CRM_SUPABASE_URL = Deno.env.get("CRM_SUPABASE_URL") || Deno.env.get("CRM_URL") || "https://hlrkyoxwbjsgqbncgzpi.supabase.co";
const CRM_API_KEY = Deno.env.get("CRM_API_KEY") || "";
const CRM_SERVICE_ROLE_KEY = Deno.env.get("CRM_SERVICE_ROLE_KEY") || "";
const PORTAL_SITE_URL = Deno.env.get("PORTAL_SITE_URL") || Deno.env.get("PORTAL_ORIGIN") || "https://cswworld.com";

// ✅ SECURITY: Allowlist of permitted origins (prevents Open Redirect attacks)
const ALLOWED_ORIGINS = [
  // ✅ Canonical domain (primary)
  'https://cswworld.com',
  'https://www.cswworld.com',
  // Legacy lovable domains (for transition/dev)
  'https://bmditidkhlbszhvkrnau.lovableproject.com',
  'https://lavista-launchpad.lovable.app',
  // Local development
  'http://localhost:5173',
  'http://localhost:8080',
  // Allow additional origins from environment variable (comma-separated)
  ...(Deno.env.get('ALLOWED_PORTAL_ORIGINS')?.split(',').map(o => o.trim()).filter(Boolean) || [])
];

/**
 * ✅ SECURITY: Resolve portal origin with allowlist validation
 * Priority: headers (most secure) → body (if allowed) → fallback
 */
function resolvePortalOrigin(req: Request, body: any): string {
  const fallback = PORTAL_SITE_URL;
  
  // 1) Check headers first (most trustworthy)
  const headerOrigin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const refererOrigin = referer ? (() => {
    try { return new URL(referer).origin; } catch { return null; }
  })() : null;
  
  // 2) Get body.portal_origin (least trustworthy)
  const bodyOrigin = body?.portal_origin;
  
  // Check candidates in priority order
  const candidates = [headerOrigin, refererOrigin, bodyOrigin].filter(Boolean);
  
  for (const candidate of candidates) {
    if (candidate && ALLOWED_ORIGINS.some(allowed => 
      candidate === allowed || candidate.startsWith(allowed)
    )) {
      console.log('[portal-verify] ✅ Resolved origin:', candidate);
      return candidate;
    }
  }
  
  console.warn('[portal-verify] ⚠️ No allowed origin matched, using fallback:', fallback);
  console.warn('[portal-verify] Candidates were:', { headerOrigin, refererOrigin, bodyOrigin });
  return fallback;
}

/**
 * ✅ SECURITY: Sanitize returnTo to prevent external redirects and XSS
 * Only allows internal paths starting with /
 */
function sanitizeReturnTo(returnTo: string | undefined): string {
  const defaultPath = '/account';
  
  if (!returnTo) return defaultPath;
  
  // Must be a string, start with /, not start with //, not contain ://
  if (
    typeof returnTo === 'string' &&
    returnTo.startsWith('/') &&
    !returnTo.startsWith('//') &&
    !returnTo.includes('://') &&
    returnTo.length < 200
  ) {
    // Strip potentially dangerous characters
    return returnTo.replace(/[<>"'`]/g, '');
  }
  
  console.warn('[portal-verify] ⚠️ Invalid returnTo, using default:', returnTo);
  return defaultPath;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = body.autologin || body.autologin_token || body.token;
    
    // Extract fallback data from frontend (localStorage)
    const frontendPhone = body.phone;
    const frontendCustomerId = body.customer_id;
    
    // ✅ SECURITY: Resolve origin with allowlist validation
    const portalOrigin = resolvePortalOrigin(req, body);
    
    // ✅ SECURITY: Sanitize returnTo to internal paths only
    const safeReturnTo = sanitizeReturnTo(body.return_to);
    
    // 🔍 Log request mode for debugging
    console.log('[portal-verify] 🎯 REQUEST MODE:', {
      hasToken: !!token,
      hasCustomerId: !!frontendCustomerId,
      hasPhone: !!frontendPhone,
      timestamp: new Date().toISOString(),
    });
    console.log('[portal-verify] Frontend fallback:', { 
      hasPhone: !!frontendPhone, 
      hasCustomerId: !!frontendCustomerId 
    });
    
    if (!token) {
      return Response.json({ ok: false, error: 'missing token' }, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Proxy to CRM's portal-verify function
    console.log('[portal-verify] Proxying to CRM:', CRM_FUNCTIONS_URL);
    
    const crmRes = await fetch(`${CRM_FUNCTIONS_URL}/portal-verify`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': CRM_API_KEY,
      },
      body: JSON.stringify({ 
        token,
        portal_origin: PORTAL_SITE_URL,
      }),
    });

    const crmData = await crmRes.json();
    // Log full CRM response for debugging
    console.log('[portal-verify] CRM full response:', JSON.stringify(crmData, null, 2));
    console.log('[portal-verify] CRM response summary:', { 
      ok: crmData.ok, 
      hasActionLink: !!crmData.action_link,
      hasCustomerId: !!crmData.customer_id,
      hasPhone: !!(crmData.normalized_phone || crmData.phone || crmData.phone_number || crmData.customer?.phone),
      allKeys: Object.keys(crmData)
    });

    // ❌ CRM said token is invalid
    if (!crmRes.ok || !crmData.ok) {
      return Response.json({ 
        ok: false, 
        error: crmData.error || 'CRM verification failed' 
      }, { 
        status: crmRes.status || 400,
        headers: corsHeaders 
      });
    }

    // ✅ CRM verified token (ok: true)
    // → Portal ALWAYS creates Magic Link locally (ignore CRM's action_link/redirect_url)
    console.log('[portal-verify] ✅ CRM verified token, creating Magic Link locally...');

    // Extract phone: prioritize CRM, fallback to frontend
    const phone = crmData.normalized_phone 
      || crmData.phone 
      || crmData.phone_number 
      || crmData.customer?.phone 
      || crmData.customer?.normalized_phone
      || crmData.data?.phone
      || crmData.data?.normalized_phone
      || frontendPhone;  // ✅ Fallback from frontend localStorage
    
    // Extract customer_id: prioritize CRM, fallback to frontend
    const customerId = crmData.customer_id 
      || crmData.customerId 
      || crmData.customer?.id
      || crmData.data?.customer_id
      || frontendCustomerId;  // ✅ Fallback from frontend localStorage
      
    console.log('[portal-verify] Final extracted:', { 
      phone: phone ? '✓' : '✗', 
      customerId: customerId ? '✓' : '✗',
      phoneSource: phone === frontendPhone ? 'frontend' : 'crm',
      customerIdSource: customerId === frontendCustomerId ? 'frontend' : 'crm'
    });
    
    if (!phone) {
      console.error('[portal-verify] ❌ No phone number in CRM response');
      console.error('[portal-verify] Available fields:', JSON.stringify(crmData, null, 2));
      return Response.json({ 
        ok: false, 
        error: 'No phone number available for authentication' 
      }, { status: 400, headers: corsHeaders });
    }

    // Create Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 🔗 MERGE STRATEGY: Check profiles table first for existing account with same phone
    let authUser = null;
    
    // Step 1: Look for existing user in profiles by phone number
    const { data: profileMatch } = await supabase
      .from('profiles')
      .select('user_id, email, phone')
      .eq('phone', phone)
      .limit(1)
      .maybeSingle();
    
    if (profileMatch?.user_id) {
      console.log('[portal-verify] 🔗 MERGE: Found existing profile with same phone:', profileMatch.user_id);
      // Get the auth user for this profile
      const { data: { user: existingAuthUser } } = await supabase.auth.admin.getUserById(profileMatch.user_id);
      if (existingAuthUser) {
        authUser = existingAuthUser;
        console.log('[portal-verify] ✅ MERGED with existing account:', authUser.id, authUser.email);
      }
    }
    
    // Compute fake email for OTP users (always needed for magic link generation)
    const fakeEmail = `${phone.replace(/\D/g, '')}@portal.csw.local`;
    
    // Step 2: If no profile match, try fake email (legacy OTP users)
    if (!authUser) {
      console.log('[portal-verify] 🔍 Looking for user with email:', fakeEmail);
      
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingUser = listData?.users?.find(u => u.email === fakeEmail);

      if (existingUser) {
        authUser = existingUser;
        console.log('[portal-verify] ✅ Found existing OTP user:', authUser.id);
      } else {
        // Step 3: Create new user only if no match found anywhere
        console.log('[portal-verify] 🆕 Creating new auth user...');
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: fakeEmail,
          phone: phone,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: {
            customer_id: customerId,
            created_via: 'portal_otp'
          }
        });
        
        if (createError) {
          console.error('[portal-verify] ❌ Failed to create user:', createError);
          return Response.json({ 
            ok: false, 
            error: 'Failed to create authentication user' 
          }, { status: 500, headers: corsHeaders });
        }
        
        authUser = newUser.user;
        console.log('[portal-verify] ✅ User created:', authUser?.id);
      }
    }

    // 🔗 Link customer_id ↔ auth_user_id in CRM
    if (customerId && authUser?.id) {
      console.log('[portal-verify] 🔗 LINKING ATTEMPT:', {
        customerId,
        authUserId: authUser.id,
        step: 'before_rpc',
        timestamp: new Date().toISOString(),
      });
      
      const crmClient = createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      
      try {
        const { data: linkResult, error: linkRpcError } = await crmClient.rpc(
          'rpc_link_customer_auth_user',
          {
            p_customer_id: customerId,
            p_auth_user_id: authUser.id,
            p_source: 'portal_verify'
          }
        );
        
        // 🔗 Step 1: RAW logging - الإخراج الكامل بدون تعديل
        console.log('[portal-verify] 🔗 LINK RPC RAW DATA:', linkResult);
        console.log('[portal-verify] 🔗 LINK RPC RAW ERROR:', linkRpcError);
        
        // 🔗 Step 2: Flexible parsing - قراءة ok أو success
        const ok = (linkResult?.ok ?? linkResult?.success ?? false) === true;
        const status = linkResult?.status ?? (ok ? 'linked' : undefined);
        console.log('[portal-verify] 🔗 LINK PARSED:', { ok, status });
        
        if (linkRpcError) {
          console.warn('[portal-verify] ⚠️ Link RPC error (non-blocking):', linkRpcError.message);
        } else if (ok) {
          console.log('[portal-verify] ✅ RPC returned success:', status);
        } else if (linkResult?.error === 'conflict') {
          console.warn('[portal-verify] ⚠️ Link conflict - already linked to different user');
        } else {
          console.warn('[portal-verify] ⚠️ Link returned unexpected result:', linkResult);
        }
        
        // 🔎 Step 3: READBACK - التحقق الفعلي من قاعدة البيانات
        const { data: rb, error: rbErr } = await crmClient
          .from('customers')
          .select('id, auth_user_id')
          .eq('id', customerId)
          .single();
        
        console.log('[portal-verify] 🔎 LINK READBACK:', rb, rbErr);
        
        // 🔎 Step 4: تحليل نتيجة الـ Readback
        if (rb?.auth_user_id === authUser.id) {
          console.log('[portal-verify] ✅ CONFIRMED: auth_user_id linked correctly');
        } else if (rb?.auth_user_id) {
          console.warn('[portal-verify] ⚠️ CONFLICT: linked to different user:', rb.auth_user_id);
        } else {
          console.error('[portal-verify] ❌ LINKING FAILED: auth_user_id still NULL', {
            customerId,
            expectedAuthUserId: authUser.id,
            actualAuthUserId: rb?.auth_user_id,
            readbackError: rbErr?.message
          });
          // لا UPDATE مباشر — هذه مشكلة CRM يجب إصلاحها هناك
        }
        
      } catch (e) {
        console.error('[portal-verify] ⚠️ Link RPC exception:', e);
        // Continue - linking failure shouldn't block login
      }
    } else {
      console.warn('[portal-verify] ⚠️ Cannot link: missing customerId or authUser.id', {
        hasCustomerId: !!customerId,
        hasAuthUserId: !!authUser?.id,
      });
    }

    // Generate Magic Link
    if (!authUser) {
      return Response.json({ 
        ok: false, 
        error: 'Failed to get or create user' 
      }, { status: 500, headers: corsHeaders });
    }

    // Use the auth user's actual email for magic link (may be fakeEmail or real email)
    const magicLinkEmail = authUser.email || fakeEmail;
    console.log('[portal-verify] 🔗 Generating magic link:', {
      portalOrigin,
      returnTo: safeReturnTo,
      finalRedirect: `${portalOrigin}${safeReturnTo}`,
      email: magicLinkEmail.includes('@portal.csw.local') ? 'fake-otp' : 'real-email',
    });
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: magicLinkEmail,
      options: {
        redirectTo: `${portalOrigin}${safeReturnTo}`
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[portal-verify] ❌ Failed to generate magic link:', linkError);
      return Response.json({ 
        ok: false, 
        error: 'Failed to generate login link' 
      }, { status: 500, headers: corsHeaders });
    }

    console.log('[portal-verify] ✅ Magic link generated locally');
    return Response.json({ 
      ok: true, 
      action_link: linkData.properties.action_link,
      customer_id: customerId,
    }, { headers: corsHeaders });

  } catch (e) {
    console.error('[portal-verify] Error:', e);
    return Response.json({ ok: false, error: String(e) }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
