import { assertEquals, assertRejects, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertChannelMatchesStamps,
  buildAckPayload,
  buildCrmHeaders,
  buildStamps,
  extractToken,
  resolveChannel,
  sanitizeClientBuild,
  verifyAuthFromToken,
} from "./logic.ts";

Deno.test('resolvedChannel: no token => web_chat', async () => {
  const token = extractToken(undefined, null);
  const auth = await verifyAuthFromToken(async () => ({ data: {} }), token);
  assertEquals(auth.isAuthenticated, false);
  assertEquals(resolveChannel(auth.isAuthenticated), 'web_chat');
});

Deno.test('resolvedChannel: valid token (mock getUser success) => web_portal', async () => {
  const token = extractToken(undefined, 'Bearer valid_token_123456789');
  const auth = await verifyAuthFromToken(async () => ({
    data: { user: { id: 'user-1' } },
    error: null,
  }), token);
  assertEquals(auth.isAuthenticated, true);
  assertEquals(resolveChannel(auth.isAuthenticated), 'web_portal');
});

Deno.test('spoofed channel/session_type are ignored; channel is derived from getUser only', async () => {
  const spoofedBody = { channel: 'web_portal', session_type: 'authenticated' };
  const auth = await verifyAuthFromToken(async () => ({ data: {}, error: { message: 'invalid' } }), 'bad_token_123456789');
  const resolved = resolveChannel(auth.isAuthenticated);
  assertEquals(spoofedBody.channel, 'web_portal');
  assertEquals(spoofedBody.session_type, 'authenticated');
  assertEquals(resolved, 'web_chat');
});

Deno.test('ACK builder uses resolvedChannel in root + stamps and rejects mismatch', async () => {
  const payload = buildAckPayload({
    channel: 'web_portal',
    externalConversationId: 'conv-1',
    visitorId: 'visitor-1',
    clientBuild: sanitizeClientBuild('portal-ui-v42'),
    traceId: 'trace-1',
    ackName: 'cards_seen',
  });

  assertEquals(payload.channel, 'web_portal');
  assertEquals(payload.stamps.channel, 'web_portal');

  await assertRejects(
    async () => {
      assertChannelMatchesStamps('web_portal', { channel: 'web_chat' });
    },
    Error,
    'ACK_CHANNEL_MISMATCH',
  );
});

Deno.test('outbound payload carries stamps.entry_fn + stamps.channel and server-only CRM headers', () => {
  const stamps = buildStamps('web_chat', sanitizeClientBuild(''), 'trace-2');
  assertEquals(stamps.entry_fn, 'portal-chat-ui');
  assertEquals(stamps.channel, 'web_chat');

  const headers = buildCrmHeaders({
    apiKey: 'crm-key',
    traceId: 'trace-2',
    proxySecret: 'proxy-secret',
  });

  assertEquals(headers['x-api-key'], 'crm-key');
  assertEquals(headers['x-portal-proxy-secret'], 'proxy-secret');
  assertEquals(headers['x-orxya-ingress'], 'portal');
  assertEquals(headers['x-client-trace-id'], 'trace-2');
  assertStringIncludes(headers['Content-Type'], 'application/json');
});
