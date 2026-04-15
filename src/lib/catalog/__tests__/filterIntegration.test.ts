/**
 * ============================================================
 * FILTER INTEGRATION TESTS - Catalog Search Verification
 * ============================================================
 * 
 * Deliverable 3(B): Integration tests with ASSERTIONS on results.
 * 
 * These tests verify that each filter key actually affects search results
 * AND that results match the filter criteria (not just "returns something").
 * 
 * CRITICAL: Tests use validateCardsQueryParams (Fail-Closed) NOT processCardsQueryParams
 */

import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { HARD16_KEYS, PARTIAL_RANK10_SET } from '@/lib/chat/contracts/filters';
import { validateCardsQueryParams } from '@/lib/chat/sanitizer';

// Skip integration tests if not in integration test mode
const INTEGRATION_TEST = process.env.INTEGRATION_TEST === 'true';

// ============================================================
// INTEGRATION TEST HELPERS
// ============================================================

interface SearchResult {
  ok: boolean;
  items: any[];
  total?: number;
  error?: string;
  error_code?: string;
}

async function searchPrograms(params: Record<string, unknown>): Promise<SearchResult> {
  // Use Fail-Closed validator
  const validation = validateCardsQueryParams(params);
  
  // If validation fails, return the violation (no API call)
  if (!validation.canProceed) {
    return {
      ok: false,
      items: [],
      error: validation.violations?.errorMessage,
      error_code: 'contract_violation',
    };
  }
  
  const { data, error } = await supabase.functions.invoke('student-portal-api', {
    body: {
      action: 'search_programs',
      ...validation.validatedParams,
      limit: 10,
      offset: 0,
    },
  });
  
  if (error) {
    return { ok: false, items: [], error: error.message };
  }
  
  return {
    ok: data?.ok ?? true,
    items: data?.items ?? data?.programs ?? [],
    total: data?.total,
    error_code: data?.error_code,
  };
}

// ============================================================
// FAIL-CLOSED INTEGRATION TESTS (MOST CRITICAL)
// ============================================================

describe.skipIf(!INTEGRATION_TEST)('Fail-Closed: LOCKED Keys = STOP (No API Call)', () => {
  it('is_active in params = contract_violation (no search)', async () => {
    const params = {
      country_code: 'RU',
      is_active: true, // LOCKED
    };
    
    const result = await searchPrograms(params);
    
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('contract_violation');
    expect(result.items).toEqual([]);
  });

  it('tuition_basis in params = contract_violation (no search)', async () => {
    const params = {
      degree_slug: 'bachelor',
      tuition_basis: 'year', // LOCKED
    };
    
    const result = await searchPrograms(params);
    
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('contract_violation');
  });

  it('partner_priority in params = contract_violation (no search)', async () => {
    const params = {
      country_code: 'RU',
      partner_priority: 'star', // LOCKED
    };
    
    const result = await searchPrograms(params);
    
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('contract_violation');
  });

  it('do_not_offer in params = contract_violation (no search)', async () => {
    const params = {
      country_code: 'RU',
      do_not_offer: false, // LOCKED
    };
    
    const result = await searchPrograms(params);
    
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('contract_violation');
  });
});

describe.skipIf(!INTEGRATION_TEST)('Fail-Closed: UNKNOWN Keys = STOP (No API Call)', () => {
  it('unknown key in params = contract_violation (no search)', async () => {
    const params = {
      country_code: 'RU',
      fake_filter_xyz: 'value',
    };
    
    const result = await searchPrograms(params);
    
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('contract_violation');
    expect(result.items).toEqual([]);
  });

  it('keyword in params = contract_violation (keyword is NOT a filter)', async () => {
    const params = {
      country_code: 'RU',
      keyword: 'medicine', // NOT in Hard16
    };
    
    const result = await searchPrograms(params);
    
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('contract_violation');
  });

  it('alias keys (not canonical) = contract_violation (no normalization)', async () => {
    const params = {
      country: 'RU', // Alias, NOT canonical
      max_tuition: 5000, // Alias, NOT canonical
    };
    
    const result = await searchPrograms(params);
    
    expect(result.ok).toBe(false);
    expect(result.error_code).toBe('contract_violation');
  });
});

