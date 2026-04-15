import { describe, expect, it } from 'vitest';
import {
  createGatewayStamps,
  resolveGatewayAuthorization,
  resolveGatewayMessage,
  createDeterministicAckId,
} from '../gateway';

describe('gateway payload safety', () => {
  it('derives message from text when message is missing', () => {
    const message = resolveGatewayMessage({ text: 'hi' });
    expect(message).toBe('hi');
    expect(message.length).toBeGreaterThan(0);
  });

  it('derives message from text when message is empty string', () => {
    const message = resolveGatewayMessage({ text: 'hi', message: '' });
    expect(message).toBe('hi');
  });

  it('derives message from text when message is whitespace', () => {
    const message = resolveGatewayMessage({ text: 'hi', message: '   ' });
    expect(message).toBe('hi');
  });

  it('does not attach Authorization for guest sessions', () => {
    const auth = resolveGatewayAuthorization('guest', null, 'anon-key');
    expect(auth).toBeUndefined();
  });

  it('stamps guest session_type correctly', () => {
    expect(createGatewayStamps('guest')).toEqual({ session_type: 'guest' });
  });


  it('builds deterministic ack_id from query/sequence/ack_name', () => {
    const payload = {
      ack_name: 'cards_rendered',
      ack_ref: { query_id: 'cq_123', sequence: 7 },
      ack_success: true,
    };

    const first = createDeterministicAckId(payload, 'session_1');
    const second = createDeterministicAckId(payload, 'session_1');
    expect(first).toBe(second);
    expect(first).toBe('cards_rendered:cq_123:7');
  });

  it('builds different non-cards ack ids when ref fields differ', () => {
    const first = createDeterministicAckId({
      ack_name: 'tab_opened',
      ack_ref: { event_id: 'e1' },
      ack_success: true,
    }, 'session_1');

    const second = createDeterministicAckId({
      ack_name: 'tab_opened',
      ack_ref: { event_id: 'e2' },
      ack_success: true,
    }, 'session_1');

    expect(first).not.toBe(second);
    expect(first).toMatch(/^ack_/);
    expect(second).toMatch(/^ack_/);
  });

  it('builds deterministic non-cards ack ids for identical inputs', () => {
    const payload = {
      ack_name: 'profile_saved' as const,
      ack_ref: { program_id: 'p1', patch_id: 'patch_1' },
      ack_success: true,
    };

    const first = createDeterministicAckId(payload, 'session_1');
    const second = createDeterministicAckId(payload, 'session_1');

    expect(first).toBe(second);
    expect(first).toMatch(/^ack_/);
  });

});
