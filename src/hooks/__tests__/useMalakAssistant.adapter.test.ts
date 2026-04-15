import { describe, expect, it } from 'vitest';
import { adaptLegacyResponse } from '../useMalakAssistant';

describe('adaptLegacyResponse', () => {
  it('does not create bot message when legacy.reply is empty', () => {
    const result = adaptLegacyResponse({
      ok: true,
      reply: '   ',
      universities: [],
      need_phone: false,
      need_name: false,
      stage: 'chat',
    } as any);

    expect(result.messages).toEqual([]);
  });

  it('passes through root clarify fields', () => {
    const result = adaptLegacyResponse({
      ok: true,
      reply: '',
      universities: [],
      need_phone: false,
      need_name: false,
      stage: 'chat',
      phase: 'clarify',
      missing_fields: ['country_code'],
      reply_key: 'search.clarify.country',
    } as any);

    expect(result.phase).toBe('clarify');
    expect(result.missing_fields).toEqual(['country_code']);
    expect(result.reply_key).toBe('search.clarify.country');
  });
});