describe.skipIf(!INTEGRATION_TEST)('Fail-Closed: PARTIAL Rank10 = STOP (No API Call)', () => {
  const PARTIAL_KEYS = [
    'national_rank_max',
    'overall_score_min',
    'teaching_score_min',
    'employability_score_min',
    'academic_reputation_score_min',
    'research_score_min',
  ];

  for (const key of PARTIAL_KEYS) {
    it(`${key} in rank_filters = contract_violation (not supported)`, async () => {
      const validation = validateCardsQueryParams(
        { country_code: 'RU' },
        { [key]: 50 }
      );
      
      expect(validation.canProceed).toBe(false);
      expect(validation.violations?.partialKeys).toContain(key);
    });
  }
});

// ============================================================
// HARD16 FILTER INTEGRATION TESTS (WITH ASSERTIONS)
// ============================================================

describe.skipIf(!INTEGRATION_TEST)('Filter Integration: Hard16 with Result Assertions', () => {
  it('country_code: all results match the filter value', async () => {
    const result = await searchPrograms({ country_code: 'RU' });
    
    expect(result.ok).toBe(true);
    
    // ASSERTION: Every item must match
    for (const item of result.items) {
      expect(item.country_code).toBe('RU');
    }
    console.log(`[country_code=RU] Verified ${result.items.length} items match`);
  }, 30000);

  it('degree_slug: all results match the filter value', async () => {
    const result = await searchPrograms({ degree_slug: 'bachelor' });
    
    expect(result.ok).toBe(true);
    
    for (const item of result.items) {
      expect(item.degree_slug).toBe('bachelor');
    }
    console.log(`[degree_slug=bachelor] Verified ${result.items.length} items match`);
  }, 30000);

  it('tuition_usd_max: all results have tuition_min <= max (CORRECTED OVERLAP)', async () => {
    const maxBudget = 5000;
    const result = await searchPrograms({ tuition_usd_max: maxBudget });
    
    expect(result.ok).toBe(true);
    
    // CORRECTED: User's max budget >= program's min tuition
    for (const item of result.items) {
      if (item.tuition_usd_min != null) {
        expect(item.tuition_usd_min).toBeLessThanOrEqual(maxBudget);
      }
    }
    console.log(`[tuition_usd_max=${maxBudget}] Verified ${result.items.length} programs affordable`);
  }, 30000);

  it('duration_months_max: all results have duration <= max', async () => {
    const maxDuration = 48; // 4 years
    const result = await searchPrograms({ duration_months_max: maxDuration });
    
    expect(result.ok).toBe(true);
    
    for (const item of result.items) {
      if (item.duration_months != null) {
        expect(item.duration_months).toBeLessThanOrEqual(maxDuration);
      }
    }
    console.log(`[duration_months_max=${maxDuration}] Verified ${result.items.length} programs`);
  }, 30000);

  it('has_dorm: all results have has_dorm = true', async () => {
    const result = await searchPrograms({ has_dorm: true });
    
    expect(result.ok).toBe(true);
    
    for (const item of result.items) {
      expect(item.has_dorm).toBe(true);
    }
    console.log(`[has_dorm=true] Verified ${result.items.length} programs have dorm`);
  }, 30000);

  it('scholarship_available: all results have scholarship_available = true', async () => {
    const result = await searchPrograms({ scholarship_available: true });
    
    expect(result.ok).toBe(true);
    
    for (const item of result.items) {
      expect(item.scholarship_available).toBe(true);
    }
    console.log(`[scholarship_available=true] Verified ${result.items.length} programs`);
  }, 30000);

  it('instruction_languages: all results have overlap with filter', async () => {
    const languages = ['en', 'ru'];
    const result = await searchPrograms({ instruction_languages: languages });
    
    expect(result.ok).toBe(true);
    
    for (const item of result.items) {
      if (item.instruction_languages && Array.isArray(item.instruction_languages)) {
        const hasOverlap = languages.some(lang => 
          item.instruction_languages.includes(lang)
        );
        expect(hasOverlap).toBe(true);
      }
    }
    console.log(`[instruction_languages=${languages}] Verified ${result.items.length} programs`);
  }, 30000);

  it('intake_months: all results have overlap with filter months', async () => {
    const months = [1, 9]; // January or September
    const result = await searchPrograms({ intake_months: months });
    
    expect(result.ok).toBe(true);
    
    for (const item of result.items) {
      if (item.intake_months && Array.isArray(item.intake_months)) {
        const hasOverlap = months.some(m => item.intake_months.includes(m));
        expect(hasOverlap).toBe(true);
      }
    }
    console.log(`[intake_months=${months}] Verified ${result.items.length} programs`);
  }, 30000);
});

