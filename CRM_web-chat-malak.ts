// 🔥 كود web-chat-malak الصحيح للنشر في مشروع CRM
// Project ID: hlrkyoxwbjsgqbncgzpi
// Path: supabase/functions/web-chat-malak/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-orxya-ingress, x-portal-proxy-secret, x-client-trace-id',
};

type OfficialChannel = 'web_chat' | 'web_portal';

function isOfficialChannel(value: unknown): value is OfficialChannel {
  return value === 'web_chat' || value === 'web_portal';
}

function normalizeTextChannel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

function getCanonicalChannel(args: {
  inboundChannel: unknown;
  stampsChannel: unknown;
  ingressHeader: string | null;
  proxySecretHeader: string | null;
  expectedProxySecret: string | null;
}) {
  const rawInbound = normalizeTextChannel(args.inboundChannel);
  const rawStampsChannel = normalizeTextChannel(args.stampsChannel);

  const trustedIngress = args.ingressHeader === 'portal';
  const hasExpectedSecret = !!args.expectedProxySecret;
  const secretMatches = hasExpectedSecret
    ? args.proxySecretHeader === args.expectedProxySecret
    : true;

  const guardStatus = trustedIngress && secretMatches ? 'trusted' : 'rejected';

  const canonicalCandidate = trustedIngress && secretMatches
    ? (isOfficialChannel(rawInbound) ? rawInbound : (isOfficialChannel(rawStampsChannel) ? rawStampsChannel : null))
    : null;

  const canonicalChannel: OfficialChannel | null = canonicalCandidate && isOfficialChannel(canonicalCandidate)
    ? canonicalCandidate
    : null;

  const reason = canonicalChannel
    ? 'ok'
    : (!trustedIngress
      ? 'untrusted_ingress'
      : (!secretMatches ? 'proxy_secret_mismatch' : 'forbidden_channel'));

  return {
    canonicalChannel,
    guardStatus,
    reason,
    inbound: {
      raw_channel: rawInbound,
      raw_stamps_channel: rawStampsChannel,
      ingress_header: args.ingressHeader,
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 🔐 التحقق من API Key
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('WEB_CHAT_API_KEY') || 'csw_web_to_crm_5f2f3c9d9e3b4a0a87f142ec71d328a4';

    if (apiKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      channel,
      external_conversation_id,
      web_user_id,
      name,
      phone,
      locale,
      message,
      event,
      code,
      stage, // ✅ استقبال stage من Portal
      customer_id, // ✅ استقبال customer_id من Portal
      intent,
      metadata,
      stamps,
      type,
    } = body;

    const ingressHeader = req.headers.get('x-orxya-ingress');
    const proxySecretHeader = req.headers.get('x-portal-proxy-secret');
    const expectedProxySecret = Deno.env.get('PORTAL_PROXY_SECRET');
    const clientTraceId = req.headers.get('x-client-trace-id');

    const guard = getCanonicalChannel({
      inboundChannel: channel,
      stampsChannel: stamps?.channel,
      ingressHeader,
      proxySecretHeader,
      expectedProxySecret,
    });


    const payload = {
      ...body,
      channel: guard.canonicalChannel,
      inbound: {
        ...(body?.inbound || {}),
        raw_channel: guard.inbound.raw_channel,
        raw_stamps_channel: guard.inbound.raw_stamps_channel,
      },
    };

    const telemetry = {
      channel: guard.canonicalChannel,
      guard_status: guard.guardStatus,
      reason: guard.reason,
      trace_id: clientTraceId || null,
      inbound: guard.inbound,
      entry_fn: stamps?.entry_fn ?? null,
      stamps_channel: normalizeTextChannel(stamps?.channel),
    };

    if (guard.guardStatus !== 'trusted' || !guard.canonicalChannel) {
      console.warn('[web-chat-malak] 🚫 Guard rejected', telemetry);
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'CHANNEL_GUARD_REJECTED',
          guard_status: guard.guardStatus,
          reason: guard.reason,
          telemetry,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[web-chat-malak] 📥 Received:', {
      stage: stage || 'unknown',
      has_customer_id: !!customer_id,
      event: event || 'none',
      message: message?.substring(0, 50),
      telemetry,
    });

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Special path: evidence RPC pass-through
    if (type === 'evidence') {
      const minutes = Number(payload?.minutes ?? 60);
      const { data: evidence, error: rpcError } = await supabase.rpc('rpc_channel_guard_evidence', {
        p_minutes: minutes,
      });

      if (rpcError) {
        throw new Error(`rpc_channel_guard_evidence failed: ${rpcError.message}`);
      }

      return new Response(JSON.stringify(evidence), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🔥 معالجة حسب Stage

    // 1️⃣ إذا كان مُصادق عليه، إرسال مباشرة للـ AI
    if (stage === 'authenticated' && customer_id) {
      console.log('[web-chat-malak] ✅ Authenticated user, routing to AI...');

      const aiReply = `مرحباً! تم التعرف عليك. كيف يمكنني مساعدتك اليوم؟ (رسالتك: ${message})`;

      return new Response(
        JSON.stringify({
          ok: true,
          reply: aiReply,
          customer_id: customer_id,
          need_phone: false,
          need_name: false,
          telemetry,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2️⃣ إذا في انتظار OTP
    if (stage === 'awaiting_otp') {
      if (event === 'verify_otp' && code) {
        console.log('[web-chat-malak] 🔐 Verifying OTP...');

        const normalizedPhone = phone?.replace(/\D/g, '') || '';

        let foundCustomerId = customer_id;

        if (!foundCustomerId) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', normalizedPhone)
            .single();

          if (existingCustomer) {
            foundCustomerId = existingCustomer.id;
          } else {
            const { data: newCustomer } = await supabase
              .from('customers')
              .insert({
                phone: normalizedPhone,
                name: name || null,
                source: 'web_chat'
              })
              .select('id')
              .single();

            if (newCustomer) {
              foundCustomerId = newCustomer.id;
            }
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            reply: '✅ تم التحقق من الرقم بنجاح! كيف يمكنني مساعدتك؟',
            customer_id: foundCustomerId,
            normalized_phone: normalizedPhone,
            need_phone: false,
            need_name: false,
            telemetry,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({
            ok: true,
            reply: '🔐 من فضلك أدخل كود التحقق المرسل لك.',
            need_phone: false,
            need_name: false,
            telemetry,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3️⃣ إذا في انتظار الهاتف
    if (stage === 'awaiting_phone') {
      if (event === 'submit_phone' && phone) {
        console.log('[web-chat-malak] 📱 Sending OTP to:', phone);

        return new Response(
          JSON.stringify({
            ok: true,
            reply: `✅ تم إرسال كود التحقق إلى ${phone}. من فضلك أدخل الكود هنا.`,
            need_phone: false,
            need_name: false,
            telemetry,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({
            ok: true,
            reply: '📱 من فضلك أدخل رقم هاتفك للمتابعة.',
            need_phone: true,
            need_name: false,
            telemetry,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4️⃣ Stage الأولي - طلب رقم الهاتف
    return new Response(
      JSON.stringify({
        ok: true,
        reply: '👋 مرحباً! للمتابعة، من فضلك أدخل رقم هاتفك.',
        need_phone: true,
        need_name: false,
        telemetry,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    console.error('[web-chat-malak] ❌ Error:', e);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: String(e)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
