/**
 * ============================================================
 * PORTAL CHAT GATEWAY - Single Entry Point for CRM Communication
 * ============================================================
 * 
 * This is the ONLY file that should communicate with the Portal chat proxy.
 * All chat components MUST use this gateway.
 * 
 * CONTRACT:
 * - sendChatMessage() → type: "message"
 * - sendChatEvent() → type: "event"  
 * - sendChatAck() → type: "ack"
 * 
 * GUARDRAILS (Order #0):
 * - All requests go through portal-chat-proxy ONLY
 * - No direct calls to web-chat-malak or any other endpoint
 * - Strict payload structure enforced
 * - LOCKED keys never leave Portal (tuition_basis, is_active, etc.)
 */

import { supabase } from '@/integrations/supabase/client';
import { getSessionIdentifiers, getSessionIdentity } from './session';
import { UiContextV1 } from '@/lib/uiContext';
import { LOCKED_SET } from './contracts';
import { ACK_NAMES } from './constants';
import { BUILD_ID } from '@/lib/program/validators';
import { buildCrmHeaders } from '@/lib/crmHeaders';
import { buildEnvelopeV12, captureStateRevFromResponse, EnvelopeType, EnvelopeValidationError, setLastKnownStateRev } from './envelopeV12';

// ============================================================
// CLIENT BUILD STAMP (for CRM telemetry traceability)
// ============================================================
const CLIENT_BUILD = `portal-${BUILD_ID}`;

// ============================================================
// ENTRY_FN: Portal identity for CRM differentiation
// ============================================================
// STRICT: This distinguishes Portal from Main Chat in CRM telemetry
// Main Chat should use a DIFFERENT entry_fn (e.g., "main-chat-ui")
const ENTRY_FN = 'portal-chat-ui' as const;

// ============================================================
// TYPES
// ============================================================

export interface GatewayMessagePayload {
  text: string;
  message?: string;
  visitor_id: string;
  session_id?: string;
  web_user_id?: string;
  name?: string;
  phone?: string;
  locale?: string;
  event?: string;
  code?: string;
  intent?: string;
  metadata?: Record<string, unknown>;
  session_type?: 'guest' | 'authenticated';
  customer_id?: string;
  student_portal_token?: string;
  ui_context?: UiContextV1;
  client_action_id?: string;
  deep_search?: boolean;
  filters?: Record<string, unknown>;
  client_trace_id?: string;
  client_mode?: string;
  client_capabilities?: Record<string, unknown>;
  // Consent workflow
  consent?: {
    status: 'granted' | 'declined';
    filters_hash?: string;
  };
}

export interface GatewayEventPayload {
  name: string;
  payload: Record<string, unknown>;
  visitor_id?: string;
  session_id?: string;
  ui_context?: UiContextV1;
  client_action_id?: string;
}

export interface GatewayAckPayload {
  ack_name: string;
  ack_ref: {
    query_id?: string;
    sequence?: number;
    event_id?: string;
    patch_id?: string;
    program_id?: string;
  };
  ack_success: boolean;
  ack_metadata?: {
    count?: number;
    program_ids?: string[];
    reason?: string;
    error?: string;
    [key: string]: unknown;
  };
  visitor_id?: string;
  session_id?: string;
  customer_id?: string;
  ui_context?: UiContextV1;
  client_action_id?: string;
  client_trace_id?: string;
  ack_id?: string;
  ack_meta?: Record<string, unknown>;
}

export interface GatewayResponse<T = any> {
  ok: boolean;
  data: T | null;
  error: string | null;
  latency_ms: number;
}

// ============================================================
// GATEWAY CORE
// ============================================================

const ENDPOINT = 'portal-chat-proxy';
const STREAM_ENDPOINT = 'portal-chat-proxy-stream';

function isForceStreamEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('forceStream') === '1';
}

async function parseSSEToFinalJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.body) {
    throw new Error('Streaming response body missing');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalPayload: Record<string, unknown> | null = null;
  let lastParsedPayload: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') {
        return finalPayload ?? lastParsedPayload ?? {};
      }

      try {
        const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
        lastParsedPayload = parsed;
        if (parsed.type === 'error') {
          throw new Error(String(parsed.detail || 'Unknown streaming error'));
        }
        if (parsed.type === 'complete' || parsed.reply !== undefined || parsed.ok !== undefined) {
          finalPayload = parsed;
        }
      } catch {
        continue;
      }
    }
  }

  return finalPayload ?? lastParsedPayload ?? {};
}

