import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildEnvelopeV12,
  composeFiltersPatch,
  setLastKnownStateRev,
  getStableClientRequestId,
} from '../envelopeV12';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe('envelopeV12', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' });
  });

  it('builds chat envelope with required identity fields', () => {
    const envelope = buildEnvelopeV12({
      envelope_type: 'chat_message',
      payload: { message: 'hello' },
      session_id: 'session-12345678',
      session_type: 'authenticated',
      locale: 'en',
      output_locale: 'en',
      trace_id: 'trace-12345678',
      retry_key: 'chat:1',
      customer_id: 'cust_1',
    });

    expect(envelope.envelope_type).toBe('chat_message');
    expect(envelope.channel).toBe('web_portal');
    expect(envelope.session_id).toBe('session-12345678');
    expect(envelope.client_request_id).toMatch(/^req_/);
  });

  it('creates add/replace/remove RFC6902 ops', () => {
    const ops = composeFiltersPatch(
      { country_code: 'TR', tuition_usd_max: 5000, intake_months: ['jan'] },
      { country_code: 'DE', intake_months: ['jan', 'sep'] },
    );

    expect(ops).toEqual([
      { op: 'replace', path: '/filters/country_code', value: 'DE' },
      { op: 'remove', path: '/filters/tuition_usd_max' },
      { op: 'replace', path: '/filters/intake_months', value: ['jan', 'sep'] },
    ]);
  });


  it('treats empty arrays as remove for clear semantics', () => {
    const ops = composeFiltersPatch(
      { instruction_languages: ['en', 'ar'] },
      { instruction_languages: [] },
    );

    expect(ops).toEqual([
      { op: 'remove', path: '/filters/instruction_languages' },
    ]);
  });



  it('builds render_receipt envelope with ack payload fields', () => {
    const envelope = buildEnvelopeV12({
      envelope_type: 'render_receipt',
      payload: {
        type: 'ack',
        ack_id: 'ack_cq_1_1_cards_rendered',
        ack_name: 'cards_rendered',
        ack_ref: { query_id: 'cq_1', sequence: 1 },
        ack_meta: { count: 3 },
      },
      session_id: 'session-12345678',
      session_type: 'guest',
      locale: 'ar',
      trace_id: 'trace-12345678',
      retry_key: 'ack:1',
    });

    expect(envelope.envelope_type).toBe('render_receipt');
    expect((envelope.payload as Record<string, unknown>).ack_name).toBe('cards_rendered');
    expect(((envelope.payload as Record<string, unknown>).ack_ref as Record<string, unknown>).query_id).toBe('cq_1');
  });

  it('includes expected_state_rev for control patches after first response', () => {
    setLastKnownStateRev('session-12345678', 42);
    getStableClientRequestId('control:1');

    const envelope = buildEnvelopeV12({
      envelope_type: 'control_patch',
      payload: { event: 'filters_changed' },
      session_id: 'session-12345678',
      session_type: 'guest',
      locale: 'ar',
      trace_id: 'trace-87654321',
      retry_key: 'control:1',
      filters: { country_code: 'TR' },
    });

    expect(envelope.filters_patch).toEqual([{ op: 'add', path: '/filters/country_code', value: 'TR' }]);
    expect(envelope.expected_state_rev).toBe(42);
  });
});
