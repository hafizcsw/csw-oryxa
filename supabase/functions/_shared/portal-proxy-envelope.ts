export interface AckMetaOptions {
  hasAuthorization: boolean;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildAckMeta(
  source: Record<string, unknown>,
  traceId: string,
  opts: AckMetaOptions,
): Record<string, unknown> {
  const sessionType = typeof source.session_type === 'string' && source.session_type.trim().length > 0
    ? source.session_type
    : 'guest';

  const channel = typeof source.channel === 'string' && source.channel.trim().length > 0
    ? source.channel
    : sessionType === 'authenticated'
      ? 'web_portal'
      : 'web_chat';

  const now = new Date().toISOString();

  return {
    rendered_at: now,
    timestamp: now,
    entry_fn: typeof source.entry_fn === 'string' && source.entry_fn.trim().length > 0 ? source.entry_fn : 'portal-chat-ui',
    channel,
    session_type: sessionType,
    client_trace_id: traceId,
    client_action_id: typeof source.client_action_id === 'string' ? source.client_action_id : null,
    portal_build: typeof source.client_build === 'string' ? source.client_build : 'unknown',
    source: 'portal-chat-proxy-fallback',
    auth_present: opts.hasAuthorization,
  };
}

export function getTraceId(headers: Headers, body: Record<string, unknown>): string {
  const fromHeader = headers.get('x-client-trace-id')?.trim();
  if (fromHeader) return fromHeader;

  const fromClientTrace = typeof body.client_trace_id === 'string' ? body.client_trace_id.trim() : '';
  if (fromClientTrace) return fromClientTrace;

  const fromTraceId = typeof body.trace_id === 'string' ? body.trace_id.trim() : '';
  if (fromTraceId) return fromTraceId;

  return `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function withConsistentTraceId(body: Record<string, unknown>, traceId: string): Record<string, unknown> {
  return { ...body, trace_id: traceId };
}

export function ensureAckMeta(
  body: Record<string, unknown>,
  traceId: string,
  opts: AckMetaOptions,
): Record<string, unknown> {
  if (body.type === 'ack') {
    const existing = body.ack_meta;
    if (isObjectRecord(existing)) return body;
    const fallbackMeta = buildAckMeta(body, traceId, opts);
    return {
      ...body,
      ack_meta: fallbackMeta,
      ...(isObjectRecord(body.ack_metadata) ? {} : { ack_metadata: fallbackMeta }),
    };
  }

  const payload = body.payload;
  if (body.envelope_version === '1.2' && isObjectRecord(payload) && payload.type === 'ack') {
    const existing = payload.ack_meta;
    if (isObjectRecord(existing)) return body;
    const fallbackMeta = buildAckMeta(payload, traceId, opts);
    return {
      ...body,
      payload: {
        ...payload,
        ack_meta: fallbackMeta,
        ...(isObjectRecord(payload.ack_metadata) ? {} : { ack_metadata: fallbackMeta }),
      },
    };
  }

  return body;
}


export function unwrapEnvelopeForCRM(body: Record<string, unknown>, traceId: string): Record<string, unknown> {
  if (body.envelope_version !== '1.2' || !isObjectRecord(body.payload)) {
    return withConsistentTraceId(body, traceId);
  }

  const payload = body.payload as Record<string, unknown>;
  const { payload: _discard, ...envelopeMeta } = body;

  // Extract session_type from payload metadata or stamps
  const payloadMeta = isObjectRecord(payload.metadata) ? payload.metadata as Record<string, unknown> : {};
  const payloadStamps = isObjectRecord(payload.stamps) ? payload.stamps as Record<string, unknown> : {};
  const sessionType = payloadMeta.session_type ?? payloadStamps.session_type ?? payload.session_type ?? 'guest';

  return {
    ...payload,
    trace_id: traceId,
    client_request_id: envelopeMeta.client_request_id,
    session_id: envelopeMeta.session_id ?? payload.session_id,
    channel: envelopeMeta.channel ?? payload.channel,
    session_type: sessionType,
    actor: envelopeMeta.actor,
    ui_locale: envelopeMeta.ui_locale,
    output_locale: envelopeMeta.output_locale,
    subject_customer_id: envelopeMeta.subject_customer_id,
    ...(envelopeMeta.expected_state_rev !== undefined ? { expected_state_rev: envelopeMeta.expected_state_rev } : {}),
    ...(envelopeMeta.filters_patch ? { filters_patch: envelopeMeta.filters_patch } : {}),
  };
}