function toSerializableBody(body: Record<string, unknown>): Record<string, unknown> {
  const normalized = JSON.parse(JSON.stringify(body, (_key, value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    return value;
  })) as Record<string, unknown>;

  if (!normalized || Object.keys(normalized).length === 0) {
    console.error('[ChatGateway] Refusing empty payload serialization', {
      hasBody: Boolean(body),
      bodyKeys: Object.keys(body || {}).length,
      type: typeof body.envelope_type === 'string' ? body.envelope_type : 'unknown',
    });
    throw new Error('Refusing to send empty chat payload');
  }

  if (normalized.envelope_type === 'chat_message') {
    const payload = (normalized.payload ?? {}) as Record<string, unknown>;
    const message = typeof payload.message === 'string' ? payload.message : '';
    const text = typeof payload.text === 'string' ? payload.text : '';

    if (!message.trim() && !text.trim()) {
      console.error('[ChatGateway] Refusing empty chat_message payload', {
        envelope_type: 'chat_message',
        hasMessage: Boolean(message),
        hasText: Boolean(text),
      });
      throw new Error('Refusing to send chat_message with empty message/text');
    }
  }

  return normalized;
}

/**
 * GUARDRAIL: Remove any LOCKED keys from payload
 * This ensures tuition_basis, is_active, etc. never leave Portal
 */
function stripLockedKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (LOCKED_SET.has(key)) {
      if (import.meta.env.DEV) {
        console.warn(`[ChatGateway] 🔒 Stripped LOCKED key from payload: ${key}`);
      }
      continue;
    }
    // Recursively strip from nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = stripLockedKeys(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================
// PORTAL-ORDER-3: Assertion Guards (Fail-Closed)
// ============================================================

/**
 * CRITICAL: Prevent sending payloads with mismatched session_type/channel
 * This catches identity bugs BEFORE they reach CRM.
 * PORTAL-ORDER-P3: Print payload (without secrets) before throwing
 */
function assertSessionIdentity(
  session_type: string, 
  channel: string, 
  payload: Record<string, unknown>
): void {
  // REMOVED: test_mode bypass was a Zero-Trust violation (client could skip guards)
  // CRM handles canonicalization server-side; Portal MUST always enforce guards

  const errors: string[] = [];
  
  if (session_type === 'guest' && channel !== 'web_chat') {
    errors.push(`❌ ASSERTION FAILED: Guest session but channel="${channel}" (expected "web_chat")`);
  }
  
  if (session_type === 'authenticated' && channel !== 'web_portal') {
    errors.push(`❌ ASSERTION FAILED: Authenticated session but channel="${channel}" (expected "web_portal")`);
  }
  
  if (errors.length > 0) {
    const msg = errors.join('\n');
    // PORTAL-ORDER-P3: Print safe payload (strip secrets)
    const safePayload = {
      session_type,
      channel,
      channel_in_payload: payload.channel,
      envelope_type: payload.envelope_type,
      trace_id: String(payload.trace_id || '').substring(0, 8),
      // NO customer_id, student_portal_token, etc.
    };
    console.error('[ChatGateway] ❌ PORTAL-ORDER-P3: Identity mismatch detected');
    console.error('[ChatGateway] Safe Payload:', JSON.stringify(safePayload, null, 2));
    console.error('[ChatGateway] ' + msg);
    throw new Error(`PORTAL-ORDER-P3: ${msg}`);
  }
}

/**
 * Internal helper to send requests to portal-chat-proxy
 */
