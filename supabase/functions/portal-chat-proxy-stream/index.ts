import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ensureAckMeta, getTraceId, unwrapEnvelopeForCRM, withConsistentTraceId } from "../_shared/portal-proxy-envelope.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-trace-id, x-orxya-ingress, x-student-portal-token',
};

const sseHeaders = {
  ...corsHeaders,
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

function getIngressApiKey(): string | undefined {
  // Canonical ingress key name: WEB_TO_CRM_API_KEY
  // Backward compatibility fallback: CRM_API_KEY
  return Deno.env.get('WEB_TO_CRM_API_KEY') || Deno.env.get('CRM_API_KEY') || undefined;
}

type EnvelopeMode = 'unwrap' | 'passthrough';

function getEnvelopeMode(): EnvelopeMode {
  const raw = Deno.env.get('CRM_ENVELOPE_V12_MODE')?.trim().toLowerCase();
  return raw === 'passthrough' ? 'passthrough' : 'unwrap';
}

function buildIngressHeaders(req: Request, apiKey: string, traceId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'x-api-key': apiKey,
    'x-orxya-ingress': 'portal',
    'x-client-trace-id': traceId,
    'x-trace-id': traceId,
  };

  const proxySecret = Deno.env.get('PORTAL_PROXY_SECRET');
  if (proxySecret) headers['x-portal-proxy-secret'] = proxySecret;

  const authHeader = req.headers.get('authorization');
  if (authHeader) headers.Authorization = authHeader;

  const studentPortalToken = req.headers.get('x-student-portal-token');
  if (studentPortalToken) headers['x-student-portal-token'] = studentPortalToken;

  return headers;
}

function errorResponse(status: number, error_key: string): Response {
  return new Response(JSON.stringify({ ok: false, error_key }), {
    status,
    headers: jsonHeaders,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'portal_proxy_stream_method_not_allowed');
  }

  let traceId = req.headers.get('x-client-trace-id')?.trim() || 'trace_missing';

  try {
    const CRM_FUNCTIONS_URL = Deno.env.get('CRM_FUNCTIONS_URL');
    const ingressApiKey = getIngressApiKey();

    if (!CRM_FUNCTIONS_URL || !ingressApiKey) {
      console.warn('[portal-chat-proxy-stream] config_missing', { trace_id: traceId });
      return errorResponse(500, 'portal_proxy_stream_not_configured');
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'portal_proxy_stream_invalid_json_body');
    }

    if (!body || Object.keys(body).length === 0) {
      return errorResponse(400, 'portal_proxy_stream_empty_body');
    }

    traceId = getTraceId(req.headers, body);
    body = ensureAckMeta(body, traceId, { hasAuthorization: Boolean(req.headers.get('authorization')) });
    
    const envelopeMode = getEnvelopeMode();
    const upstreamBody = envelopeMode === 'passthrough'
      ? withConsistentTraceId(body, traceId)
      : unwrapEnvelopeForCRM(body, traceId);
    
    console.log('[portal-chat-proxy-stream] upstream_request', {
      trace_id: traceId,
      envelope_mode: envelopeMode,
      envelope_unwrapped: body !== upstreamBody,
    });

    const upstream = await fetch(`${CRM_FUNCTIONS_URL}/assistant-process-stream`, {
      method: 'POST',
      headers: buildIngressHeaders(req, ingressApiKey, traceId),
      body: JSON.stringify(upstreamBody),
    });

    console.log('[portal-chat-proxy-stream] upstream_response', {
      trace_id: traceId,
      upstream_status: upstream.status,
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(
        JSON.stringify({ ok: false, error_key: 'portal_proxy_stream_upstream_error', upstream_status: upstream.status || 502 }),
        { status: upstream.status || 502, headers: jsonHeaders },
      );
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: sseHeaders,
    });
  } catch {
    console.error('[portal-chat-proxy-stream] internal_error', { trace_id: traceId });
    return errorResponse(500, 'portal_proxy_stream_internal_error');
  }
});
