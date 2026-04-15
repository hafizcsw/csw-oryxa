/** Legacy compatibility shim over the canonical compare store/hooks. */
import { compareStore, MAX_COMPARE } from '@/stores/compareStore';

export const MAX_COMPARE_BASKET = MAX_COMPARE;
export const compareBasketStore = compareStore;