async function invokeGateway<T>(
  body: ({ session_type?: 'guest' | 'authenticated' } & Record<string, unknown>)
): Promise<GatewayResponse<T>> {
  const startTime = performance.now();
  
  // GUARDRAIL: Strip any LOCKED keys before sending
  const safeBody = stripLockedKeys(body);
  const serializableBody = toSerializableBody(safeBody);
  const isChatMessageEnvelope = serializableBody.envelope_type === 'chat_message';
  const forceStream = isChatMessageEnvelope && isForceStreamEnabled();
  
  try {
    // Use fetch directly to avoid Supabase SDK body serialization issues
    // when custom headers are provided (known constraint)
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const traceId = typeof serializableBody.trace_id === 'string' ? serializableBody.trace_id : undefined;
    const headers = buildCrmHeaders({
      studentPortalToken: typeof (safeBody.payload as any)?.student_portal_token === 'string' ? (safeBody.payload as any).student_portal_token : undefined,
      traceId,
    });

    const { data: { session } } = await supabase.auth.getSession();
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
    const channel = typeof serializableBody.channel === 'string' ? serializableBody.channel : '';
    const inferredSessionType: 'guest' | 'authenticated' =
      body.session_type === 'authenticated'
        ? 'authenticated'
        : channel === 'web_portal'
          ? 'authenticated'
          : 'guest';
    const authorization = resolveGatewayAuthorization(inferredSessionType, session?.access_token, anonKey);
    if (authorization) {
      headers['Authorization'] = authorization;
    }

    const endpoint = forceStream ? STREAM_ENDPOINT : ENDPOINT;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(serializableBody),
    });
    
    const latency_ms = Math.round(performance.now() - startTime);
    
    if (!response.ok) {
      const errText = await response.text();
      try {
        const parsedErr = JSON.parse(errText) as Record<string, unknown>;
        const currentStateRev = parsedErr.current_state_rev;
        if (typeof currentStateRev === 'number' && Number.isFinite(currentStateRev) && typeof serializableBody.session_id === 'string') {
          setLastKnownStateRev(serializableBody.session_id, currentStateRev);
        }
      } catch {
        // ignore non-JSON upstream error payloads
      }
      console.error('[ChatGateway] ❌ Error:', response.status, errText);
      return { ok: false, data: null, error: `Edge function returned ${response.status}: ${errText}`, latency_ms };
    }

    const data = forceStream
      ? await parseSSEToFinalJson(response) as T
      : await response.json() as T;

    if (typeof serializableBody.session_id === 'string') {
      captureStateRevFromResponse(serializableBody.session_id, data);
    }
    return { ok: true, data, error: null, latency_ms };
  } catch (e) {
    const latency_ms = Math.round(performance.now() - startTime);
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('[ChatGateway] ❌ Exception:', errorMessage);
    return { ok: false, data: null, error: errorMessage, latency_ms };
  }
}



export function createGatewayStamps(sessionType: 'guest' | 'authenticated'): { session_type: 'guest' | 'authenticated' } {
  return { session_type: sessionType };
}

export function resolveGatewayMessage(payload: Pick<GatewayMessagePayload, 'text' | 'message'>): string {
  const message = (payload.message ?? '').trim();
  return message.length > 0 ? message : payload.text;
}

export function resolveGatewayAuthorization(
  sessionType: 'guest' | 'authenticated',
  accessToken?: string | null,
  _anonKey?: string | null
): string | undefined {
  if (sessionType === 'guest') {
    return undefined;
  }

  if (!accessToken) {
    throw new Error('Authenticated chat request requires a real access token');
  }

  return `Bearer ${accessToken}`;
}

/**
 * Send a chat message to CRM
 * 
 * @example
 * const response = await sendChatMessage({
 *   text: "أريد دراسة الطب في تركيا",
 *   visitor_id: "...",
 *   ui_context: { route: "/", page: "home", tab: null, lang: "ar" }
 * });
 */
/**
 * DEV ONLY: Mock CRM response for isolated Portal testing
 * 
 * Activation:
 * ONLY via explicit env flag: VITE_ENABLE_MOCK_CRM=true
 * Text triggers have been REMOVED for security.
 */
function getMockCRMResponse(): Record<string, unknown> | null {
  // STRICT: Only enable via explicit env flag
  const mockEnabled = import.meta.env.VITE_ENABLE_MOCK_CRM === 'true';
  
  if (!mockEnabled) return null;
  
  const queryId = `cq_mock_${Date.now()}`;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 [MOCK CRM] Returning mock response');
  console.log('   search_mode: start');
  console.log('   query_id:', queryId);
  console.log('   params: { country_code: "TR" }');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return {
    ok: true,
    reply: '🧪 MOCK: سأبحث لك عن برامج في تركيا!',
    ui_directives: { search_mode: 'start' },
    cards_query: {
      query_id: queryId,
      sequence: 1,
      params: { country_code: 'TR' }
    },
    state: 'idle',
    messages: [
      {
        from: 'bot',
        type: 'text',
        content: '🧪 MOCK: سأبحث لك عن برامج في تركيا!',
        timestamp: new Date()
      }
    ],
    universities: []
  };
}

