import { describe, expect, it } from 'vitest';
import { shouldBlockAckId, shouldPersistAckId } from '../ackDedupePolicy';

describe('ackDedupePolicy', () => {
  it('blocks persisted ack id only for cards_rendered', () => {
    const persisted = new Set(['cards_rendered:cq_1:2']);

    expect(shouldBlockAckId('cards_rendered', 'cards_rendered:cq_1:2', persisted)).toBe(true);
    expect(shouldBlockAckId('tab_opened', 'tab_opened:cq_1:2', persisted)).toBe(false);
  });

  it('persists only cards_rendered ack ids', () => {
    expect(shouldPersistAckId('cards_rendered')).toBe(true);
    expect(shouldPersistAckId('tab_opened')).toBe(false);
    expect(shouldPersistAckId('profile_saved')).toBe(false);
  });
});
