const KEY = "portal_compare_v1";
export const MAX_COMPARE = 10;

let cache: string[] = read();
const emitter = new EventTarget();

function sanitize(ids: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const rawId of ids) {
    const id = String(rawId || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
    if (next.length >= MAX_COMPARE) break;
  }

  return next;
}

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? sanitize(parsed) : [];
  } catch {
    return [];
  }
}

function emitChange() {
  emitter.dispatchEvent(new Event('change'));
  window.dispatchEvent(new Event('compare:change'));
}

function write(next: string[]) {
  cache = sanitize(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('[compareStore] localStorage write failed:', error);
  }
  emitChange();
  console.log('[compareStore] write:', cache.length, 'programs');
}

export const compareStore = {
  subscribe(cb: () => void) {
    const handler = () => cb();
    emitter.addEventListener('change', handler);
    return () => emitter.removeEventListener('change', handler);
  },

  getSnapshot() {
    return cache;
  },

  getServerSnapshot() {
    return [] as string[];
  },

  syncFromStorage() {
    const next = read();
    if (JSON.stringify(next) !== JSON.stringify(cache)) {
      cache = next;
      emitter.dispatchEvent(new Event('change'));
    }
  },

  replace(ids: string[]) {
    write(ids);
  },

  add(id: string): boolean {
    if (cache.includes(id)) return false;
    if (cache.length >= MAX_COMPARE) return false;
    write([...cache, id]);
    return true;
  },

  remove(id: string) {
    const filtered = cache.filter((current) => current !== id);
    if (filtered.length !== cache.length) {
      write(filtered);
    }
  },

  clear() {
    if (cache.length > 0) {
      write([]);
    }
  },

  has(id: string) {
    return cache.includes(id);
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) {
      compareStore.syncFromStorage();
    }
  });
}
