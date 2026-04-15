import { describe, expect, it } from 'vitest';
import { shouldSendCardsAck } from '../ackDedupe';

describe('shouldSendCardsAck', () => {
  it('blocks duplicate query_id/sequence', () => {
    expect(shouldSendCardsAck({ query_id: 'q1', sequence: 2 }, { query_id: 'q1', sequence: 2 })).toBe(false);
  });

  it('blocks stale lower sequence for same query', () => {
    expect(shouldSendCardsAck({ query_id: 'q1', sequence: 1 }, { query_id: 'q1', sequence: 2 })).toBe(false);
  });

  it('allows newer sequence for same query', () => {
    expect(shouldSendCardsAck({ query_id: 'q1', sequence: 3 }, { query_id: 'q1', sequence: 2 })).toBe(true);
  });

  it('allows new query and resets dedupe boundary', () => {
    expect(shouldSendCardsAck({ query_id: 'q2', sequence: 1 }, { query_id: 'q1', sequence: 99 })).toBe(true);
  });
});
