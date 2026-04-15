import { supabase } from '@/integrations/supabase/client';
import { AssistantResponse, LegacyAssistantResponse, SearchFilters, SearchResponse } from '@/types/assistant';
import { WebChatResponse, WebChatMessage } from '@/types/crm';
import { UiContextV1, buildUiContextV1 } from '@/lib/uiContext';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRef } from 'react';
// ✅ WEB Command Pack v4 - Stable session IDs
import { getSessionIdentifiers, persistIdsFromResponse } from '@/lib/chat/session';
// ✅ ORDER #1: Use Gateway for all CRM calls
import { sendChatMessage } from '@/lib/chat/gateway';
import { resolveLocalizedField } from '@/lib/localization/displayAdapter';
/**
 * Check if response is new WebChatResponse format
 */
function isWebChatResponse(data: any): data is WebChatResponse {
  return data && Array.isArray(data.messages) && data.state !== undefined;
}

/**
 * Adapter: Convert legacy response to new format
 */
export function adaptLegacyResponse(legacy: LegacyAssistantResponse, _messageCount: number = 0): WebChatResponse {
  const replyContent = legacy.reply;

  const hasEnoughConversation = _messageCount >= 2;

  const messages: WebChatMessage[] = typeof replyContent === 'string' && replyContent.trim().length > 0
    ? [
        {
          from: 'bot',
          type: 'text',
          content: replyContent,
          timestamp: new Date()
        }
      ]
    : [];

  // ✅ تحديد الـ state بناءً على stage من CRM أو need_phone/need_otp/need_name
  let state: WebChatResponse['state'] = 'idle';
  
  if (legacy.need_name) {
    state = 'awaiting_name';
  } else if (legacy.stage === 'awaiting_phone' || legacy.need_phone) {
    state = 'awaiting_phone';
  } else if (legacy.stage === 'awaiting_otp') {
    state = 'awaiting_otp';
  }

  // ✅ FIX: Passthrough cards_query from legacy response
  const cardsQuery = (legacy as any).cards_query ?? null;
  if (cardsQuery) {
    console.log('[adaptLegacyResponse] ✅ Passing through cards_query:', cardsQuery);
  }
  
  // ✅ CRITICAL FIX: Passthrough ui_directives from response (P0-ENFORCEMENT)
  const uiDirectives = (legacy as any).ui_directives ?? null;
  if (uiDirectives) {
    console.log('[adaptLegacyResponse] ✅ Passing through ui_directives:', uiDirectives);
  }
  
  // ✅ Passthrough ap_version for diagnostics
  const apVersion = (legacy as any).ap_version ?? null;
  const phase = (legacy as any).phase;
  const missingFields = (legacy as any).missing_fields;
  const replyKey = (legacy as any).reply_key;
  
  return {
    ok: legacy.ok,
    messages,
    universities: legacy.universities || [],
    state,
    actions: legacy.need_phone ? [{ type: 'ASK_PHONE' }] : [],
    customer_id: legacy.customer_id,
    normalized_phone: legacy.normalized_phone,
    stage: legacy.stage,
    is_new_customer: legacy.is_new_customer,
    student_portal_token: legacy.student_portal_token,
    session_state: {},
    need_phone: legacy.need_phone,
    need_name: legacy.need_name,
    need_otp: legacy.stage === 'awaiting_otp',
    // ✅ Flag جديد للتحكم في عرض البرامج
    show_programs: hasEnoughConversation && (legacy.universities?.length || 0) > 0,
    stage_info: legacy.stage_info ?? null,
    guest_state: legacy.guest_state ?? null,
    // ✅ FIX: Passthrough cards_query for search trigger
    cards_query: cardsQuery,
    // ✅ CRITICAL: Passthrough ui_directives for search_mode enforcement
    ui_directives: uiDirectives,
    phase,
    missing_fields: missingFields,
    reply_key: replyKey,
    // ✅ Passthrough ap_version for diagnostics
    ap_version: apVersion,
  };
}

