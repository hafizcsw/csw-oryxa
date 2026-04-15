export interface AckRef {
  query_id?: string;
  sequence?: number;
}

export interface LastAckedCards {
  query_id: string;
  sequence: number;
}

export function shouldSendCardsAck(ref: AckRef, lastAcked: LastAckedCards | null): boolean {
  if (!ref.query_id || typeof ref.sequence !== 'number') return false;
  if (!lastAcked) return true;
  if (ref.query_id !== lastAcked.query_id) return true;
  return ref.sequence > lastAcked.sequence;
}

export function getAckStorageKey(sessionId?: string): string {
  return `portal_last_acked_cards:${sessionId || 'anonymous'}`;
}

export function readLastAckedCards(sessionId?: string): LastAckedCards | null {
  const raw = localStorage.getItem(getAckStorageKey(sessionId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LastAckedCards;
    if (!parsed?.query_id || typeof parsed?.sequence !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastAckedCards(ref: LastAckedCards, sessionId?: string): void {
  localStorage.setItem(getAckStorageKey(sessionId), JSON.stringify(ref));
}


const ACK_IDS_LIMIT = 100;

function getAckIdsStorageKey(sessionId?: string): string {
  return `portal_acked_ids:${sessionId || 'anonymous'}`;
}

export function readAckedIds(sessionId?: string): Set<string> {
  const raw = localStorage.getItem(getAckIdsStorageKey(sessionId));
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((item) => typeof item === 'string' && item.length > 0));
  } catch {
    return new Set<string>();
  }
}

export function writeAckedId(ackId: string, sessionId?: string): void {
  const ids = Array.from(readAckedIds(sessionId));
  if (!ids.includes(ackId)) {
    ids.push(ackId);
  }
  const trimmed = ids.slice(-ACK_IDS_LIMIT);
  localStorage.setItem(getAckIdsStorageKey(sessionId), JSON.stringify(trimmed));
}
