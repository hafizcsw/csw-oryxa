export type AckNameForDedupe =
  | 'tab_opened'
  | 'scrolled_to'
  | 'field_highlighted'
  | 'notice_shown'
  | 'modal_opened'
  | 'document_focused'
  | 'cta_focused'
  | 'data_refreshed'
  | 'cards_rendered'
  | 'profile_saved'
  | 'program_selected'
  | 'shortlist_toggled';

export function shouldBlockAckId(name: AckNameForDedupe, ackId: string, persistedSet: Set<string>): boolean {
  if (name !== 'cards_rendered') return false;
  return persistedSet.has(ackId);
}

export function shouldPersistAckId(name: AckNameForDedupe): boolean {
  return name === 'cards_rendered';
}
