import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// portal-auth v8.0 — Deterministic Identity Resolution
// ============================================
// RESOLUTION ORDER (for verify):
//   1. portal_customer_map by CRM customer_id  (canonical)
//   2. profiles table by exact normalized phone
//   3. auth users by metadata crm_customer_id match
//   4. auth users by fakeEmail from FULL phone digits
//   5. create new ONLY if zero candidates
//   → if >1 candidate exists → return portal_identity_conflict
//
// INVARIANTS:
//   - fakeEmail always uses FULL phone digits (never masked/truncated)
//   - profiles.user_id is diagnostic only, never login truth
//   - duplicate/banned accounts are excluded from adoption
// ============================================

function normalizeToE164(phone: string): string {
  if (!phone) return phone;
  let cleaned = phone.replace(/[\s\-\(\)]/g, '').replace(/^00/, '+');
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

function phoneToDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action;

    // Normalize phone at entry
    if (body.phone) {
      body.phone = normalizeToE164(body.phone);
      console.log(`[portal-auth v8] 📞 Normalized phone: ...${body.phone.slice(-4)}`);
    }

    const CRM_URL = Deno.env.get('CRM_FUNCTIONS_URL') || 'https://hlrkyoxwbjsgqbncgzpi.supabase.co/functions/v1';
    const CRM_API_KEY = Deno.env.get('CRM_API_KEY');
    const CRM_SUPABASE_URL = Deno.env.get('CRM_URL') || 'https://hlrkyoxwbjsgqbncgzpi.supabase.co';
    const CRM_SERVICE_ROLE_KEY = Deno.env.get('CRM_SERVICE_ROLE_KEY') || '';
    const PORTAL_SITE_URL = Deno.env.get('PORTAL_SITE_URL') || 'https://cswworld.com';

    if (!CRM_API_KEY) {
      console.error('[portal-auth v8] ❌ CRM_API_KEY not configured');
      return jsonResponse({ ok: false, error: 'خطأ في إعدادات الخادم', error_code: 'server_error' }, 200);
    }

    console.log(`[portal-auth v8] 🔵 Action: ${action}`);

    if (action === 'start-login' || action === 'start-signup') {
      return await forwardToCRM(CRM_URL, CRM_API_KEY, body);
    }

    if (action === 'verify-login' || action === 'verify-signup') {
      return await handleVerify(body, {
        CRM_URL, CRM_API_KEY, CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY, PORTAL_SITE_URL
      });
    }

    // ─── Student Activation (Phase 1): social/email users binding phone ───
    if (action === 'start_student_activation') {
      return await handleStartStudentActivation(body, { CRM_URL, CRM_API_KEY });
    }

    if (action === 'verify_student_activation') {
      return await handleVerifyStudentActivation(body, {
        CRM_URL, CRM_API_KEY, CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY, PORTAL_SITE_URL
      });
    }

    return await forwardToCRM(CRM_URL, CRM_API_KEY, body);

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[portal-auth v8] ❌ Unhandled error:', errMsg);
    return jsonResponse({ ok: false, error: 'خطأ في الاتصال بالخادم', error_code: 'server_error' }, 200);
  }
});

