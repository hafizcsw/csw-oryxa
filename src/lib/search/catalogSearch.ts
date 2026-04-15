/**
 * ============================================================
 * PORTAL CATALOG SEARCH - Strict Contract V2 (Fail-Closed)
 * ============================================================
 * 
 * This is the ONLY way to search programs from Portal.
 * 
 * Guarantees:
 * 1. Uses validateCardsQueryParams - Fail-Closed validation
 * 2. LOCKED keys = STOP (no search, no ACK)
 * 3. UNKNOWN keys = STOP (no search, no ACK)
 * 4. PARTIAL Rank10 keys = STOP (no search, no ACK)
 * 5. tuition_basis='year' is API-level constant (not in params)
 * 
 * IMPORTANT:
 * - Search is ONLY triggered after user clicks "ابدأ البحث"
 * - cards_query alone is NOT enough to trigger search
 */

import { supabase } from '@/integrations/supabase/client';
import { validateCardsQueryParams, VALIDATOR_EVENTS } from './sanitizeCardsQueryParams';
import { SYSTEM_CONSTANTS } from './constants';

export interface CatalogSearchParams {
  query_id: string;
  sequence?: number;
  params: Record<string, unknown>;
  rank_filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

export interface CatalogSearchResult {
  ok: boolean;
  items: any[];
  total?: number;
  query_id: string;
  sequence?: number;
  error?: string;
  error_code?: string;
}

/**
 * Search programs using validated cards_query.params
 * 
 * FAIL-CLOSED: If validation fails, returns error immediately (no API call)
 * 
 * @param query - The cards_query from CRM
 * @returns CatalogSearchResult with programs array or error
 */
export async function searchPrograms(query: CatalogSearchParams): Promise<CatalogSearchResult> {
  // ✅ FAIL-CLOSED: Validate params (16 canonical keys only, LOCKED/UNKNOWN = STOP)
  const validation = validateCardsQueryParams(query.params, query.rank_filters);
  
  // If validation fails, STOP immediately (no API call)
  if (!validation.canProceed) {
    console.error('[CatalogSearch] ❌ CONTRACT VIOLATION - STOP', {
      query_id: query.query_id,
      sequence: query.sequence,
      violations: validation.violations,
    });
    
    // Send telemetry event
    console.log('[CatalogSearch] 📊 Telemetry:', validation.telemetryEvent, validation.telemetryPayload);
    
    return {
      ok: false,
      items: [],
      query_id: query.query_id,
      sequence: query.sequence,
      error: validation.violations?.errorMessage,
      error_code: 'contract_violation',
    };
  }
  
  console.log('[CatalogSearch] 🔍 Searching with validated params:', {
    query_id: query.query_id,
    sequence: query.sequence,
    validated_params: validation.validatedParams,
  });
  
  try {
    const { data, error } = await supabase.functions.invoke('student-portal-api', {
      body: {
        action: 'search_programs',
        ...validation.validatedParams,
        // ✅ tuition_basis is API-level constant (NOT in cards_query.params)
        // This is handled by the API, not passed from Portal
        limit: query.limit || 12,
        offset: query.offset || 0,
      },
    });
    
    if (error) {
      console.error('[CatalogSearch] ❌ API Error:', error);
      return {
        ok: false,
        items: [],
        query_id: query.query_id,
        sequence: query.sequence,
        error: error.message,
      };
    }
    
    const items = data?.items || data?.programs || [];
    
    console.log('[CatalogSearch] ✅ Found', items.length, 'programs');
    
    return {
      ok: true,
      items,
      total: data?.total,
      query_id: query.query_id,
      sequence: query.sequence,
    };
  } catch (e) {
    console.error('[CatalogSearch] ❌ Exception:', e);
    return {
      ok: false,
      items: [],
      query_id: query.query_id,
      sequence: query.sequence,
      error: String(e),
    };
  }
}

/**
 * Validate that params don't contain LOCKED keys
 * Use this for debugging/testing
 */
export function validateSearchParams(params: Record<string, unknown>): {
  valid: boolean;
  lockedKeysFound: string[];
} {
  const lockedKeysFound: string[] = [];
  const LOCKED = new Set(['tuition_basis', 'is_active', 'partner_priority', 'do_not_offer']);
  
  for (const key of Object.keys(params)) {
    if (LOCKED.has(key)) {
      lockedKeysFound.push(key);
    }
  }
  
  return {
    valid: lockedKeysFound.length === 0,
    lockedKeysFound,
  };
}
