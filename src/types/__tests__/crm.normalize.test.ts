import { describe, expect, it } from 'vitest';
import { normalizeCRMResponse, resolveClarifyReplyKey } from '../crm';

describe('resolveClarifyReplyKey', () => {
  it('prioritizes reply_key when present', () => {
    const key = resolveClarifyReplyKey({ reply_key: 'search.clarify.country' } as any);
    expect(key).toBe('search.clarify.country');
  });

  it('maps missing_fields country_code to clarify key', () => {
    const key = resolveClarifyReplyKey({ missing_fields: ['country_code'] } as any);
    expect(key).toBe('search.clarify.country');
  });
});

describe('normalizeCRMResponse', () => {
  it('emits clarify key message for intake hold without reply text', () => {
    const normalized = normalizeCRMResponse({
      ok: true,
      messages: [],
      universities: [],
      state: 'idle',
      actions: [],
      phase: 'clarify',
      missing_fields: ['country_code'],
    } as any);

    expect(normalized.messages[0]?.content).toBe('search.clarify.country');
    expect(normalized.replyKey).toBe('search.clarify.country');
  });
});

it('maps object-shaped missing_fields to clarify key', () => {
  const key = resolveClarifyReplyKey({ missing_fields: { country_code: ['required'] } } as any);
  expect(key).toBe('search.clarify.country');
});
