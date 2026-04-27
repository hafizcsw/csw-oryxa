import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  assertChannelMatchesStamps,
  buildAckPayload,
  buildCrmHeaders,
  buildStamps,
  extractToken,
  resolveChannel,
  sanitizeClientBuild,
  validateAckForForwarding,
  verifyAuthFromToken,
} from './logic.ts';

// ✅ P0 FIX: Complete CORS headers including Supabase client headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-trace-id, x-orxya-ingress, x-student-portal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

// ✅ P0: Request ID generator for tracing
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ✅ P0: Sanitize message for logging (mask potential PII like phone numbers, OTPs)
function sanitizeForLog(text: string | undefined, maxLen = 30): string {
  if (!text) return '(empty)';
  // Mask any sequence of 4+ digits (phone numbers, OTPs, codes)
  const masked = text.replace(/\d{4,}/g, '****');
  return masked.substring(0, maxLen) + (masked.length > maxLen ? '…' : '');
}

// ✅ SECURITY: Server-side JWT verification for authentication status
// Returns true ONLY if we have a valid token verified on server
// deno-lint-ignore no-explicit-any
async function verifyAuthenticationStatus(
  supabase: any,
  studentPortalToken: string | undefined | null
): Promise<{ isAuthenticated: boolean; userId: string | null }> {
  const getUser = async (token: string) => {
    const res = await supabase.auth.getUser(token);
    return {
      data: res.data?.user ? { user: { id: res.data.user.id } } : undefined,
      error: res.error ? { message: res.error.message } : null,
    };
  };
  const result = await verifyAuthFromToken(getUser, studentPortalToken);
  if (!result.isAuthenticated) {
    console.log('[assistant-process] 🔒 Token verification failed: no user');
    return result;
  }
  console.log('[assistant-process] 🔒 Token verified for user:', result.userId?.slice(0, 8) + '...');
  return result;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[assistant-process] ❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: jsonHeaders },
      );
    }
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
      // 🆕 Auth params from Portal frontend
      session_type,
      guest_session_id,
      customer_id: frontend_customer_id,
      student_portal_token: frontend_token,
      // 🆕 UI Context params
      client_action_id,
      client_trace_id, // ✅ P0: End-to-end trace ID
      ui_context,
      type: request_type, // 'message' | 'event' | 'ack'
      // 🆕 ACK params
      ack_name,
      ack_ref,
      ack_success,
      ack_metadata,
      ack_id,
      // ✅ FIX: Extract channel from inbound payload (Portal sends this)
      channel: inbound_channel,
      // ✅ FIX: Extract client_build from Portal
      client_build: inbound_client_build,
    } = body as {
      visitor_id: string;
      text?: string;
      session_id?: string;
      web_user_id?: string;
      name?: string;
      phone?: string;
      locale?: string;
      event?: string | { name: string; payload?: any }; // 🆕 يدعم string أو object
      code?: string;
      intent?: string;
      metadata?: any;
      selected_programs?: string[];
      // 🆕 Auth params
      session_type?: 'guest' | 'authenticated';
      guest_session_id?: string;
      customer_id?: string;
      student_portal_token?: string;
      // 🆕 UI Context params
      client_action_id?: string;
      client_trace_id?: string; // ✅ P0: End-to-end trace ID
      ui_context?: {
        route: string;
        page: string;
        tab: string | null;
        focused_field: string | null;
        lang: string;
        cards_visible?: boolean;
      };
      type?: 'message' | 'event' | 'ack';
      // 🆕 ACK params
      ack_name?: string;
      ack_ref?: { event_id?: string; query_id?: string; sequence?: number };
      ack_success?: boolean;
      ack_metadata?: Record<string, any>;
      ack_id?: string;
      // ✅ FIX: Channel from Portal
      channel?: string;
      client_build?: string;
    };

    // ✅ SECURITY FIX: Extract JWT from Authorization header as fallback
    // Client might send token in body OR header - prefer body, fallback to header
    const authHeader = req.headers.get('authorization');
    const headerStudentPortalToken = req.headers.get('x-student-portal-token');
    const effectiveToken = extractToken(frontend_token, authHeader, headerStudentPortalToken);
    if (!frontend_token && effectiveToken) {
      console.log('[assistant-process] 🔐 Token extracted from request headers');
    }

    // ✅ Fix #3: Events لا تحتاج text - فقط الرسائل العادية
    const isEventRequest = request_type === 'event';
    const isAckRequest = request_type === 'ack';

    const requestId = generateRequestId();
    const finalTraceId = client_trace_id || requestId;

    if (isAckRequest) {
      console.log('[assistant-process] ✅ ACK flow trace id:', finalTraceId);
    }

    if (isEventRequest) {
      console.log('[assistant-process] ✅ Event flow trace id:', finalTraceId);
    }

    if (!isEventRequest && !isAckRequest) {
      console.log('[assistant-process] ✅ Message flow trace id:', finalTraceId);
    }
    
    if (!isEventRequest && !isAckRequest && (!visitor_id || !text)) {
      return new Response(
        JSON.stringify({ error: 'visitor_id & text required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Events and ACKs need visitor_id only
    if ((isEventRequest || isAckRequest) && !visitor_id) {
      return new Response(
        JSON.stringify({ error: 'visitor_id required for events/acks' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 🆕 Handle ACK requests - forward to CRM
    if (isAckRequest) {
      // Initialize Supabase FIRST for JWT verification
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // ✅ SECURITY: Verify authentication via JWT on SERVER (not from client session_type)
      const { isAuthenticated: serverVerifiedAuth } = await verifyAuthenticationStatus(
        supabase, 
        effectiveToken
      );
      
      // ✅ SECURITY: Channel derived from SERVER-VERIFIED identity ONLY
      // NEVER trust client-provided channel - always use expectedChannel
      const expectedChannel = resolveChannel(serverVerifiedAuth);
      
      // Normalize inbound channel for LOGGING ONLY (detect spoofing attempts)
      const normalizedInboundChannel = typeof inbound_channel === 'string' 
        ? inbound_channel.trim().toLowerCase() 
        : null;
      
      // ✅ ALWAYS use server-verified expected channel (NEVER use inbound)
      const ackResolvedChannel = expectedChannel;
      
      // ⚠️ Log mismatch for telemetry (client tried to spoof or misconfigured)
      if (normalizedInboundChannel && normalizedInboundChannel !== expectedChannel) {
        console.warn('[assistant-process] ⚠️ ACK_CHANNEL_SPOOF_ATTEMPT', {
          inboundChannel: normalizedInboundChannel,
          expectedChannel,
          serverVerifiedAuth,
          clientSessionType: session_type,
          visitor_id,
        });
      }
      
      // ✅ SECURITY: Sanitize client_build (max 80 chars, no trust)
      const finalClientBuild = sanitizeClientBuild(inbound_client_build);
      
      const ackValidation = validateAckForForwarding({
        ackName: ack_name || '',
        ackRef: ack_ref,
        ackSuccess: ack_success,
        ackMetadata: ack_metadata,
      });

      console.log('[assistant-process] 📍 ACK received:', { 
        name: ack_name, 
        ref: ack_ref, 
        success: ack_success,
        channel: ackResolvedChannel,
        serverVerifiedAuth,
        client_build: finalClientBuild,
        validation_ok: ackValidation.valid,
        validation_reason: ackValidation.reason || null,
      });

      // Contract guard: do not forward non-render/invalid ACKs
      if (!ackValidation.valid) {
        console.warn('[assistant-process] ⛔ ACK blocked by contract guard', {
          ack_name,
          reason: ackValidation.reason,
          ack_ref,
        });

        return new Response(
          JSON.stringify({ ok: true, type: 'ack_blocked', reason: ackValidation.reason, channel: ackResolvedChannel }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get CRM config
      let CRM_FUNCTIONS_URL = Deno.env.get('CRM_FUNCTIONS_URL');
      let CRM_API_KEY = Deno.env.get('CRM_API_KEY');
      
      if (!CRM_FUNCTIONS_URL || !CRM_API_KEY) {
        const { data: settings } = await supabase
          .from('feature_settings')
          .select('key, value')
          .in('key', ['crm_functions_url', 'crm_api_key']);
        
        if (settings) {
          const settingsMap = Object.fromEntries(
            settings.map((s: any) => [s.key, s.value])
          );
          CRM_FUNCTIONS_URL = CRM_FUNCTIONS_URL || settingsMap['crm_functions_url'];
          CRM_API_KEY = CRM_API_KEY || settingsMap['crm_api_key'];
        }
      }
      
      if (CRM_FUNCTIONS_URL && CRM_API_KEY) {
        // ✅ FIX: Forward ACK with dynamic channel + stamps.entry_fn
        try {
          const ackPayload = buildAckPayload({
            channel: ackResolvedChannel,
            externalConversationId: session_id || visitor_id,
            visitorId: visitor_id,
            customerId: frontend_customer_id,
            clientActionId: client_action_id,
            uiContext: ui_context,
            ackName: ack_name,
            ackRef: ack_ref,
            ackSuccess: ack_success,
            ackMetadata: ack_metadata,
            ackId: ack_id,
            clientBuild: finalClientBuild,
            traceId: finalTraceId,
          });

          assertChannelMatchesStamps(ackPayload.channel, ackPayload.stamps);
          
          await fetch(`${CRM_FUNCTIONS_URL}/web-chat-malak`, {
            method: 'POST',
            headers: buildCrmHeaders({
              apiKey: CRM_API_KEY,
              traceId: finalTraceId,
              proxySecret: Deno.env.get('PORTAL_PROXY_SECRET'),
              studentPortalToken: effectiveToken,
            }),
            body: JSON.stringify(ackPayload),
          });
          console.log('[assistant-process] ✅ ACK forwarded to CRM with channel:', ackResolvedChannel);
        } catch (e) {
          console.error('[assistant-process] ⚠️ ACK forward failed:', e);
        }
      }
      
      // Log ACK event locally (non-fatal) - ✅ Fix: session_id null لأن العمود UUID
      const { error: ackLogError } = await supabase.from('events').insert({
        name: `ack_${ack_name}`,
        tab: 'chat',
        route: ui_context?.route || '/unknown',
        visitor_id,
        session_id: null, // ✅ Fix: UUID column cannot accept string session IDs
        properties: { 
          ack_name,
          ack_ref,
          ack_success,
          ack_metadata,
          ack_id,
          client_action_id,
          channel: ackResolvedChannel, // ✅ FIX: Log channel in properties
          session_key: session_id || null, // ✅ Store string session here instead
        }
      });
      if (ackLogError) {
        console.warn('[assistant-process] ⚠️ Local ACK log failed (non-fatal):', ackLogError);
      }
      
      return new Response(
        JSON.stringify({ ok: true, type: 'ack_forwarded', channel: ackResolvedChannel }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ✅ للـ events: لا نرسل للـ CRM ولا نخزن كرسالة - فقط نسجل event
    if (isEventRequest) {
      console.log('[assistant-process] 📍 UI Event received:', event);
      
      // تسجيل event بدون معالجة CRM
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // استخراج اسم الـ event (قد يكون string أو object)
      const eventName = typeof event === 'object' && event?.name 
        ? event.name 
        : (typeof event === 'string' ? event : 'ui_event');
      
      // Log event locally (non-fatal) - ✅ Fix: session_id null لأن العمود UUID
      const { error: eventLogError } = await supabase.from('events').insert({
        name: eventName,
        tab: 'chat',
        route: ui_context?.route || '/unknown',
        visitor_id,
        session_id: null, // ✅ Fix: UUID column cannot accept string session IDs
        properties: { 
          event_payload: event,
          ui_context,
          client_action_id,
          session_key: session_id || null, // ✅ Store string session here instead
        }
      });
      if (eventLogError) {
        console.warn('[assistant-process] ⚠️ Local event log failed (non-fatal):', eventLogError);
      }
      
      return new Response(
        JSON.stringify({ ok: true, type: 'event_logged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 🔥 قراءة إعدادات CRM من feature_settings
    let CRM_FUNCTIONS_URL = Deno.env.get('CRM_FUNCTIONS_URL');
    let CRM_API_KEY = Deno.env.get('CRM_API_KEY');

    if (!CRM_FUNCTIONS_URL || !CRM_API_KEY) {
      const { data: settings } = await supabase
        .from('feature_settings')
        .select('key, value')
        .in('key', ['crm_functions_url', 'crm_api_key']);

      if (settings) {
        const settingsMap = Object.fromEntries(
          settings.map((s: any) => [s.key, s.value])
        );
        CRM_FUNCTIONS_URL = CRM_FUNCTIONS_URL || settingsMap['crm_functions_url'];
        CRM_API_KEY = CRM_API_KEY || settingsMap['crm_api_key'];
      }
    }

    if (!CRM_FUNCTIONS_URL || !CRM_API_KEY) {
      console.error('[assistant-process] ❌ CRM not configured');
      return new Response(
        JSON.stringify({ error: 'CRM not configured. Please configure in /admin/integrations/crm' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const conversationId = session_id || visitor_id;

    // 🔥 إدارة Session State محلياً
    console.log('[assistant-process] 🔍 Managing session state...');
    
    // قراءة أو إنشاء Session
    let { data: sessionData, error: sessionError } = await supabase
      .from('web_chat_sessions')
      .select('*')
      .eq('external_conversation_id', conversationId)
      .single();

    if (sessionError && sessionError.code !== 'PGRST116') {
      console.error('[assistant-process] Session read error:', sessionError);
    }

    // إنشاء session جديد إذا لم يكن موجوداً
    if (!sessionData) {
      console.log('[assistant-process] 🆕 Creating new session for:', conversationId);
      const { data: newSession, error: insertError } = await supabase
        .from('web_chat_sessions')
        .insert({
          external_conversation_id: conversationId,
          stage: 'initial',
          locale: locale || 'ar',
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('[assistant-process] Session insert error:', insertError);
      } else {
        sessionData = newSession;
        console.log('[assistant-process] ✅ New session created with stage: initial');
      }
    }

    let currentStage = sessionData?.stage || 'initial';
    let currentPhone = sessionData?.phone;
    let currentCustomerId = sessionData?.customer_id;

    console.log('[assistant-process] 📊 Current Session:', {
      stage: currentStage,
      phone: currentPhone ? '✓' : '✗',
      customer_id: currentCustomerId || '(none)'
    });

    // Portal لا يقرر Stage - كل التحكم في CRM
    // Portal يمرر فقط event, phone, code كما هي للـ CRM

    // 🔥 تحضير Payload للـ CRM
    // ✅ SECURITY: Verify authentication via JWT on SERVER (not from client session_type)
    const { isAuthenticated: msgServerVerifiedAuth } = await verifyAuthenticationStatus(
      supabase, 
      effectiveToken
    );
    
    // ✅ SECURITY: Channel derived from SERVER-VERIFIED identity ONLY
    // NEVER trust client-provided channel - always use expectedChannel
    const expectedMsgChannel = resolveChannel(msgServerVerifiedAuth);
    
    // Normalize inbound channel for LOGGING ONLY (detect spoofing attempts)
    const normalizedMsgChannel = typeof inbound_channel === 'string' 
      ? inbound_channel.trim().toLowerCase() 
      : null;
    
    // ✅ ALWAYS use server-verified expected channel (NEVER use inbound)
    const resolvedChannel = expectedMsgChannel;
    
    // ⚠️ Log spoof attempt for telemetry
    if (normalizedMsgChannel && normalizedMsgChannel !== expectedMsgChannel) {
      console.warn('[assistant-process] ⚠️ MSG_CHANNEL_SPOOF_ATTEMPT', {
        inboundChannel: normalizedMsgChannel,
        expectedChannel: expectedMsgChannel,
        serverVerifiedAuth: msgServerVerifiedAuth,
        clientSessionType: session_type,
        visitor_id,
      });
    }
    
    // ✅ SECURITY FIX: Define finalClientBuild for message requests too
    const finalClientBuild = sanitizeClientBuild(inbound_client_build);
    
    // 🆕 ORYXA V2: AI Model preference
    // Options: deepseek/deepseek-chat, openai/gpt-5, openai/gpt-5.2, google/gemini-2.5-pro
    // Default set to DeepSeek unless ORYXA_AI_MODEL overrides it per environment.
    const AI_MODEL_PREFERENCE = Deno.env.get('ORYXA_AI_MODEL') || 'deepseek/deepseek-chat';
    
    // ============================================
    // 🔥 P0-FIX V2: Pre-processing Hints for CRM
    // ============================================
    
    // P0-1: Language Extraction Hints - Map Arabic/common phrases to ISO codes
    const LANGUAGE_HINTS: Record<string, string> = {
      // Arabic
      'الروسية': 'ru', 'روسي': 'ru', 'بالروسي': 'ru', 'بالروسية': 'ru',
      'الإنجليزية': 'en', 'إنجليزي': 'en', 'بالإنجليزي': 'en', 'بالإنجليزية': 'en', 'انجليزي': 'en',
      'العربية': 'ar', 'عربي': 'ar', 'بالعربي': 'ar', 'بالعربية': 'ar',
      'التركية': 'tr', 'تركي': 'tr', 'بالتركي': 'tr', 'بالتركية': 'tr',
      'الألمانية': 'de', 'ألماني': 'de', 'بالألماني': 'de', 'بالألمانية': 'de',
      'الفرنسية': 'fr', 'فرنسي': 'fr', 'بالفرنسي': 'fr', 'بالفرنسية': 'fr',
      'الصينية': 'zh', 'صيني': 'zh', 'بالصيني': 'zh', 'بالصينية': 'zh',
      // English
      'russian': 'ru', 'in russian': 'ru',
      'english': 'en', 'in english': 'en',
      'arabic': 'ar', 'in arabic': 'ar',
      'turkish': 'tr', 'in turkish': 'tr',
      'german': 'de', 'in german': 'de',
      'french': 'fr', 'in french': 'fr',
      'chinese': 'zh', 'in chinese': 'zh',
    };
    
    // P0-2: Override Detection - More specific patterns (avoid false positives)
    // ✅ FIX #4: More restrictive patterns - require explicit override phrases
    const OVERRIDE_PATTERNS = [
      /غيرت رأيي/i, /غيّرت رأيي/i, /غير رأيي/i,
      /بدلاً من ذلك/i, /بدل كذا/i,
      /إلغاء البحث/i, /امسح اللي قلته/i,
      /^actually,?\s+(?:i want|let's|make it)/i,
      /^no,?\s+(?:i meant|change|switch)/i,
      /instead of that/i, /rather than/i,
      /^wait,?\s+(?:i meant|change)/i, /^hold on,?\s+(?:change|make it)/i,
      /^cancel (?:that|the search)/i,
    ];
    
    // ✅ FIX #5: Extract ALL mentioned languages (array), not just first match
    const textLower = (text || '').toLowerCase();
    const extracted_languages: string[] = [];
    const seenCodes = new Set<string>();
    
    for (const [phrase, code] of Object.entries(LANGUAGE_HINTS)) {
      if (textLower.includes(phrase.toLowerCase()) && !seenCodes.has(code)) {
        extracted_languages.push(code);
        seenCodes.add(code);
      }
    }
    
    // Detect override intent
    const override_detected = OVERRIDE_PATTERNS.some(pattern => pattern.test(text || ''));
    
    // ✅ FIX #3: Use plural key name matching the API contract
    const portal_hints = {
      // ✅ PLURAL: instruction_languages (array) - matches V2 contract
      extracted_instruction_languages: extracted_languages.length > 0 ? extracted_languages : null,
      override_detected,
      // ✅ FIX #4: Explicit note that this is "likely" not "certain"
      override_confidence: override_detected ? 'likely' : null,
      hint_version: 'portal_v2',
    };
    
    console.log('[assistant-process] 🔍 P0-HINTS-V2:', {
      trace_id: finalTraceId,
      message_preview: sanitizeForLog(text, 30),
      extracted_languages,
      override_detected,
    });
    
    const crmBody: any = {
      type: 'message', // ✅ Fix: إرسال type صراحةً
      channel: resolvedChannel, // ✅ PORTAL-STEP-2: Dynamic channel
      source: 'customer', // ✅ FIX: CRM allows only: staff|bot|customer|qa
      external_conversation_id: conversationId,
      visitor_id, // ✅ Fix: إرسال visitor_id
      web_user_id,
      name,
      phone: currentPhone || phone,
      locale: locale || 'ar',
      message: text,
      event: event || null, // ✅ Fix: null صراحةً بدلاً من undefined
      stage: currentStage, // ✅ إرسال الـ stage للـ CRM
      customer_id: frontend_customer_id || currentCustomerId, // ✅ أولوية للـ frontend ثم الـ session
      // 🆕 ORYXA V2: AI Model preference
      ai_model_preference: AI_MODEL_PREFERENCE,
      // 🆕 Auth params pass-through
      session_type: msgServerVerifiedAuth ? 'authenticated' : 'guest',
      guest_session_id,
      // 🆕 UI Context params
      client_action_id,
      client_trace_id: finalTraceId, // ✅ P0: Pass trace_id to CRM
      ui_context,
      // 🔥 P0-FIX: Portal pre-processing hints
      portal_hints,
      // ✅ TELEMETRY: Add stamps for audit trail
      stamps: buildStamps(resolvedChannel, finalClientBuild, finalTraceId),
    };

    // إضافة المعاملات الاختيارية (event already set above)
    if (code) crmBody.code = code;
    if (intent) crmBody.intent = intent;
    if (metadata) crmBody.metadata = metadata;
    if (selected_programs) crmBody.selected_programs = selected_programs;

    // ✅ منطق خاص لـ shortlist_complete
    if (event === 'shortlist_complete' && metadata?.program_ids) {
      crmBody.shortlisted_programs = metadata.program_ids;
      crmBody.system_hint = `الطالب اختار ${metadata.program_ids.length} برامج في المفضلة (IDs: ${metadata.program_ids.join(', ')}). اكتب له رسالة تقارن بينها وتوضح الفروقات بناءً على الـ KB.`;
      console.log('[assistant-process] 📋 shortlist_complete:', metadata.program_ids);
    }
    
    // 🆕 P5.3: Special handling for compare_request_v1 - Fetch facts before sending to CRM
    if (event === 'compare_request_v1' && metadata?.program_ids?.length >= 2) {
      console.log('[assistant-process] 🔄 compare_request_v1 detected, fetching facts...');
      
      try {
        // Call compare_programs_v1 internally to get facts
        const compareResponse = await supabase.functions.invoke('student-portal-api', {
          body: {
            action: 'compare_programs_v1',
            program_ids: metadata.program_ids,
            locale: locale || 'ar',
            audience: 'customer',
          },
        });
        
        if (compareResponse.data?.ok) {
          // Inject facts into metadata for CRM
          crmBody.metadata = {
            ...crmBody.metadata,
            compare_facts_v1: {
              version: compareResponse.data.version || 'compare_v1',
              programs: compareResponse.data.programs || [],
              missing_fields: compareResponse.data.missing_fields || {},
              not_found_ids: compareResponse.data.not_found_ids || [],
              request_id: requestId,
            },
            compare_version: metadata.compare_version || 'v1',
            lens: metadata.lens || 'balanced',
            source: metadata.source || 'portal_compare_ui',
          };
          
          console.log('[assistant-process] ✅ compare_facts_v1 injected:', {
            programs_count: compareResponse.data.programs?.length || 0,
            missing_fields_count: Object.keys(compareResponse.data.missing_fields || {}).length,
            not_found_count: compareResponse.data.not_found_ids?.length || 0,
          });
        } else {
          console.warn('[assistant-process] ⚠️ compare_programs_v1 failed:', compareResponse.error);
        }
      } catch (factsError) {
        console.error('[assistant-process] ❌ Facts fetch failed:', factsError);
        // Continue without facts - CRM should handle gracefully
      }
    }

    // ✅ WEB-1: Critical diagnostic log - CRM payload before sending
    const crmUrlFull = `${CRM_FUNCTIONS_URL}/web-chat-malak`;
    console.log('[assistant-process] 🚀 WEB-1 PRE_CRM_PAYLOAD:', {
      request_id: requestId,
      trace_id: finalTraceId, // ✅ FIX #1: Consistent trace ID
      crm_url_full: crmUrlFull,
      payload_channel: crmBody.channel,
      payload_source: crmBody.source,
      payload_message_len: text?.length || 0,
      payload_message_preview: sanitizeForLog(text, 30),
      // P0 hints V2
      portal_hints,
      // Additional debug info
      stage: currentStage,
      has_phone: !!crmBody.phone,
      has_customer_id: !!crmBody.customer_id,
      event: event || '(none)',
    });

    // 🔥 استدعاء CRM مع قياس الـ latency
    const crmStartTime = Date.now();
    
    // ✅ FIX #2: Build headers conditionally (don't send empty secret)
    const crmHeaders = buildCrmHeaders({
      apiKey: CRM_API_KEY,
      traceId: finalTraceId,
      proxySecret: Deno.env.get('PORTAL_PROXY_SECRET'),
      studentPortalToken: effectiveToken,
    });
    
    const response = await fetch(`${CRM_FUNCTIONS_URL}/web-chat-malak`, {
      method: 'POST',
      headers: crmHeaders,
      body: JSON.stringify(crmBody),
    });

    const crmLatencyMs = Date.now() - crmStartTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[assistant-process] ❌ CRM error:', {
        status: response.status,
        body: errorText,
        latency_ms: crmLatencyMs
      });
      
      // تسجيل الخطأ في events (non-fatal) - ✅ Fix: session_id null
      const { error: errorLogError } = await supabase.from('events').insert({
        name: 'bot_response',
        tab: 'chat',
        route: '/chat',
        visitor_id,
        session_id: null, // ✅ Fix: UUID column cannot accept string session IDs
        properties: { 
          latency_ms: crmLatencyMs, 
          status: 'error',
          error_code: response.status,
          session_key: conversationId, // ✅ Store string session here instead
        }
      });
      if (errorLogError) {
        console.warn('[assistant-process] ⚠️ Error event log failed (non-fatal):', errorLogError);
      }
      
      // ✅ IMPORTANT: Return 200 so the web client doesn't throw FunctionsHttpError.
      // We return a *legacy-compatible* payload (reply/need_phone/need_name) so both
      // MalakChatInterface (via adapter) and AssistantPanel can render a fallback message.
      const safePreview = sanitizeForLog(errorText, 120);
      const fallbackReply = `عذراً، يوجد عطل مؤقت في خدمة المساعد حالياً. حاول مرة أخرى بعد قليل.\n\nكود التتبع: ${finalTraceId}`;

      return new Response(
        JSON.stringify({
          ok: false,
          reply: fallbackReply,
          need_phone: false,
          need_name: false,
          // Keep session context if available
          stage: currentStage,
          customer_id: frontend_customer_id || currentCustomerId || null,
          normalized_phone: currentPhone || phone || null,
          // Diagnostics for admins (safe, sanitized)
          _timing: {
            request_id: requestId,
            trace_id: finalTraceId,
            crm_fetch_ms: crmLatencyMs,
            crm_status: response.status,
          },
          _error: {
            code: 'CRM_UPSTREAM_ERROR',
            status: response.status,
            preview: safePreview,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // 🔍 Debug: Log full CRM response for troubleshooting
    console.log('[assistant-process] ✅ CRM Response received');
    console.log('   Reply:', data.reply ? `"${data.reply.substring(0, 50)}..."` : '(empty)');
    console.log('   Stage:', data.stage || 'guest');
    console.log('   Customer ID:', data.customer_id || '(not set)');
    console.log('   Phone:', data.normalized_phone || '(not set)');
    console.log('   Latency:', crmLatencyMs, 'ms');
    
    // ✅ WEB-2: Critical diagnostic log - CRM response passthrough verification
    const upstream_has_cards_query = !!data.cards_query;
    const downstream_has_cards_query = upstream_has_cards_query; // We pass through as-is
    const responseKeys = Object.keys(data);
    
    console.log('[assistant-process] 📥 WEB-2 POST_CRM_RESPONSE:', {
      request_id: requestId,
      crm_http_status: response.status,
      crm_response_keys: responseKeys,
      crm_response_source: data.source || data._source || '(not set)',
      crm_has_cards_query: upstream_has_cards_query,
      cards_query_params: data.cards_query?.params || null,
      // Additional debug info
      has_reply: !!data.reply,
      reply_len: data.reply?.length || 0,
      stage: data.stage,
      has_events: !!data.events,
      is_new_customer: data.is_new_customer,
    });

    // 🔥 تسجيل latency في جدول events (non-fatal) - ✅ Fix: session_id null
    const { error: successLogError } = await supabase.from('events').insert({
      name: 'bot_response',
      tab: 'chat',
      route: '/chat',
      visitor_id,
      session_id: null,
      properties: { 
        latency_ms: crmLatencyMs, 
        status: 'success',
        stage: data.stage,
        customer_id: data.customer_id,
        has_universities: Array.isArray(data.universities) && data.universities.length > 0,
        session_key: conversationId,
      }
    });
    if (successLogError) {
      console.warn('[assistant-process] ⚠️ Success event log failed (non-fatal):', successLogError);
    }

    // 🔥 تحديث Session - استخدم قيم CRM إذا وجدت، أو احتفظ بالقيم الحالية
    const newStage = data.stage || currentStage || 'initial';
    const newCustomerId = data.customer_id || currentCustomerId || null;
    const newPhone = data.normalized_phone || currentPhone || phone || null;
    
    console.log('[assistant-process] 💾 Updating session:', {
      old_stage: currentStage,
      new_stage: newStage,
      old_customer_id: currentCustomerId,
      new_customer_id: newCustomerId,
      old_phone: currentPhone ? '✓' : '✗',
      new_phone: newPhone ? '✓' : '✗',
    });
    
    const { error: updateError } = await supabase
      .from('web_chat_sessions')
      .update({
        stage: newStage,
        customer_id: newCustomerId,
        phone: newPhone,
        last_message_at: new Date().toISOString()
      })
      .eq('external_conversation_id', conversationId);
      
    if (updateError) {
      console.error('[assistant-process] ⚠️ Session update failed:', updateError);
    } else {
      console.log('[assistant-process] ✅ Session updated successfully');
    }

    // ✅ P0: Timing for response (requestId already generated above)
    const totalTime = Date.now() - crmStartTime;
    
    // ✅ P0: Response with timing headers for debugging
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'x-request-id': requestId,
      'x-timing-total-ms': String(totalTime),
      'x-timing-crm-fetch-ms': String(crmLatencyMs),
    };

    // ✅ FIX: Passthrough cards_query and events from CRM response
    // ✅ P0-ENFORCEMENT: ALWAYS add ap_version and ui_directives
    const hasCardsQuery = !!data.cards_query;
    const searchMode = hasCardsQuery ? 'start' : 'hold';
    
    // ============================================================
    // 🔬 DIAGNOSTIC LOG #1: What did CRM (upstream) send us?
    // ============================================================
    console.log('[assistant-process] 🔬 UPSTREAM_ANALYSIS:', {
      request_id: requestId,
      upstream_keys: Object.keys(data),
      upstream_ui_directives: data.ui_directives ?? 'NOT_PRESENT',
      upstream_cards_query_exists: !!data.cards_query,
      upstream_cards_query_id: data.cards_query?.query_id ?? 'NONE',
    });
    
    console.log('[assistant-process] 🎯 P0-ENFORCEMENT:', {
      request_id: requestId,
      has_cards_query: hasCardsQuery,
      enforced_search_mode: searchMode,
    });
    
    const responseJson = {
      ok: true,
      // ✅ P0: MANDATORY - Version stamp for tracing
      ap_version: 'portal-assistant-process-2026-02-01',
      // ✅ P0: MANDATORY - UI Directives for frontend search control
      ui_directives: {
        search_mode: searchMode, // 'start' if cards_query exists, 'hold' otherwise
        // Passthrough any CRM ui_directives
        ...(data.ui_directives || {}),
      },
      reply: data.reply,
      need_name: data.need_name,
      need_phone: data.need_phone,
      customer_id: data.customer_id,
      normalized_phone: data.normalized_phone,
      stage: data.stage,
      is_new_customer: data.is_new_customer ?? false,
      student_portal_token: data.student_portal_token ?? null,
      portal_token_expires_at: data.portal_token_expires_at ?? null,
      universities: data.universities || [],
      stage_info: data.stage_info ?? null,
      guest_state: data.guest_state ?? null,
      // ✅ CRITICAL: Passthrough cards_query for program search
      cards_query: data.cards_query ?? null,
      // ✅ Passthrough events for frontend actions
      events: data.events ?? null,
      latency_ms: crmLatencyMs,
      // ✅ P0: Include timing info in response body for frontend logging
      _timing: {
        request_id: requestId,
        total_ms: totalTime,
        crm_fetch_ms: crmLatencyMs,
      },
    };
    
    // ============================================================
    // 🔬 DIAGNOSTIC LOG #2: What are we returning to Browser?
    // ============================================================
    console.log('[assistant-process] 🔬 FINAL_TO_BROWSER:', {
      request_id: requestId,
      final_keys: Object.keys(responseJson),
      final_ui_directives: responseJson.ui_directives,
      final_ap_version: responseJson.ap_version,
      final_cards_query_id: responseJson.cards_query?.query_id ?? 'NONE',
    });
    
    // ============================================================
    // 🔬 DIAGNOSTIC LOG #3: PASS/FAIL Summary
    // ============================================================
    const upstreamHasUiDirectives = !!data.ui_directives;
    const finalHasUiDirectives = !!responseJson.ui_directives;
    const verdict = finalHasUiDirectives ? 'PASS' : 'FAIL';
    
    console.log('[assistant-process] 🔬 VERDICT:', {
      request_id: requestId,
      upstream_had_ui_directives: upstreamHasUiDirectives,
      final_has_ui_directives: finalHasUiDirectives,
      enforcement_applied: !upstreamHasUiDirectives && finalHasUiDirectives,
      verdict: verdict,
    });
    
    // ✅ WEB-2.5: Critical diagnostic log - ACTUAL JSON being returned to frontend
    console.log('[assistant-process] 📤 WEB-2.5 RETURN_PAYLOAD:', {
      request_id: requestId,
      return_has_cards_query: !!responseJson.cards_query,
      return_keys: Object.keys(responseJson),
      cards_query_snapshot: responseJson.cards_query ? JSON.stringify(responseJson.cards_query).substring(0, 200) : null,
    });
    
    return new Response(
      JSON.stringify(responseJson),
      { headers: responseHeaders }
    );

  } catch (e) {
    console.error('[assistant-process] ❌ Error:', e);
    return new Response(
      JSON.stringify({ error: 'internal', detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
