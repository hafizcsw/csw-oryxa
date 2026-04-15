import { useEffect, useSyncExternalStore, useCallback } from 'react';
import { compareStore, MAX_COMPARE } from '@/stores/compareStore';

export { MAX_COMPARE };

export function useCompare() {
  const compareList = useSyncExternalStore(
    compareStore.subscribe,
    compareStore.getSnapshot,
    compareStore.getServerSnapshot
  );

  useEffect(() => {
    const onChange = () => compareStore.syncFromStorage();
    window.addEventListener('compare:change', onChange);
    return () => window.removeEventListener('compare:change', onChange);
  }, []);

  const addToCompare = useCallback((id: string) => compareStore.add(id), []);
  const removeFromCompare = useCallback((id: string) => compareStore.remove(id), []);
  const clearCompare = useCallback(() => compareStore.clear(), []);
  const isInCompare = useCallback((id: string) => compareStore.has(id), []);
  const replaceCompare = useCallback((ids: string[]) => compareStore.replace(ids), []);

  return {
    compareList,
    count: compareList.length,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    replaceCompare,
    canCompare: compareList.length >= 2,
    maxReached: compareList.length >= MAX_COMPARE,
  };
}