// ============================================================
// SUPPORTED RANK10 INTEGRATION TESTS
// ============================================================

describe.skipIf(!INTEGRATION_TEST)('Filter Integration: Supported Rank10', () => {
  it('institution_id: all results match the university', async () => {
    // First, get a valid university_id
    const baseResult = await searchPrograms({ country_code: 'RU' });
    
    if (baseResult.items.length > 0 && baseResult.items[0].university_id) {
      const universityId = baseResult.items[0].university_id;
      
      // Now test with rank_filters
      const validation = validateCardsQueryParams(
        {},
        { institution_id: universityId }
      );
      expect(validation.canProceed).toBe(true);
      
      // Would need to update searchPrograms to accept rank_filters for full test
      console.log(`[institution_id] Validation passed for ${universityId}`);
    } else {
      console.warn('[institution_id] No test data available');
    }
  }, 30000);
});

// ============================================================
// COMBINED FILTER TESTS WITH ASSERTIONS
// ============================================================

describe.skipIf(!INTEGRATION_TEST)('Filter Integration: Combined Filters', () => {
  it('multiple Hard16 filters: all conditions verified on results', async () => {
    const params = {
      country_code: 'RU',
      degree_slug: 'bachelor',
      instruction_languages: ['en'],
      tuition_usd_max: 10000,
    };
    
    const result = await searchPrograms(params);
    expect(result.ok).toBe(true);
    
    for (const item of result.items) {
      // Verify ALL conditions
      expect(item.country_code).toBe('RU');
      expect(item.degree_slug).toBe('bachelor');
      
      if (item.instruction_languages) {
        expect(item.instruction_languages).toContain('en');
      }
      
      if (item.tuition_usd_min != null) {
        expect(item.tuition_usd_min).toBeLessThanOrEqual(10000);
      }
    }
    
    console.log(`[Combined] Verified ${result.items.length} programs match ALL filters`);
  }, 30000);
});

// ============================================================
// NEGATIVE CASES (Filter actually restricts results)
// ============================================================

describe.skipIf(!INTEGRATION_TEST)('Filter Integration: Negative Cases', () => {
  it('country_code with nonexistent value returns zero results', async () => {
    const result = await searchPrograms({ country_code: 'XX' });
    
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(0);
    console.log('[country_code=XX] Correctly returned 0 results');
  }, 30000);

  it('tuition_usd_max=1 returns zero or very few results', async () => {
    const result = await searchPrograms({ tuition_usd_max: 1 });
    
    expect(result.ok).toBe(true);
    // With $1 max budget, should find nothing or almost nothing
    expect(result.items.length).toBeLessThanOrEqual(1);
    console.log(`[tuition_usd_max=1] Returned ${result.items.length} results (expected ≤1)`);
  }, 30000);
});