// ============================================
// Forward to CRM (simple proxy)
// ============================================
async function forwardToCRM(crmUrl: string, apiKey: string, body: any): Promise<Response> {
  console.log('[portal-auth v8] → Forwarding to CRM:', body.action);
  const response = await fetch(`${crmUrl}/portal-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  console.log('[portal-auth v8] ← CRM response:', data.ok ? '✅' : '❌', data.error_code || '');
  return jsonResponse(data, 200);
}

// ============================================
// CORE: Verify OTP → 5-step Portal identity resolution
// ============================================
async function handleVerify(body: any, config: {
  CRM_URL: string;
  CRM_API_KEY: string;
  CRM_SUPABASE_URL: string;
  CRM_SERVICE_ROLE_KEY: string;
  PORTAL_SITE_URL: string;
}): Promise<Response> {
  const phone = body.phone;
  const phoneDigits = phoneToDigits(phone);
  console.log('[portal-auth v8] 🔐 verify for:', phone?.slice(-4), `(${phoneDigits.length} digits)`);

  // ─── Step 1: CRM verifies OTP → get crm_customer_id ───
  let crmCustomerId: string | null = null;

  try {
    console.log('[portal-auth v8] → Sending verify to CRM...');
    const crmRes = await fetch(`${config.CRM_URL}/portal-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.CRM_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const crmData = await crmRes.json();
    console.log('[portal-auth v8] ← CRM verify response:', JSON.stringify({
      ok: crmData.ok,
      error_code: crmData.error_code,
      has_customer_id: !!crmData.customer_id,
      status: crmRes.status,
    }));

    // Pass through CRM validation errors
    if (['invalid_code', 'expired_code', 'too_many_attempts', 'throttled', 'invalid_phone']
        .includes(crmData.error_code)) {
      return jsonResponse(crmData, 200);
    }

    if (crmData.ok && crmData.customer_id) {
      crmCustomerId = crmData.customer_id;
      console.log('[portal-auth v8] ✅ CRM verified, customer:', crmCustomerId);
    }

    if (!crmCustomerId) {
      if (crmData.ok || crmData.error_code === 'server_error' || crmRes.status >= 500) {
        console.log('[portal-auth v8] ⚠️ Recovering customer from CRM DB...');
        crmCustomerId = await recoverCustomerId(phone, config);
      }
    }
  } catch (e) {
    console.error('[portal-auth v8] ❌ CRM call failed:', e);
    crmCustomerId = await recoverCustomerId(phone, config);
  }

  if (!crmCustomerId) {
    console.error('[portal-auth v8] ❌ No CRM customer resolved');
    return jsonResponse({ ok: false, error: 'فشل التحقق من الرمز', error_code: 'no_customer' }, 200);
  }

  // ─── Step 2: 5-step Portal identity resolution ───
  console.log('[portal-auth v8] 🗺️ Resolving Portal identity for CRM customer:', crmCustomerId);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const portalAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const resolved = await resolvePortalIdentity(portalAdmin, crmCustomerId, phone, phoneDigits);

  if (resolved.error) {
    console.error('[portal-auth v8] ❌ Identity resolution failed:', resolved.error);
    return jsonResponse({
      ok: false,
      error: resolved.error === 'portal_identity_conflict'
        ? 'تعارض في هوية الحساب - يرجى التواصل مع الدعم'
        : 'فشل إنشاء حساب المستخدم',
      error_code: resolved.error,
      _candidates: resolved.candidates,
    }, 200);
  }

  const portalAuthUserId = resolved.userId!;
  const resolutionMethod = resolved.method;
  console.log(`[portal-auth v8] ✅ Resolved Portal user: ${portalAuthUserId} via ${resolutionMethod}`);

  // ─── Step 3: Update metadata ───
  await portalAdmin.auth.admin.updateUserById(portalAuthUserId, {
    user_metadata: {
      crm_customer_id: crmCustomerId,
      phone: phone,
      last_login_via: 'portal_auth_v8',
      resolved_via: resolutionMethod,
    }
  }).catch((e: any) => console.warn('[portal-auth v8] ⚠️ Metadata update failed:', e));

  // ─── Step 4: Generate magic link ───
  const portalUser = (await portalAdmin.auth.admin.getUserById(portalAuthUserId)).data.user;
  if (!portalUser) {
    return jsonResponse({ ok: false, error: 'فشل إنشاء الجلسة', error_code: 'server_error' }, 200);
  }

  const redirectTo = `${config.PORTAL_SITE_URL}/account`;
  console.log('[portal-auth v8] 🔗 Generating magic link for Portal user:', portalAuthUserId, '→', redirectTo);

  const { data: linkData, error: linkError } = await portalAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: portalUser.email!,
    options: { redirectTo }
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[portal-auth v8] ❌ Magic link generation failed:', linkError);
    return jsonResponse({ ok: false, error: 'فشل إنشاء رابط الدخول', error_code: 'server_error' }, 200);
  }

  const actionLink = linkData.properties.action_link;
  console.log('[portal-auth v8] ✅ Magic link ready for Portal user:', portalAuthUserId);

  // Non-blocking: ensure profile exists
  ensureProfile(portalAdmin, portalAuthUserId, phone, crmCustomerId).catch(e =>
    console.warn('[portal-auth v8] ⚠️ Profile ensure failed:', e)
  );

  return jsonResponse({
    ok: true,
    customer_id: crmCustomerId,
    redirect_url: actionLink,
    action_link: actionLink,
    _v: 'v8_deterministic',
    _portal_auth_user_id: portalAuthUserId,
    _crm_customer_id: crmCustomerId,
    _resolved_via: resolutionMethod,
  }, 200);
}

