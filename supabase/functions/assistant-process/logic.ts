export type ResolvedChannel = 'web_portal' | 'web_chat';

export function extractToken(
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

export async function verifyAuthFromToken(
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

export function resolveChannel(serverVerifiedAuth: boolean): ResolvedChannel {
  return serverVerifiedAuth ? 'web_portal' : 'web_chat';
}

export function sanitizeClientBuild(clientBuild: string | undefined | null): string {
  const inboundClientBuild = typeof clientBuild === 'string' ? clientBuild.trim() : '';
  return inboundClientBuild && inboundClientBuild.length <= 80
    ? inboundClientBuild
    : 'portal-v2-fallback';
}

export function buildStamps(channel: ResolvedChannel, clientBuild: string, traceId: string) {
  return {
    entry_fn: 'portal-chat-ui',
    channel,
    client_build: clientBuild,
    trace_id: traceId,
  };
}

export function assertChannelMatchesStamps(channel: ResolvedChannel, stamps: { channel: ResolvedChannel }) {
  if (channel !== stamps.channel) {
    throw new Error('ACK_CHANNEL_MISMATCH: stamps.channel !== root channel');
  }
}

export function buildCrmHeaders(params: {
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

export function buildAckPayload(args: {
  channel: ResolvedChannel;
  externalConversationId: string;
  visitorId: string;
  customerId?: string;
  clientActionId?: string;
  uiContext?: unknown;
  ackName?: string;
  ackRef?: unknown;
  ackSuccess?: boolean;
  ackMetadata?: Record<string, any>;
  ackId?: string;
  clientBuild: string;
  traceId: string;
}) {
  const stamps = buildStamps(args.channel, args.clientBuild, args.traceId);
  const payload = {
    type: 'ack' as const,
    channel: args.channel,
    external_conversation_id: args.externalConversationId,
    visitor_id: args.visitorId,
    customer_id: args.customerId,
    client_action_id: args.clientActionId,
    ui_context: args.uiContext,
    stamps,
    event: {
      name: args.ackName,
      payload: {
        ref: args.ackRef,
        success: args.ackSuccess,
        meta: args.ackMetadata,
      },
    },
    ack_id: args.ackId,
    ack: {
      name: args.ackName,
      ref: args.ackRef,
      success: args.ackSuccess,
      metadata: args.ackMetadata,
    },
  };

  assertChannelMatchesStamps(payload.channel, payload.stamps);
  return payload;
}

export interface AckValidationInput {
  ackName: string;
  ackRef?: { query_id?: string; sequence?: number; event_id?: string };
  ackSuccess?: boolean;
  ackMetadata?: Record<string, unknown>;
}

export interface AckValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateAckForForwarding(input: AckValidationInput): AckValidationResult {
  if (!input.ackName) {
    return { valid: false, reason: 'missing_ack_name' };
  }
  
  // cards_rendered requires query_id and sequence
  if (input.ackName === 'cards_rendered') {
    if (!input.ackRef?.query_id) {
      return { valid: false, reason: 'cards_rendered_missing_query_id' };
    }
    if (typeof input.ackRef?.sequence !== 'number') {
      return { valid: false, reason: 'cards_rendered_missing_sequence' };
    }
  }
  
  return { valid: true };
}
