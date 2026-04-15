/** Legacy compatibility shim over the canonical compare store/hooks. */
import { useCompare, MAX_COMPARE } from '@/hooks/useCompare';

export const MAX_COMPARE_BASKET = MAX_COMPARE;

export function useCompareBasket() {
  const {
    compareList,
    count,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    canCompare,
    maxReached,
    replaceCompare,
  } = useCompare();

  return {
    basketList: compareList,
    count,
    toggle: (id: string) => {
      if (isInCompare(id)) {
        removeFromCompare(id);
        return { added: false, removed: true, maxReached: false };
      }
      if (maxReached) {
        return { added: false, removed: false, maxReached: true };
      }
      const added = addToCompare(id);
      return { added, removed: false, maxReached: !added };
    },
    add: addToCompare,
    remove: removeFromCompare,
    clear: clearCompare,
    has: isInCompare,
    getAll: () => compareList,
    replace: replaceCompare,
    canCompare,
    maxReached,
  };
}