// ============================================
// 5-STEP IDENTITY RESOLUTION
// ============================================
async function resolvePortalIdentity(
  portalAdmin: any,
  crmCustomerId: string,
  phone: string,
  phoneDigits: string,
): Promise<{ userId: string | null; method: string; error?: string; candidates?: string[] }> {

  // ─── STEP 1: portal_customer_map by CRM customer_id (canonical) ───
  const { data: mapping } = await portalAdmin
    .from('portal_customer_map')
    .select('portal_auth_user_id')
    .eq('crm_customer_id', crmCustomerId)
    .maybeSingle();

  if (mapping?.portal_auth_user_id) {
    const { data: { user } } = await portalAdmin.auth.admin.getUserById(mapping.portal_auth_user_id);
    if (user && !user.banned_until) {
      console.log('[portal-auth v8] ✅ [Step 1] Found via portal_customer_map:', user.id);
      return { userId: user.id, method: 'portal_customer_map' };
    }
    console.warn('[portal-auth v8] ⚠️ [Step 1] Mapped user deleted/banned, continuing...');
  }

  // ─── STEP 2: profiles table by exact normalized phone ───
  const normalizedPhone = normalizeToE164(phone);
  const { data: profileHits } = await portalAdmin
    .from('profiles')
    .select('user_id')
    .or(`phone.eq.${normalizedPhone},phone.eq.${phoneDigits}`)
    .limit(5);

  const validProfileUsers: string[] = [];
  if (profileHits?.length) {
    for (const p of profileHits) {
      const { data: { user } } = await portalAdmin.auth.admin.getUserById(p.user_id);
      if (user && !user.banned_until) {
        validProfileUsers.push(user.id);
      }
    }
  }

  if (validProfileUsers.length === 1) {
    const userId = validProfileUsers[0];
    console.log('[portal-auth v8] ✅ [Step 2] Found via profiles.phone:', userId);
    await persistMapping(portalAdmin, crmCustomerId, userId, phone);
    return { userId, method: 'profiles_phone' };
  }
  if (validProfileUsers.length > 1) {
    console.error('[portal-auth v8] ❌ [Step 2] Multiple profile matches:', validProfileUsers);
    return { userId: null, method: 'conflict', error: 'portal_identity_conflict', candidates: validProfileUsers };
  }

  // ─── STEP 3: auth users by metadata crm_customer_id match ───
  const { data: listData } = await portalAdmin.auth.admin.listUsers();
  const allUsers = listData?.users || [];

  const metadataMatches = allUsers.filter((u: any) =>
    !u.banned_until &&
    (u.raw_user_meta_data?.crm_customer_id === crmCustomerId ||
     u.raw_user_meta_data?.customer_id === crmCustomerId)
  );

  if (metadataMatches.length === 1) {
    const userId = metadataMatches[0].id;
    console.log('[portal-auth v8] ✅ [Step 3] Found via metadata crm_customer_id:', userId);
    await persistMapping(portalAdmin, crmCustomerId, userId, phone);
    return { userId, method: 'metadata_customer_id' };
  }
  if (metadataMatches.length > 1) {
    const ids = metadataMatches.map((u: any) => u.id);
    console.error('[portal-auth v8] ❌ [Step 3] Multiple metadata matches:', ids);
    return { userId: null, method: 'conflict', error: 'portal_identity_conflict', candidates: ids };
  }

  // ─── STEP 4: fakeEmail from FULL phone digits ───
  const fakeEmail = `${phoneDigits}@portal.csw.local`;
  console.log('[portal-auth v8] 🔍 [Step 4] Looking for fakeEmail:', fakeEmail);

  const fakeEmailUser = allUsers.find((u: any) => u.email === fakeEmail && !u.banned_until);
  if (fakeEmailUser) {
    console.log('[portal-auth v8] ✅ [Step 4] Found via fakeEmail:', fakeEmailUser.id);
    await persistMapping(portalAdmin, crmCustomerId, fakeEmailUser.id, phone);
    return { userId: fakeEmailUser.id, method: 'fake_email' };
  }

  // ─── STEP 5: create new ONLY if zero candidates ───
  console.log('[portal-auth v8] 🆕 [Step 5] No existing identity found, creating new Portal user');

  const { data: newUser, error: createError } = await portalAdmin.auth.admin.createUser({
    email: fakeEmail,
    email_confirm: true,
    user_metadata: {
      crm_customer_id: crmCustomerId,
      phone: phone,
      created_via: 'portal_auth_v8',
    }
  });

  if (createError) {
    console.error('[portal-auth v8] ❌ [Step 5] Failed to create:', createError);
    return { userId: null, method: 'create_failed', error: 'server_error' };
  }

  const newUserId = newUser.user.id;
  console.log('[portal-auth v8] ✅ [Step 5] Created new Portal user:', newUserId);
  await persistMapping(portalAdmin, crmCustomerId, newUserId, phone);
  return { userId: newUserId, method: 'created_new' };
}

