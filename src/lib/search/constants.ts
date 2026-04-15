/**
 * ============================================================
 * PORTAL SEARCH CONSTANTS - Re-export from Contracts
 * ============================================================
 * 
 * All filter keys now come from the single source of truth:
 * src/lib/chat/contracts/filters.ts
 */

export { 
  HARD16_SET as CANONICAL_16_KEYS,
  LOCKED_SET as LOCKED_KEYS,
} from '@/lib/chat/contracts';

// TEXT_SEARCH_KEY is defined locally (keyword is NOT in filter sets)
export const TEXT_SEARCH_KEY = 'keyword' as const;

export { SYSTEM_CONSTANTS } from '@/lib/chat/constants';