function buildGatewayEnvelope(
  envelopeType: EnvelopeType,
  params: {
    payload: Record<string, unknown>;
    session_id: string;
    session_type: 'guest' | 'authenticated';
    locale: string;
    trace_id: string;
    retry_key: string;
    customer_id?: string;
    filters?: Record<string, unknown>;
  }
): Record<string, unknown> {
  return buildEnvelopeV12({
    envelope_type: envelopeType,
    payload: params.payload,
    session_id: params.session_id,
    session_type: params.session_type,
    locale: params.locale,
    output_locale: params.locale,
    trace_id: params.trace_id,
    retry_key: params.retry_key,
    customer_id: params.customer_id,
    filters: params.filters,
  });
}

export async function sendChatMessage<T = any>(
  payload: GatewayMessagePayload
): Promise<GatewayResponse<T>> {
  // PORTAL-ORDER-2: ASYNC session identity check (CRITICAL for accurate auth detection)
  // We check Supabase Auth FIRST before using localStorage-based identity
  let identity = getSessionIdentity();
  
  // PORTAL-REQ-1: Check ACTUAL Supabase auth session (async but essential)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && session?.access_token) {
      // User has active Supabase auth session → MUST be authenticated
      identity = {
        session_type: 'authenticated',
        channel: 'web_portal',
        isForced: false
      };
      // Auto-clear forced guest flag since user is authenticated
      // PORTAL-1: Use unified flag name 'chat_force_guest'
      const wasForced = localStorage.getItem('chat_force_guest') === 'true';
      if (wasForced) {
        localStorage.removeItem('chat_force_guest');
        console.log('[ChatGateway] 🔓 PORTAL-REQ-1: Auto-cleared forced guest (Supabase auth detected)');
      }
    } else if (identity.session_type === 'authenticated') {
      // Fail-closed: never send authenticated session_type without a real JWT
      identity = {
        session_type: 'guest',
        channel: 'web_chat',
        isForced: false,
      };
      console.warn('[ChatGateway] ⚠️ Missing access token, downgraded to guest session');
    }
  } catch (e) {
    console.warn('[ChatGateway] ⚠️ Failed to check Supabase auth session, using localStorage identity');
  }
  
  const sessionIds = getSessionIdentifiers(identity.session_type === 'authenticated');
  const client_action_id = payload.client_action_id || crypto.randomUUID();
  const client_trace_id: string = (typeof payload.client_trace_id === 'string' && payload.client_trace_id)
    || (typeof payload.metadata?.client_trace_id === 'string' && payload.metadata.client_trace_id)
    || crypto.randomUUID();
  
  // DEV ONLY: Return mock response if VITE_ENABLE_MOCK_CRM=true
  const mockResponse = getMockCRMResponse();
  if (mockResponse) {
    console.log('[ChatGateway] 🧪 Mock CRM enabled via VITE_ENABLE_MOCK_CRM');
    return {
      ok: true,
      data: mockResponse as T,
      error: null,
      latency_ms: 50
    };
  }
  
  const stableSessionId = payload.session_id || sessionIds.session_id;

  const messagePayload = {
    type: 'message',
    ...payload,
    message: resolveGatewayMessage(payload),
    guest_session_id: sessionIds.guest_session_id,
    session_id: stableSessionId,
    channel: identity.channel,
    entry_fn: ENTRY_FN,
    session_type: identity.session_type,
    client_action_id,
    client_trace_id,
    client_build: CLIENT_BUILD,
    stamps: createGatewayStamps(identity.session_type),
    metadata: {
      ...(payload.metadata || {}),
      guest_session_id: sessionIds.guest_session_id,
      session_id: stableSessionId,
      channel: identity.channel,
      session_type: identity.session_type,
      entry_fn: ENTRY_FN,
      client_trace_id,
      client_build: CLIENT_BUILD,
    },
  };

  let body: Record<string, unknown>;
  try {
    body = buildGatewayEnvelope('chat_message', {
      payload: messagePayload,
      session_id: stableSessionId,
      session_type: identity.session_type,
      locale: payload.locale || 'ar',
      trace_id: client_trace_id,
      retry_key: payload.client_action_id || `chat:${stableSessionId}:${resolveGatewayMessage(payload)}`,
      customer_id: payload.customer_id,
      filters: payload.filters,
    });
  } catch (error) {
    if (error instanceof EnvelopeValidationError) {
      return { ok: false, data: null, error: error.key, latency_ms: 0 };
    }
    throw error;
  }
  
  // PORTAL-ORDER-P2: Evidence Log (DEV only) — FULL traceability
  if (import.meta.env.DEV) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 [PORTAL EVIDENCE] sendChatMessage');
    console.log('   client_trace_id:', client_trace_id);
    console.log('   session_type:', identity.session_type);
    console.log('   channel:', identity.channel);
    console.log('   metadata.channel:', ((body.payload as any)?.metadata as any)?.channel);
    console.log('   entry_fn:', ENTRY_FN);
    console.log('   forced_guest:', identity.isForced);
    console.log('   text:', payload.text?.substring(0, 40) + '...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
  
  // PORTAL-ORDER-P3: Assert AFTER building body, pass body for logging
  assertSessionIdentity(identity.session_type, identity.channel, body);
  
  const result = await invokeGateway<T>(body);
  
  // ✅ EVIDENCE LOG: Print ap_version from CRM response + client_build sent
  if (result.ok && result.data) {
    const responseData = result.data as Record<string, unknown>;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 [PORTAL EVIDENCE] CRM Response Received');
    console.log('   ap_version:', responseData.ap_version ?? 'not_provided');
    console.log('   client_build sent:', CLIENT_BUILD);
    console.log('   search_mode:', (responseData.ui_directives as any)?.search_mode ?? 'not_set');
    console.log('   query_id:', (responseData.cards_query as any)?.query_id ?? 'none');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
  
  return result;
}

/**
 * Send an event to CRM (UI actions, navigation, etc.)
 * 
 * @example
 * await sendChatEvent({
 *   name: 'shortlist_toggle',
 *   payload: { program_id: '...', to_state: 'saved' }
 * });
 */
export async function sendChatEvent(
  payload: GatewayEventPayload
): Promise<GatewayResponse<void>> {
  const identity = getSessionIdentity();
  const session_type = identity.session_type === 'authenticated' ? 'authenticated' : 'guest';
  const sessionIds = getSessionIdentifiers(session_type === 'authenticated');
  const client_action_id = payload.client_action_id || crypto.randomUUID();
  const visitor_id = payload.visitor_id || localStorage.getItem('malak_visitor_id') || sessionIds.session_id;
  
  const stableSessionId = payload.session_id || sessionIds.session_id;
  const traceId = crypto.randomUUID();

  let body: Record<string, unknown>;
  try {
    body = buildGatewayEnvelope('control_patch', {
      payload: {
        type: 'event',
        session_id: stableSessionId,
        visitor_id,
        client_action_id,
        client_build: CLIENT_BUILD,
        ui_context: payload.ui_context,
        event: {
          name: payload.name,
          payload: payload.payload,
        },
      },
      session_id: stableSessionId,
      session_type,
      locale: 'ar',
      trace_id: traceId,
      retry_key: payload.client_action_id || `event:${stableSessionId}:${payload.name}:${JSON.stringify(payload.payload)}`,
    });
  } catch (error) {
    if (error instanceof EnvelopeValidationError) {
      return { ok: false, data: null, error: error.key, latency_ms: 0 };
    }
    throw error;
  }
  
  if (import.meta.env.DEV) {
    console.log('[ChatGateway] 📤 EVENT:', payload.name);
  }
  
  return invokeGateway<void>(body);
}


export function createDeterministicAckId(payload: GatewayAckPayload, sessionId: string): string {
  const queryId = payload.ack_ref?.query_id;
  const sequence = payload.ack_ref?.sequence;

  if (payload.ack_name === ACK_NAMES.CARDS_RENDERED && queryId && typeof sequence === 'number') {
    return `cards_rendered:${queryId}:${sequence}`;
  }

  const base = [
    payload.ack_name,
    sessionId,
    queryId || '',
    typeof sequence === 'number' ? String(sequence) : '',
    payload.ack_ref?.event_id || '',
    payload.ack_ref?.patch_id || '',
    payload.ack_ref?.program_id || '',
  ].join('|');

  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  }

  return `ack_${Math.abs(hash).toString(36)}`;
}

