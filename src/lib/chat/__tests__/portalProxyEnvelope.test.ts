import { describe, expect, it } from 'vitest';
import { ensureAckMeta, getTraceId, unwrapEnvelopeForCRM, withConsistentTraceId } from '../../../../supabase/functions/_shared/portal-proxy-envelope';

describe('portal proxy envelope helpers', () => {
  it('getTraceId prefers header then client_trace_id then trace_id', () => {
    const body = { client_trace_id: 'client-trace', trace_id: 'body-trace' };
    const headerPreferred = getTraceId(new Headers({ 'x-client-trace-id': 'header-trace' }), body);
    expect(headerPreferred).toBe('header-trace');

    const clientPreferred = getTraceId(new Headers(), body);
    expect(clientPreferred).toBe('client-trace');

    const traceFallback = getTraceId(new Headers(), { trace_id: 'body-trace' });
    expect(traceFallback).toBe('body-trace');
  });

  it('ensureAckMeta injects ack_meta for flat ACK payloads', () => {
    const result = ensureAckMeta(
      {
        type: 'ack',
        session_type: 'guest',
        channel: 'web_chat',
      },
      'trace-flat',
      { hasAuthorization: false },
    );

    const ackMeta = result.ack_meta as Record<string, unknown>;
    const ackMetadata = result.ack_metadata as Record<string, unknown>;
    expect(ackMeta.client_trace_id).toBe('trace-flat');
    expect(ackMeta.auth_present).toBe(false);
    expect(typeof ackMeta.rendered_at).toBe('string');
    expect(ackMeta.timestamp).toBe(ackMeta.rendered_at);
    expect(ackMetadata.timestamp).toBe(ackMeta.timestamp);
  });

  it('ensureAckMeta injects ack_meta into envelope payload ACK', () => {
    const result = ensureAckMeta(
      {
        envelope_version: '1.2',
        payload: {
          type: 'ack',
          session_type: 'authenticated',
          channel: 'web_portal',
        },
      },
      'trace-envelope',
      { hasAuthorization: true },
    );

    const payload = result.payload as Record<string, unknown>;
    const ackMeta = payload.ack_meta as Record<string, unknown>;
    const ackMetadata = payload.ack_metadata as Record<string, unknown>;
    expect(ackMeta.client_trace_id).toBe('trace-envelope');
    expect(ackMeta.auth_present).toBe(true);
    expect(ackMeta.channel).toBe('web_portal');
    expect(typeof ackMeta.rendered_at).toBe('string');
    expect(ackMeta.timestamp).toBe(ackMeta.rendered_at);
    expect(ackMetadata.timestamp).toBe(ackMeta.timestamp);
  });

  it('unwrapEnvelopeForCRM preserves payload identity fields and stamps at root', () => {
    const envelope = {
      envelope_version: '1.2',
      session_id: 'session_env',
      channel: 'web_chat',
      payload: {
        type: 'message',
        message: 'hi',
        session_id: 'session_payload',
        channel: 'web_portal',
        session_type: 'guest',
        stamps: { session_type: 'guest' },
      },
    };

    const unwrapped = unwrapEnvelopeForCRM(envelope, 'trace_unwrap');
    expect(unwrapped.trace_id).toBe('trace_unwrap');
    expect(unwrapped.session_id).toBe('session_env');
    expect(unwrapped.channel).toBe('web_chat');
    expect((unwrapped.stamps as Record<string, unknown>).session_type).toBe('guest');
    expect(unwrapped.session_type).toBe('guest');
  });

  it('withConsistentTraceId enforces trace_id in passthrough and unwrap flows', () => {
    const passthrough = withConsistentTraceId({ envelope_version: '1.2', payload: { type: 'message' } }, 'trace_passthrough');
    expect(passthrough.trace_id).toBe('trace_passthrough');

    const unwrapped = unwrapEnvelopeForCRM({ envelope_version: '1.2', payload: { type: 'message', message: 'x' } }, 'trace_unwrap');
    expect(unwrapped.trace_id).toBe('trace_unwrap');
  });

  it('ensureAckMeta keeps existing ack_meta unchanged', () => {
    const existing = {
      timestamp: '2026-01-01T00:00:00.000Z',
      rendered_at: '2026-01-01T00:00:00.000Z',
      entry_fn: 'custom',
    };

    const result = ensureAckMeta({ type: 'ack', ack_meta: existing }, 'trace_ignore', { hasAuthorization: true });
    expect(result.ack_meta).toEqual(existing);
  });

});
