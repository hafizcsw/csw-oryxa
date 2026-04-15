/**
 * ════════════════════════════════════════════════════════════════════════════
 * PORTAL SEARCH EXECUTOR (P21)
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Performance-optimized search execution:
 * - AbortController for cancellation
 * - Cache layer for repeated queries
 * - Stale guard integration
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '@/integrations/supabase/client';
import { setActiveQuery, areResultsStale } from '../guards/staleResponseGuard';
import { sendPortalEvent, PORTAL_EVENTS } from '../telemetry';

// ============================================================
// TYPES
// ============================================================

export interface SearchParams {
  queryId: string;
  sequence: number;
  params: Record<string, unknown>;
  rankFilters?: Record<string, unknown>;
  limit?: number;
}

export interface SearchResult {
  programs: unknown[];
  total: number;
  queryId: string;
  sequence: number;
  fromCache: boolean;
}

export interface SearchExecutorState {
  /** Current abort controller */
  abortController: AbortController | null;
  /** Cache of recent queries */
  cache: Map<string, { result: SearchResult; timestamp: number }>;
}

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  /** Cache TTL in milliseconds (5 minutes) */
  CACHE_TTL_MS: 5 * 60 * 1000,
  /** Maximum cache entries */
  MAX_CACHE_ENTRIES: 10,
} as const;

// ============================================================
// STATE
// ============================================================

const state: SearchExecutorState = {
  abortController: null,
  cache: new Map(),
};

// ============================================================
// CACHE HELPERS
// ============================================================

/**
 * Generate cache key from params
 */
function generateCacheKey(params: SearchParams): string {
  const normalized = {
    p: params.params,
    r: params.rankFilters || {},
    l: params.limit || 24,
  };
  return btoa(JSON.stringify(normalized));
}

/**
 * Get from cache if fresh
 */
function getFromCache(key: string): SearchResult | null {
  const entry = state.cache.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CONFIG.CACHE_TTL_MS) {
    state.cache.delete(key);
    return null;
  }
  
  return { ...entry.result, fromCache: true };
}

/**
 * Add to cache
 */
function addToCache(key: string, result: SearchResult): void {
  // Evict oldest if at capacity
  if (state.cache.size >= CONFIG.MAX_CACHE_ENTRIES) {
    const oldest = state.cache.keys().next().value;
    if (oldest) state.cache.delete(oldest);
  }
  
  state.cache.set(key, {
    result: { ...result, fromCache: false },
    timestamp: Date.now(),
  });
}

/**
 * Clear cache
 */
export function clearSearchCache(): void {
  state.cache.clear();
}

// ============================================================
// ABORT HELPERS
// ============================================================

/**
 * Abort current search if any
 */
export function abortCurrentSearch(): boolean {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
    
    sendPortalEvent(PORTAL_EVENTS.SEARCH_ABORTED, {
      timestamp: new Date().toISOString(),
    });
    
    return true;
  }
  return false;
}

/**
 * Create new abort controller
 */
function createAbortController(): AbortController {
  // Abort previous
  abortCurrentSearch();
  
  state.abortController = new AbortController();
  return state.abortController;
}

// ============================================================
// SEARCH EXECUTOR
// ============================================================

export interface ExecuteSearchOptions {
  /** Skip cache check */
  skipCache?: boolean;
  /** Timeout in ms */
  timeout?: number;
}

/**
 * Execute catalog search
 * 
 * @param params - Search parameters from cards_query
 * @param options - Execution options
 * @returns Search result or null if aborted/stale
 */
