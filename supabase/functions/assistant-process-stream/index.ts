import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// Shared Logic (inlined - edge functions can't share files)
// ============================================================

type ResolvedChannel = 'web_portal' | 'web_chat';

function extractToken(
  studentPortalToken: string | undefined | null,
  authorizationHeader: string | null,
  headerStudentPortalToken?: string | null,
): string | undefined {
  if (studentPortalToken) return studentPortalToken;
  if (headerStudentPortalToken) return headerStudentPortalToken;
  if (authorizationHeader?.startsWith('Bearer ')) {
    return authorizationHeader.slice(7);
  }
  return undefined;
}

async function verifyAuthFromToken(
  getUser: (token: string) => Promise<{ data?: { user?: { id?: string } }; error?: { message?: string } | null }>,
  studentPortalToken: string | undefined | null,
): Promise<{ isAuthenticated: boolean; userId: string | null }> {
  if (!studentPortalToken || typeof studentPortalToken !== 'string' || studentPortalToken.length < 10) {
    return { isAuthenticated: false, userId: null };
  }

  try {
    const { data, error } = await getUser(studentPortalToken);
    if (error || !data?.user?.id) {
      return { isAuthenticated: false, userId: null };
    }
    return { isAuthenticated: true, userId: data.user.id };
  } catch {
    return { isAuthenticated: false, userId: null };
  }
}

function resolveChannel(serverVerifiedAuth: boolean): ResolvedChannel {
  return serverVerifiedAuth ? 'web_portal' : 'web_chat';
}

function sanitizeClientBuild(clientBuild: string | undefined | null): string {
  const inboundClientBuild = typeof clientBuild === 'string' ? clientBuild.trim() : '';
  return inboundClientBuild && inboundClientBuild.length <= 80
    ? inboundClientBuild
    : 'portal-v2-fallback';
}

function buildStamps(channel: ResolvedChannel, clientBuild: string, traceId: string) {
  return {
    entry_fn: 'portal-chat-ui',
    channel,
    client_build: clientBuild,
    trace_id: traceId,
  };
}

function buildCrmHeaders(params: {
  apiKey: string;
  traceId: string;
  proxySecret?: string | null;
  studentPortalToken?: string | null;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': params.apiKey,
    'x-orxya-ingress': 'portal',
    'x-client-trace-id': params.traceId,
  };

  if (params.proxySecret) {
    headers['x-portal-proxy-secret'] = params.proxySecret;
  }
  if (params.studentPortalToken) {
    headers.Authorization = `Bearer ${params.studentPortalToken}`;
  }

  return headers;
}

// ============================================================
// End Shared Logic
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-trace-id, x-orxya-ingress, x-student-portal-token',
};

