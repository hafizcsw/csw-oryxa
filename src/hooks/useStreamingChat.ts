import { useRef, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { WebChatResponse, WebChatMessage } from '@/types/crm';
import { UiContextV1, buildUiContextV1 } from '@/lib/uiContext';
import { getSessionIdentifiers, persistIdsFromResponse } from '@/lib/chat/session';
import { buildCrmHeaders } from '@/lib/crmHeaders';
import { resolveGatewayAuthorization } from '@/lib/chat/gateway';
import { buildEnvelopeV12, captureStateRevFromResponse } from '@/lib/chat/envelopeV12';
import { LOCKED_SET } from '@/lib/chat/contracts';
import { supabase } from '@/integrations/supabase/client';

export interface StreamingCallbacks {
  /** Called with each text delta as it arrives */
  onDelta: (delta: string) => void;
  /** Called when streaming starts */
  onStart?: () => void;
  /** Called when streaming completes with final response */
  onComplete: (response: WebChatResponse) => void;
  /** Called on error */
  onError: (error: Error) => void;
}

export interface StreamingParams {
  text: string;
  message?: string;
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
  session_type?: 'guest' | 'authenticated';
  guest_session_id?: string;
  customer_id?: string;
  student_portal_token?: string;
  ui_context?: UiContextV1;
  client_action_id?: string;
  // 🆕 Deep Search mode
  deep_search?: boolean;
}


function stripLockedKeysDeep(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (LOCKED_SET.has(key)) {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = stripLockedKeysDeep(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * PORTAL-1: Streaming Chat Hook
 * Provides ChatGPT-like token-by-token streaming experience
 */
export function useStreamingChat() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  
  const locationRef = useRef({ pathname: location.pathname, tab: searchParams.get('tab') });
  const languageRef = useRef(language);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Update refs when values change
  locationRef.current = { pathname: location.pathname, tab: searchParams.get('tab') };
  languageRef.current = language;

  /**
   * Send a message with streaming response
   */
  const sendMessageStreaming = useCallback(async (
    params: StreamingParams,
    callbacks: StreamingCallbacks
  ): Promise<void> => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const client_action_id = params.client_action_id || crypto.randomUUID();
    
    const ui_context = params.ui_context || buildUiContextV1({
      pathname: locationRef.current.pathname,
      tab: locationRef.current.tab,
      lang: languageRef.current || 'ar'
    });

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const isDev = import.meta.env.DEV;
    if (isDev) {
      console.log('[useStreamingChat] 📤 Starting streaming request:', {
        text: params.text?.substring(0, 30),
        session_id: params.session_id,
      });
    }

    // ✅ WEB Command Pack v4 - Stable session IDs
    const sessionIds = getSessionIdentifiers();

    try {
      callbacks.onStart?.();
      
      const message = (params.message || params.text || '').trim();
      const sessionType = params.session_type === 'authenticated' ? 'authenticated' : 'guest';
      const stableSessionId = params.session_id || sessionIds.session_id;
      const traceId = params.metadata?.client_trace_id || crypto.randomUUID();
      const legacyPayload = {
        ...params,
        message,
        client_action_id,
        ui_context,
        deep_search: params.deep_search === true,
        guest_session_id: sessionIds.guest_session_id,
        session_id: stableSessionId,
        channel: sessionType === 'authenticated' ? 'web_portal' : 'web_chat',
        stamps: {
          session_type: sessionType,
        },
      };

      const body = JSON.parse(JSON.stringify(stripLockedKeysDeep(buildEnvelopeV12({
        envelope_type: 'chat_message',
        payload: legacyPayload,
        session_id: stableSessionId,
        session_type: sessionType,
        locale: params.locale || languageRef.current || 'ar',
        output_locale: params.locale || languageRef.current || 'ar',
        trace_id: traceId,
        retry_key: params.client_action_id || `stream:${stableSessionId}:${message}`,
        customer_id: params.customer_id,
      }))));

      if (!body || Object.keys(body).length === 0 || !message) {
        console.error('[useStreamingChat] Refusing empty streaming payload', {
          hasBody: Boolean(body),
          keys: Object.keys(body || {}).length,
          hasMessage: Boolean(body?.message),
          hasText: Boolean(body?.text),
        });
        throw new Error('Refusing to send empty streaming payload');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const authorization = resolveGatewayAuthorization(sessionType, session?.access_token, SUPABASE_KEY);
      const headers = {
        ...buildCrmHeaders({
          studentPortalToken: params.student_portal_token,
          traceId,
        }),
      } as Record<string, string>;
      if (authorization) {
        headers.Authorization = authorization;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/portal-chat-proxy-stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let finalResponse: WebChatResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events line by line
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          // Handle CRLF
          if (line.endsWith('\r')) line = line.slice(0, -1);
          
          // Skip comments and empty lines
          if (line.startsWith(':') || line.trim() === '') continue;
          
          // Must be a data line
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          
          // Check for end of stream
          if (jsonStr === '[DONE]') {
            if (isDev) console.log('[useStreamingChat] ✅ Stream complete');
            if (finalResponse) {
              persistIdsFromResponse(finalResponse);
              captureStateRevFromResponse(stableSessionId, finalResponse);
              callbacks.onComplete(finalResponse);
            }
            return;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            
            // Handle different event types
            if (parsed.type === 'delta' && parsed.delta) {
              // Text chunk
              accumulatedText += parsed.delta;
              callbacks.onDelta(parsed.delta);
            } else if (parsed.type === 'complete') {
              // Full response (fallback mode or final event)
              finalResponse = parsed as WebChatResponse;
            } else if (parsed.type === 'error') {
              throw new Error(parsed.detail || 'Unknown streaming error');
            } else if (parsed.reply !== undefined) {
              // Non-streaming fallback response
              finalResponse = {
                ok: parsed.ok ?? true,
                messages: [{
                  from: 'bot',
                  type: 'text',
                  content: parsed.reply,
                  timestamp: new Date(),
                }],
                universities: parsed.universities || [],
                state: parsed.state || 'idle',
                actions: [],
                customer_id: parsed.customer_id,
                normalized_phone: parsed.normalized_phone,
                stage: parsed.stage,
                is_new_customer: parsed.is_new_customer,
                student_portal_token: parsed.student_portal_token,
                session_state: {},
                need_phone: parsed.need_phone,
                need_name: parsed.need_name,
                stage_info: parsed.stage_info,
                guest_state: parsed.guest_state,
                events: parsed.events,
              };
            }
          } catch (parseError) {
            // Put incomplete JSON back into buffer
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === 'complete' || parsed.reply !== undefined) {
              finalResponse = parsed;
            }
          } catch { /* ignore */ }
        }
      }

      // If we got a final response, call complete
      if (finalResponse) {
        // ✅ WEB Command Pack v4 - Persist IDs from response
        persistIdsFromResponse(finalResponse);
        captureStateRevFromResponse(stableSessionId, finalResponse);
        callbacks.onComplete(finalResponse);
      } else if (accumulatedText) {
        // Build response from accumulated text
        callbacks.onComplete({
          ok: true,
          messages: [{
            from: 'bot',
            type: 'text',
            content: accumulatedText,
            timestamp: new Date(),
          }],
          universities: [],
          state: 'idle',
          actions: [],
          session_state: {},
        });
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        if (isDev) console.log('[useStreamingChat] Request aborted');
        return;
      }
      console.error('[useStreamingChat] ❌ Error:', error);
      callbacks.onError(error as Error);
    }
  }, []);

  /**
   * Cancel ongoing streaming request
   */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { sendMessageStreaming, cancelStream };
}