// ============================================
// Persist mapping helper
// ============================================
async function persistMapping(portalAdmin: any, crmCustomerId: string, portalAuthUserId: string, phone: string) {
  const { error } = await portalAdmin
    .from('portal_customer_map')
    .upsert({
      crm_customer_id: crmCustomerId,
      portal_auth_user_id: portalAuthUserId,
      phone_e164: phone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'crm_customer_id' });

  if (error) {
    console.error('[portal-auth v8] ⚠️ Mapping persist failed:', error);
  } else {
    console.log('[portal-auth v8] ✅ Mapping persisted: CRM', crmCustomerId, '→ Portal', portalAuthUserId);
  }
}

// ============================================
// Recovery: find CRM customer_id by phone
// ============================================
async function recoverCustomerId(phone: string, config: { CRM_SUPABASE_URL: string; CRM_SERVICE_ROLE_KEY: string }): Promise<string | null> {
  if (!config.CRM_SERVICE_ROLE_KEY) {
    console.error('[portal-auth v8] ❌ No CRM_SERVICE_ROLE_KEY for recovery');
    return null;
  }

  try {
    const crmClient = createClient(config.CRM_SUPABASE_URL, config.CRM_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const normalizedPhone = normalizeToE164(phone);
    const phoneWithout = normalizedPhone.replace('+', '');

    const { data: challenge } = await crmClient
      .from('portal_login_challenges')
      .select('customer_id')
      .or(`phone_e164.eq.${normalizedPhone},phone_e164.eq.${phoneWithout}`)
      .eq('is_used', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challenge?.customer_id) {
      console.log('[portal-auth v8] ✅ Recovered from challenge:', challenge.customer_id);
      return challenge.customer_id;
    }

    const { data: customer } = await crmClient
      .from('customers')
      .select('id')
      .or(`phone_e164.eq.${normalizedPhone},phone_norm.eq.${normalizedPhone},phone_e164.eq.${phoneWithout},phone_norm.eq.${phoneWithout}`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (customer?.id) {
      console.log('[portal-auth v8] ✅ Recovered from customers:', customer.id);
      return customer.id;
    }

    return null;
  } catch (e) {
    console.error('[portal-auth v8] ❌ Recovery exception:', e);
    return null;
  }
}

// ============================================
// Ensure profile row exists
// ============================================
async function ensureProfile(supabase: any, userId: string, phone: string, crmCustomerId: string) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from('profiles').insert({
      user_id: userId,
      phone: phone,
      created_at: new Date().toISOString(),
    });
    console.log('[portal-auth v8] ✅ Profile created for:', userId);
  }
}