export function useMalakAssistant() {
  // ✅ Fix #1: Use React Router + LanguageContext instead of window/localStorage
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();

  // Cache current values in refs for use in async sendMessage
  const locationRef = useRef({ pathname: location.pathname, tab: searchParams.get('tab') });
  const languageRef = useRef(language);
  
  // 🆕 Fix #3: Request sequence guard (replaces AbortController - supabase-js doesn't support signal)
  const requestSeqRef = useRef(0);
  
  // Update refs when values change
  locationRef.current = { pathname: location.pathname, tab: searchParams.get('tab') };
  languageRef.current = language;

  const sendMessage = async (params: {
    text: string;
    visitor_id: string;
    session_id: string;
    web_user_id?: string;
    name?: string;
    phone?: string;
    locale?: string;
    event?: string;
    code?: string;
    intent?: string;
    metadata?: any;
    // 🆕 Auth params
    session_type?: 'guest' | 'authenticated';
    guest_session_id?: string;
    customer_id?: string;
    student_portal_token?: string;
    // 🆕 UI Context params
    ui_context?: UiContextV1;
    client_action_id?: string;
    // 🆕 Deep Search mode
    deep_search?: boolean;
    filters?: Record<string, unknown>;
    // ✅ 3-Phase Workflow: Consent
    consent?: {
      status: 'granted' | 'declined';
      filters_hash?: string;
    };
  }, messageCount: number = 0): Promise<WebChatResponse & { show_programs?: boolean }> => {
    // 🆕 Fix #3: Increment sequence for stale response detection
    const seq = ++requestSeqRef.current;
    
    // ⏱️ Portal Telemetry: قياس وقت الرد من منظور الواجهة
    const startTime = performance.now();
    
    // 🆕 Generate client_action_id if not provided
    const client_action_id = params.client_action_id || crypto.randomUUID();
    
    // ✅ Fix #1: Auto-build ui_context from React context (not window/localStorage)
    const ui_context = params.ui_context || buildUiContextV1({
      pathname: locationRef.current.pathname,
      tab: locationRef.current.tab,
      lang: languageRef.current || 'ar'
    });
    
    // 🆕 Order #8: Reduce logs in production
    const isDev = import.meta.env.DEV;
    if (isDev) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📤 [useMalakAssistant] SENDING to CRM:');
      console.log('   Text:', params.text || '(empty)');
      console.log('   Visitor ID:', params.visitor_id);
      console.log('   Session ID:', params.session_id);
      console.log('   User ID:', params.web_user_id || '(anonymous)');
      console.log('   Client Action ID:', client_action_id.slice(0, 8) + '...');
      console.log('   UI Context:', ui_context.route, ui_context.page, `tab=${ui_context.tab}`);
      if (params.event) console.log('   Event:', params.event);
      if (params.phone) console.log('   Phone:', params.phone);
      if (params.code) console.log('   Code:', '***');
      if (params.intent) console.log('   Intent:', params.intent);
      if (params.metadata) console.log('   Metadata:', params.metadata);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    // ✅ WEB Command Pack v4: Get stable session identifiers
    const sessionIds = getSessionIdentifiers();
    
    // ✅ P0: Extract client_trace_id from metadata for end-to-end tracing
    const client_trace_id = params.metadata?.client_trace_id;
    
    // ✅ ORDER #1: Use Gateway for all CRM calls
    const response = await sendChatMessage({
      text: params.text,
      visitor_id: params.visitor_id,
      session_id: params.session_id || sessionIds.session_id,
      web_user_id: params.web_user_id,
      name: params.name,
      phone: params.phone,
      locale: params.locale,
      event: params.event,
      code: params.code,
      intent: params.intent,
      metadata: {
        ...(params.metadata || {}),
        guest_session_id: sessionIds.guest_session_id,
        session_id: params.session_id || sessionIds.session_id,
        channel: sessionIds.channel,
        client_trace_id,
      },
      session_type: params.session_type,
      customer_id: params.customer_id,
      student_portal_token: params.student_portal_token,
      ui_context,
      client_action_id,
      deep_search: params.deep_search === true,
      filters: params.filters,
      client_trace_id,
      // ✅ 3-Phase Workflow: Pass consent to gateway
      consent: params.consent,
    });

    const data = response.data;
    const error = response.ok ? null : { message: response.error };
    
    // ✅ WEB Command Pack v4: Persist IDs from response
    if (data && !error) {
      persistIdsFromResponse(data);
    }
    
    // 🆕 Fix #3: Ignore stale responses (seq guard)
    if (seq !== requestSeqRef.current) {
      if (import.meta.env.DEV) console.log('[useMalakAssistant] ⏭️ Stale response ignored');
      return { ok: false, messages: [], universities: [], state: 'idle' } as WebChatResponse & { show_programs?: boolean };
    }

    // ⏱️ قياس الوقت الكلي
    const endTime = performance.now();
    const roundTripMs = Math.round(endTime - startTime);
    
    // ✅ P0: Log timing info from response
    const timing = data?._timing;
    if (isDev) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[Portal Chat] ⏱️ Timing Report:', {
        client_round_trip_ms: roundTripMs,
        server_total_ms: timing?.total_ms || 'N/A',
        crm_fetch_ms: timing?.crm_fetch_ms || data?.latency_ms || 'N/A',
        request_id: timing?.request_id || 'N/A',
        text_preview: params.text?.slice(0, 30) || '(empty)',
      });
    }
    
    // تحذير إذا تجاوز 5 ثواني (always log slow responses)
    if (roundTripMs > 5000) {
      console.warn('⚠️ [Portal] Slow response detected!', {
        client_round_trip_ms: roundTripMs,
        crm_fetch_ms: timing?.crm_fetch_ms || data?.latency_ms || 'N/A',
        request_id: timing?.request_id || 'N/A',
      });
    }
    if (isDev) console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (error) {
      console.error('[useMalakAssistant] ❌ ERROR:', error.message);
      
      // رسالة واضحة للأدمن
      if (error.message?.includes('CRM not configured')) {
        console.error('⚠️ [ADMIN] CRM is not configured! Please go to /admin/integrations/crm');
      }
      
      throw error;
    }

    if (isDev) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📥 [useMalakAssistant] RECEIVED from CRM:');
      console.log('   Format:', isWebChatResponse(data) ? '✅ WebChatResponse' : '⚠️ Legacy');
      
      if (isWebChatResponse(data)) {
        console.log('   Messages:', data.messages?.length || 0);
        console.log('   Universities:', data.universities?.length || 0);
        console.log('   State:', data.state || 'unknown');
        console.log('   Actions:', data.actions?.length || 0);
        // ✅ FIX: Log cards_query for debugging
        if (data.cards_query) {
          console.log('   cards_query:', JSON.stringify(data.cards_query));
        }
      } else {
        // Legacy format
        console.log('   Reply:', data.reply ? `"${data.reply.substring(0, 80)}..."` : '(empty)');
        console.log('   Need Phone:', data.need_phone);
        console.log('   Need Name:', data.need_name);
        // ✅ FIX: Also check legacy for cards_query
        if ((data as any).cards_query) {
          console.log('   cards_query (legacy):', JSON.stringify((data as any).cards_query));
        }
      }
      
      if (data.customer_id) console.log('   Customer ID:', data.customer_id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // 🔍 تفاصيل البرامج المستلمة
      if (data.universities && data.universities.length > 0) {
        console.log('━━━━━━ UNIVERSITIES DATA ━━━━━━');
        console.log('📊 Total Count:', data.universities.length);
        data.universities.slice(0, 5).forEach((uni: any, i: number) => {
          const programName = resolveLocalizedField(uni, 'program_name', language).value || '?';
          const uniName = resolveLocalizedField(uni, 'university_name', language).value || '?';
          const country = resolveLocalizedField(uni, 'country_name', language).value || String((uni as any).country || '?');
          console.log(`   [${i + 1}] ${programName} - ${uniName} - ${country}`);
        });
        if (data.universities.length > 5) {
          console.log(`   ... and ${data.universities.length - 5} more`);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    }

    // Adapter: handle both formats
    if (isWebChatResponse(data)) {
      return data;
    } else {
      // Legacy format - convert with messageCount for program display logic
      console.log(`🔄 [useMalakAssistant] Converting legacy response to WebChatResponse (messageCount: ${messageCount})`);
      return adaptLegacyResponse(data as LegacyAssistantResponse, messageCount);
    }
  };

  const searchUniversities = async (filters: SearchFilters): Promise<SearchResponse> => {
    console.log('[useMalakAssistant] Searching universities:', filters);
    
    const { data, error } = await supabase.functions.invoke('search-universities', {
      body: filters
    });

    if (error) {
      console.error('[useMalakAssistant] Search error:', error);
      throw error;
    }

    console.log('[useMalakAssistant] Search results:', data);
    return data;
  };

  const syncChat = async (params: {
    session_id: string;
    visitor_id: string;
    user_id?: string;
  }) => {
    console.log('[useMalakAssistant] Syncing chat:', params);
    
    try {
      await supabase.functions.invoke('chat-sync', {
        body: params
      });
    } catch (error) {
      console.warn('[useMalakAssistant] Chat sync failed (non-critical):', error);
    }
  };

  return { sendMessage, searchUniversities, syncChat };
}