const sseHeaders = {
  ...corsHeaders,
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// deno-lint-ignore no-explicit-any
async function verifyAuthenticationStatus(
  supabase: any,
  studentPortalToken: string | undefined | null,
): Promise<{ isAuthenticated: boolean; userId: string | null }> {
  const getUser = async (token: string) => {
    const res = await supabase.auth.getUser(token);
    return {
      data: res.data?.user ? { user: { id: res.data.user.id } } : undefined,
      error: res.error ? { message: res.error.message } : null,
    };
  };
  return verifyAuthFromToken(getUser, studentPortalToken);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      visitor_id,
      text,
      session_id,
      web_user_id,
      name,
      phone,
      locale,
      event,
      code,
      intent,
      metadata,
      selected_programs,
      session_type,
      guest_session_id,
      customer_id: frontend_customer_id,
      student_portal_token: frontend_token,
      client_action_id,
      ui_context,
      client_trace_id,
      channel: inbound_channel,
      client_build: inbound_client_build,
    } = await req.json();

    if (!visitor_id || !text) {
      return new Response(
        JSON.stringify({ error: 'visitor_id & text required' }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const requestId = generateRequestId();
    const finalTraceId = client_trace_id || requestId;

    const authHeader = req.headers.get('authorization');
    const headerStudentPortalToken = req.headers.get('x-student-portal-token');
    const effectiveToken = extractToken(frontend_token, authHeader, headerStudentPortalToken);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { isAuthenticated: serverVerifiedAuth } = await verifyAuthenticationStatus(
      supabase,
      effectiveToken,
    );
    const expectedChannel = resolveChannel(serverVerifiedAuth);
    const resolvedChannel = expectedChannel;

    const normalizedInboundChannel = typeof inbound_channel === 'string'
      ? inbound_channel.trim().toLowerCase()
      : null;
    if (normalizedInboundChannel && normalizedInboundChannel !== expectedChannel) {
      console.warn('[assistant-process-stream] ⚠️ MSG_CHANNEL_SPOOF_ATTEMPT', {
        inboundChannel: normalizedInboundChannel,
        expectedChannel,
        serverVerifiedAuth,
        clientSessionType: session_type,
        visitor_id,
      });
    }

    const finalClientBuild = sanitizeClientBuild(inbound_client_build);

    let CRM_FUNCTIONS_URL = Deno.env.get('CRM_FUNCTIONS_URL');
    let CRM_API_KEY = Deno.env.get('CRM_API_KEY');

    if (!CRM_FUNCTIONS_URL || !CRM_API_KEY) {
      const { data: settings } = await supabase
        .from('feature_settings')
        .select('key, value')
        .in('key', ['crm_functions_url', 'crm_api_key']);

      if (settings) {
        const settingsMap = Object.fromEntries(
          settings.map((s: any) => [s.key, s.value]),
        );
        CRM_FUNCTIONS_URL = CRM_FUNCTIONS_URL || settingsMap.crm_functions_url;
        CRM_API_KEY = CRM_API_KEY || settingsMap.crm_api_key;
      }
    }

    if (!CRM_FUNCTIONS_URL || !CRM_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'CRM not configured' }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const conversationId = session_id || visitor_id;

    let { data: sessionData } = await supabase
      .from('web_chat_sessions')
      .select('*')
      .eq('external_conversation_id', conversationId)
      .single();

    if (!sessionData) {
      const { data: newSession } = await supabase
        .from('web_chat_sessions')
        .insert({
          external_conversation_id: conversationId,
          stage: 'initial',
          locale: locale || 'ar',
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();
      sessionData = newSession;
    }

    const currentStage = sessionData?.stage || 'initial';
    const currentPhone = sessionData?.phone;
    const currentCustomerId = sessionData?.customer_id;

    const crmBody: any = {
      type: 'message',
      channel: resolvedChannel,
      external_conversation_id: conversationId,
      visitor_id,
      web_user_id,
      name,
      phone: currentPhone || phone,
      locale: locale || 'ar',
      message: text,
      event: event || null,
      stage: currentStage,
      customer_id: frontend_customer_id || currentCustomerId,
      session_type: serverVerifiedAuth ? 'authenticated' : 'guest',
      guest_session_id,
      client_action_id,
      client_trace_id: finalTraceId,
      ui_context,
      stamps: buildStamps(resolvedChannel, finalClientBuild, finalTraceId),
      stream: true,
    };

    if (code) crmBody.code = code;
    if (intent) crmBody.intent = intent;
    if (metadata) crmBody.metadata = metadata;
    if (selected_programs) crmBody.selected_programs = selected_programs;

    const startTime = Date.now();

    const response = await fetch(`${CRM_FUNCTIONS_URL}/web-chat-malak-stream`, {
      method: 'POST',
      headers: {
        ...buildCrmHeaders({
          apiKey: CRM_API_KEY,
          traceId: finalTraceId,
          proxySecret: Deno.env.get('PORTAL_PROXY_SECRET'),
          studentPortalToken: effectiveToken,
        }),
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(crmBody),
    });

    if (!response.ok || !response.body) {
      const fallbackResponse = await fetch(`${CRM_FUNCTIONS_URL}/web-chat-malak`, {
        method: 'POST',
        headers: buildCrmHeaders({
          apiKey: CRM_API_KEY,
          traceId: finalTraceId,
          proxySecret: Deno.env.get('PORTAL_PROXY_SECRET'),
          studentPortalToken: effectiveToken,
        }),
        body: JSON.stringify({ ...crmBody, stream: false }),
      });

      const data = await fallbackResponse.json();
      const latency = Date.now() - startTime;

      await supabase
        .from('web_chat_sessions')
        .update({
          stage: data.stage ?? currentStage,
          customer_id: data.customer_id ?? currentCustomerId,
          phone: data.normalized_phone ?? currentPhone ?? phone ?? null,
          last_message_at: new Date().toISOString(),
        })
        .eq('external_conversation_id', conversationId);

      const encoder = new TextEncoder();
      const sseData = `data: ${JSON.stringify({
        type: 'complete',
        ok: true,
        reply: data.reply,
        need_name: data.need_name,
        need_phone: data.need_phone,
        customer_id: data.customer_id,
        normalized_phone: data.normalized_phone,
        stage: data.stage,
        is_new_customer: data.is_new_customer ?? false,
        student_portal_token: data.student_portal_token ?? null,
        universities: data.universities || [],
        stage_info: data.stage_info ?? null,
        guest_state: data.guest_state ?? null,
        events: data.events || [],
        cards_query: data.cards_query ?? null,
        ui_directives: data.ui_directives ?? null,
        ap_version: data.ap_version ?? null,
        latency_ms: latency,
        channel: resolvedChannel,
      })}\n\ndata: [DONE]\n\n`;

      return new Response(encoder.encode(sseData), { headers: sseHeaders });
    }

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
    });

    response.body.pipeTo(transformStream.writable);
    return new Response(transformStream.readable, { headers: sseHeaders });
  } catch (e) {
    console.error('[assistant-process-stream] ❌ Error:', e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