// ============================================
// STUDENT ACTIVATION: Start (send OTP for phone binding)
// ============================================
async function handleStartStudentActivation(
  body: any,
  config: { CRM_URL: string; CRM_API_KEY: string }
): Promise<Response> {
  const { phone, supabase_user_id } = body;

  if (!phone || !supabase_user_id) {
    return jsonResponse({ ok: false, error: 'phone and supabase_user_id are required', error_code: 'invalid_input' }, 200);
  }

  console.log(`[portal-auth v8] 🔑 start_student_activation for user: ${supabase_user_id}, phone: ...${phone.slice(-4)}`);

  // Check if already activated (portal_customer_map has entry for this auth user)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const portalAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: existingMap } = await portalAdmin
    .from('portal_customer_map')
    .select('crm_customer_id')
    .eq('portal_auth_user_id', supabase_user_id)
    .maybeSingle();

  if (existingMap?.crm_customer_id) {
    console.log('[portal-auth v8] ✅ User already activated:', existingMap.crm_customer_id);
    return jsonResponse({ ok: true, already_activated: true, customer_id: existingMap.crm_customer_id }, 200);
  }

  // Forward to CRM to send OTP (reuse start-signup action which sends WhatsApp OTP)
  const crmBody = {
    action: 'start-signup',
    phone: phone,
    account_role: 'student',
    channel: body.channel || 'web_chat',
    guest_session_id: body.guest_session_id,
  };

  console.log('[portal-auth v8] → Forwarding activation OTP to CRM...');
  const response = await fetch(`${config.CRM_URL}/portal-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.CRM_API_KEY}`,
    },
    body: JSON.stringify(crmBody),
  });

  const data = await response.json();
  console.log('[portal-auth v8] ← CRM activation OTP response:', data.ok ? '✅' : '❌', data.error_code || '');
  return jsonResponse(data, 200);
}

