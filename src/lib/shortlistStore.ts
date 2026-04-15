/**
 * Centralized Shortlist Store (P0 Optimization)
 * 
 * Single source of truth for shortlist updates.
 * Uses events instead of polling for immediate updates.
 * Works across same-tab + cross-tab scenarios.
 */

const GUEST_KEY = "guest_shortlist";
const SNAPSHOT_KEY = "shortlist_snapshot_cache_v1";
const EVENT_NAME = "shortlist:changed";

// BroadcastChannel for cross-tab sync (with fallback for unsupported browsers)
const bc = typeof BroadcastChannel !== "undefined" 
  ? new BroadcastChannel("shortlist_sync") 
  : null;

export interface ShortlistChangeEvent {
  count: number;
  programIds: string[];
  source: 'add' | 'remove' | 'sync' | 'clear' | 'init';
}

/**
 * Get current shortlist from localStorage
 */
export function getGuestShortlist(): string[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Set shortlist and emit events to all listeners
 */
export function setGuestShortlist(
  list: string[], 
  source: ShortlistChangeEvent['source'] = 'sync'
): void {
  const uniqueList = [...new Set(list)];
  localStorage.setItem(GUEST_KEY, JSON.stringify(uniqueList));
  
  const detail: ShortlistChangeEvent = {
    count: uniqueList.length,
    programIds: uniqueList,
    source,
  };
  
  // Emit to same tab via CustomEvent
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
  
  // Emit to other tabs via BroadcastChannel
  bc?.postMessage({ type: EVENT_NAME, ...detail });
}

/**
 * Add a program to shortlist
 */
export function addToGuestShortlist(programId: string): void {
  const current = getGuestShortlist();
  if (!current.includes(programId)) {
    setGuestShortlist([...current, programId], 'add');
  }
}

/**
 * Remove a program from shortlist
 */
export function removeFromGuestShortlist(programId: string): void {
  const current = getGuestShortlist();
  const filtered = current.filter(id => id !== programId);
  if (filtered.length !== current.length) {
    setGuestShortlist(filtered, 'remove');
  }
}

/**
 * Clear entire shortlist
 */
export function clearGuestShortlist(): void {
  localStorage.removeItem(GUEST_KEY);
  localStorage.removeItem(SNAPSHOT_KEY);
  
  const detail: ShortlistChangeEvent = {
    count: 0,
    programIds: [],
    source: 'clear',
  };
  
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
  bc?.postMessage({ type: EVENT_NAME, ...detail });
}

/**
 * Subscribe to shortlist changes (same tab + cross-tab)
 * Returns unsubscribe function
 */
export function onShortlistChanged(
  callback: (event: ShortlistChangeEvent) => void
): () => void {
  // Handler for same-tab CustomEvent
  const customEventHandler = (e: Event) => {
    const detail = (e as CustomEvent<ShortlistChangeEvent>).detail;
    callback(detail);
  };
  
  // Handler for cross-tab storage event
  const storageHandler = (e: StorageEvent) => {
    if (e.key === GUEST_KEY) {
      const list = getGuestShortlist();
      callback({
        count: list.length,
        programIds: list,
        source: 'sync',
      });
    }
  };
  
  // Handler for cross-tab BroadcastChannel
  const bcHandler = (e: MessageEvent) => {
    if (e.data?.type === EVENT_NAME) {
      callback({
        count: e.data.count,
        programIds: e.data.programIds || [],
        source: e.data.source || 'sync',
      });
    }
  };
  
  // Subscribe to all event sources
  window.addEventListener(EVENT_NAME, customEventHandler);
  window.addEventListener("storage", storageHandler);
  bc?.addEventListener("message", bcHandler);
  
  // Return cleanup function
  return () => {
    window.removeEventListener(EVENT_NAME, customEventHandler);
    window.removeEventListener("storage", storageHandler);
    bc?.removeEventListener("message", bcHandler);
  };
}

/**
 * Get current count (convenience function)
 */
export function getShortlistCount(): number {
  return getGuestShortlist().length;
}

/**
 * Check if program is in shortlist
 */
export function isInShortlist(programId: string): boolean {
  return getGuestShortlist().includes(programId);
}