export async function executeSearch(
  params: SearchParams,
  options: ExecuteSearchOptions = {}
): Promise<SearchResult | null> {
  const { skipCache = false, timeout = 30000 } = options;
  const cacheKey = generateCacheKey(params);
  
  // 1. Update stale guard
  setActiveQuery(params.queryId, params.sequence);
  
  // 2. Check cache
  if (!skipCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      if (import.meta.env.DEV) {
        console.log('[SearchExecutor] 📦 Cache hit:', params.queryId);
      }
      return cached;
    }
  }
  
  // 3. Create abort controller
  const controller = createAbortController();
  
  // 4. Set timeout
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    if (import.meta.env.DEV) {
      console.log('[SearchExecutor] 🔍 Executing search:', {
        queryId: params.queryId,
        sequence: params.sequence,
        filterCount: Object.keys(params.params).length,
      });
    }
    
    // 5. Build query from params
    // Note: This uses the vw_program_search_api view
    // Filter mapping is handled by the view
    const filterParams = params.params as Record<string, string | number | boolean | undefined>;
    
    // Build filter conditions
    const conditions: Record<string, unknown> = {};
    
    if (filterParams.country_code && typeof filterParams.country_code === 'string') {
      conditions.country_code = filterParams.country_code;
    }
    if (filterParams.degree_slug && typeof filterParams.degree_slug === 'string') {
      conditions.degree_slug = filterParams.degree_slug;
    }
    if (filterParams.discipline_slug && typeof filterParams.discipline_slug === 'string') {
      conditions.discipline_slug = filterParams.discipline_slug;
    }
    if (filterParams.study_mode && typeof filterParams.study_mode === 'string') {
      conditions.study_mode = filterParams.study_mode;
    }
    if (filterParams.has_dorm === true) {
      conditions.has_dorm = true;
    }
    if (filterParams.scholarship_available === true) {
      conditions.scholarship_available = true;
    }
    
    // Execute query with conditions
    const baseQuery = supabase
      .from('vw_program_search_api')
      .select('*', { count: 'exact' });
    
    // Build match object for simple equality filters
    const matchFilters: Record<string, unknown> = {};
    if (conditions.country_code) matchFilters.country_code = conditions.country_code;
    if (conditions.degree_slug) matchFilters.degree_slug = conditions.degree_slug;
    if (conditions.discipline_slug) matchFilters.discipline_slug = conditions.discipline_slug;
    if (conditions.study_mode) matchFilters.study_mode = conditions.study_mode;
    if (conditions.has_dorm !== undefined) matchFilters.has_dorm = conditions.has_dorm;
    if (conditions.scholarship_available !== undefined) matchFilters.scholarship_available = conditions.scholarship_available;
    
    // Apply match filters and limit
    const { data, error, count } = await baseQuery
      .match(matchFilters)
      .limit(params.limit || 24);
    
    clearTimeout(timeoutId);
    
    // 6. Check if aborted
    if (controller.signal.aborted) {
      if (import.meta.env.DEV) {
        console.log('[SearchExecutor] ⚠️ Search aborted:', params.queryId);
      }
      return null;
    }
    
    // 7. Check if stale
    const staleCheck = areResultsStale(params.queryId, params.sequence);
    if (staleCheck.isStale) {
      sendPortalEvent(PORTAL_EVENTS.SEARCH_RESULTS_STALE, {
        timestamp: new Date().toISOString(),
        query_id: params.queryId,
        sequence: params.sequence,
        filter_count: Object.keys(params.params).length,
      });
      return null;
    }
    
    // 8. Handle error
    if (error) {
      console.error('[SearchExecutor] ❌ RPC error:', error);
      throw error;
    }
    
    // 9. Build result
    const programs = Array.isArray(data) ? data : [];
    const result: SearchResult = {
      programs,
      total: programs.length,
      queryId: params.queryId,
      sequence: params.sequence,
      fromCache: false,
    };
    
    // 10. Cache result
    addToCache(cacheKey, result);
    
    sendPortalEvent(PORTAL_EVENTS.SEARCH_EXECUTED, {
      timestamp: new Date().toISOString(),
      query_id: params.queryId,
      sequence: params.sequence,
      filter_count: Object.keys(params.params).length,
      limit: params.limit,
    });
    
    return result;
    
  } catch (e) {
    clearTimeout(timeoutId);
    
    if ((e as Error).name === 'AbortError') {
      return null;
    }
    
    throw e;
  } finally {
    // Clear controller reference
    if (state.abortController === controller) {
      state.abortController = null;
    }
  }
}

// ============================================================
// RESET
// ============================================================

/**
 * Reset executor state (new conversation)
 */
export function resetSearchExecutor(): void {
  abortCurrentSearch();
  clearSearchCache();
}