// ============================================
// STUDENT ACTIVATION: Verify (bind phone to existing auth user)
// ============================================
async function handleVerifyStudentActivation(
  body: any,
  config: {
    CRM_URL: string;
    CRM_API_KEY: string;
    CRM_SUPABASE_URL: string;
    CRM_SERVICE_ROLE_KEY: string;
    PORTAL_SITE_URL: string;
  }
): Promise<Response> {
  const { phone, otp_code, supabase_user_id } = body;

  if (!phone || !otp_code || !supabase_user_id) {
    return jsonResponse({ ok: false, error: 'phone, otp_code, and supabase_user_id are required', error_code: 'invalid_input' }, 200);
  }

  const phoneDigits = phoneToDigits(phone);
  console.log(`[portal-auth v8] 🔐 verify_student_activation for user: ${supabase_user_id}, phone: ...${phone.slice(-4)}`);

  // ─── Step 1: Verify OTP via CRM ───
  let crmCustomerId: string | null = null;

  try {
    const crmBody = {
      action: 'verify-signup',
      phone: phone,
      otp_code: otp_code,
      account_role: 'student',
      channel: body.channel || 'web_chat',
      guest_session_id: body.guest_session_id,
    };

    const crmRes = await fetch(`${config.CRM_URL}/portal-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.CRM_API_KEY}`,
      },
      body: JSON.stringify(crmBody),
    });

    const crmData = await crmRes.json();
    console.log('[portal-auth v8] ← CRM activation verify response:', JSON.stringify({
      ok: crmData.ok, error_code: crmData.error_code, has_customer_id: !!crmData.customer_id,
    }));

    // Pass through CRM validation errors
    if (['invalid_code', 'expired_code', 'too_many_attempts', 'throttled', 'invalid_phone']
        .includes(crmData.error_code)) {
      return jsonResponse(crmData, 200);
    }

    if (crmData.ok && crmData.customer_id) {
      crmCustomerId = crmData.customer_id;
    }

    if (!crmCustomerId) {
      crmCustomerId = await recoverCustomerId(phone, config);
    }
  } catch (e) {
    console.error('[portal-auth v8] ❌ CRM activation verify failed:', e);
    crmCustomerId = await recoverCustomerId(phone, config);
  }

  if (!crmCustomerId) {
    return jsonResponse({ ok: false, error: 'فشل التحقق من الرمز', error_code: 'no_customer' }, 200);
  }

  console.log('[portal-auth v8] ✅ CRM customer resolved for activation:', crmCustomerId);

  // ─── Step 2: Collision checks ───
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const portalAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // COLLISION CHECK A: Is this CRM customer already linked to a DIFFERENT auth user?
  const { data: existingCrmMap } = await portalAdmin
    .from('portal_customer_map')
    .select('portal_auth_user_id')
    .eq('crm_customer_id', crmCustomerId)
    .maybeSingle();

  if (existingCrmMap?.portal_auth_user_id && existingCrmMap.portal_auth_user_id !== supabase_user_id) {
    console.error('[portal-auth v8] ❌ COLLISION: CRM customer', crmCustomerId, 'already linked to different auth user:', existingCrmMap.portal_auth_user_id);
    return jsonResponse({
      ok: false,
      error: 'رقم الهاتف مرتبط بحساب آخر بالفعل',
      error_code: 'phone_linked_to_other_account',
    }, 200);
  }

  // COLLISION CHECK B: Is this auth user already linked to a DIFFERENT CRM customer?
  const { data: existingUserMap } = await portalAdmin
    .from('portal_customer_map')
    .select('crm_customer_id')
    .eq('portal_auth_user_id', supabase_user_id)
    .maybeSingle();

  if (existingUserMap?.crm_customer_id && existingUserMap.crm_customer_id !== crmCustomerId) {
    console.error('[portal-auth v8] ❌ COLLISION: Auth user', supabase_user_id, 'already linked to different CRM customer:', existingUserMap.crm_customer_id);
    return jsonResponse({
      ok: false,
      error: 'هذا الحساب مرتبط بعميل آخر بالفعل',
      error_code: 'user_already_activated',
    }, 200);
  }

  // ─── Step 3: Create/update portal_customer_map ───
  console.log('[portal-auth v8] ✅ No collisions, persisting activation mapping...');
  await persistMapping(portalAdmin, crmCustomerId, supabase_user_id, phone);

  // ─── Step 4: Update profiles ───
  const { data: existingProfile } = await portalAdmin
    .from('profiles')
    .select('user_id')
    .eq('user_id', supabase_user_id)
    .maybeSingle();

  if (existingProfile) {
    await portalAdmin.from('profiles').update({
      phone: phone,
      activation_status: 'activated',
    }).eq('user_id', supabase_user_id);
    console.log('[portal-auth v8] ✅ Profile updated with phone + activation_status=activated');
  } else {
    await portalAdmin.from('profiles').insert({
      user_id: supabase_user_id,
      phone: phone,
      activation_status: 'activated',
      created_at: new Date().toISOString(),
    });
    console.log('[portal-auth v8] ✅ Profile created with phone + activation_status=activated');
  }

  // ─── Step 5: Update auth.users metadata ───
  await portalAdmin.auth.admin.updateUserById(supabase_user_id, {
    user_metadata: {
      crm_customer_id: crmCustomerId,
      phone: phone,
      activated_via: 'student_activation',
      last_login_via: 'portal_auth_v8',
    }
  }).catch((e: any) => console.warn('[portal-auth v8] ⚠️ Metadata update failed:', e));

  console.log(`[portal-auth v8] ✅ Student activation complete: auth=${supabase_user_id} → CRM=${crmCustomerId}`);

  return jsonResponse({
    ok: true,
    customer_id: crmCustomerId,
    activated: true,
    _v: 'v8_student_activation',
  }, 200);
}

// ============================================
// Utility
// ============================================
function jsonResponse(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