/**
 * Send an ACK to CRM (confirming UI actions)
 * CRITICAL: Must include query_id and count for cards_rendered
 * 
 * @example
 * await sendChatAck({
 *   ack_name: 'cards_rendered',
 *   ack_ref: { query_id: 'cq_...', sequence: 1 },
 *   ack_success: true,
 *   ack_metadata: { count: 7, program_ids: ['p1', 'p2'] }
 * });
 */
export async function sendChatAck(
  payload: GatewayAckPayload
): Promise<GatewayResponse<void>> {
  const isAuthenticated = !!payload.customer_id;
  const sessionIds = getSessionIdentifiers(isAuthenticated);
  const client_action_id = payload.client_action_id || crypto.randomUUID();
  const visitor_id = payload.visitor_id || localStorage.getItem('malak_visitor_id') || sessionIds.session_id;
  const client_trace_id = payload.client_trace_id || crypto.randomUUID();
  const ack_id = payload.ack_id || createDeterministicAckId(payload, payload.session_id || sessionIds.session_id);
  const session_type = isAuthenticated ? 'authenticated' : 'guest';
  const channel = session_type === 'authenticated' ? 'web_portal' : 'web_chat';
  const renderedAt = new Date().toISOString();
  const ack_meta = {
    rendered_at: renderedAt,
    timestamp: renderedAt,
    entry_fn: ENTRY_FN,
    channel,
    session_type,
    client_trace_id,
    client_action_id,
    portal_build: CLIENT_BUILD,
    ...(typeof payload.ack_meta?.auth_present === 'boolean' ? { auth_present: payload.ack_meta.auth_present } : {}),
    ack_id,
  };

  // GUARDRAIL: cards_rendered MUST have query_id and count
  if (payload.ack_name === ACK_NAMES.CARDS_RENDERED) {
    if (!payload.ack_ref?.query_id) {
      console.warn('[ChatGateway] ⚠️ cards_rendered ACK missing query_id');
    }
    if (payload.ack_metadata?.count === undefined) {
      console.warn('[ChatGateway] ⚠️ cards_rendered ACK missing count');
    }
  }
  
  const stableSessionId = payload.session_id || sessionIds.session_id;
  let body: Record<string, unknown>;
  try {
    body = buildGatewayEnvelope('render_receipt', {
      payload: {
        type: 'ack',
        session_id: stableSessionId,
        visitor_id,
        customer_id: payload.customer_id,
        client_action_id,
        client_build: CLIENT_BUILD,
        ui_context: payload.ui_context,
        ack_name: payload.ack_name,
        ack_ref: {
          query_id: payload.ack_ref?.query_id ?? null,
          sequence: payload.ack_ref?.sequence ?? null,
          ...payload.ack_ref,
        },
        ack_success: payload.ack_success,
        ack_meta,
        ack_metadata: {
          ...(payload.ack_metadata || {}),
          ack_id,
        },
        client_trace_id,
        ack_id,
      },
      session_id: stableSessionId,
      session_type,
      locale: 'ar',
      trace_id: client_trace_id,
      retry_key: payload.client_action_id || `ack:${ack_id}`,
      customer_id: payload.customer_id,
    });
  } catch (error) {
    if (error instanceof EnvelopeValidationError) {
      return { ok: false, data: null, error: error.key, latency_ms: 0 };
    }
    throw error;
  }
  
  if (import.meta.env.DEV) {
    console.log('[ChatGateway] 📤 ACK:', payload.ack_name, payload.ack_ref, ack_id, client_trace_id.slice(0, 8));
  }
  
  return invokeGateway<void>(body);
}

// ============================================================
// GUARDRAILS: Verification helpers
// ============================================================

/**
 * Check if a URL is the allowed gateway endpoint
 * Used for debugging and monitoring
 */
export function isAllowedEndpoint(url: string): boolean {
  return url.includes(ENDPOINT);
}

/**
 * Get the gateway endpoint name
 */
export function getGatewayEndpoint(): string {
  return ENDPOINT;
}

/**
 * BLOCKED ENDPOINTS - These should NEVER be called from Portal
 */
export const BLOCKED_ENDPOINTS = [
  'web-chat-malak',
  'chat-malak',
  'crm-webhook',
] as const;

/**
 * Check if an endpoint is blocked
 */
export function isBlockedEndpoint(url: string): boolean {
  return BLOCKED_ENDPOINTS.some(blocked => url.includes(blocked));
}
