/**
 * ============================================================
 * FILTER WIRING TESTS - Contract + Fail-Closed Verification
 * ============================================================
 * 
 * Deliverable 3: Mandatory wiring tests for all 26 filter keys.
 * 
 * (A) Contract-Level Tests (Unit)
 * (B) Fail-Closed Proof Tests - NO STRIPPING, only STOP
 */

import { describe, it, expect } from 'vitest';
import {
  HARD16_KEYS,
  HARD16_SET,
  RANK10_KEYS,
  RANK10_SET,
  LOCKED_KEYS,
  LOCKED_SET,
  ALL_ALLOWED_SET,
  PARTIAL_RANK10_SET,
  SUPPORTED_RANK10_SET,
  isHard16Key,
  isRank10Key,
  isLockedKey,
  isAllowedKey,
  isPartialRank10Key,
  validateFilterKeys,
} from '@/lib/chat/contracts/filters';
import {
  HARD16_FILTER_MAP,
  RANK10_FILTER_MAP,
  LOCKED_FILTER_MAP,
  getFilterCoverageReport,
  isFilterSupported,
} from '@/lib/catalog/filterMap';
import {
  validateCardsQueryParams,
  VALIDATOR_EVENTS,
} from '@/lib/chat/sanitizer';

// ============================================================
// (A) CONTRACT-LEVEL TESTS (UNIT)
// ============================================================

describe('Filter Contract: Canonical Keys Definition', () => {
  it('HARD16_KEYS contains exactly 16 keys', () => {
    expect(HARD16_KEYS).toHaveLength(16);
  });

  it('RANK10_KEYS contains exactly 10 keys', () => {
    expect(RANK10_KEYS).toHaveLength(10);
  });

  it('LOCKED_KEYS contains exactly 4 keys', () => {
    expect(LOCKED_KEYS).toHaveLength(4);
  });

  it('ALL_ALLOWED_SET contains exactly 26 keys (16 + 10, NO keyword)', () => {
    // 16 Hard + 10 Rank = 26 ONLY
    // keyword is NOT in filter sets
    expect(ALL_ALLOWED_SET.size).toBe(26);
  });

  it('HARD16 and RANK10 have no overlap', () => {
    const overlap = HARD16_KEYS.filter(k => RANK10_SET.has(k));
    expect(overlap).toEqual([]);
  });

  it('LOCKED keys are not in HARD16 or RANK10', () => {
    for (const key of LOCKED_KEYS) {
      expect(HARD16_SET.has(key)).toBe(false);
      expect(RANK10_SET.has(key)).toBe(false);
    }
  });

  it('keyword is NOT in ANY filter set', () => {
    expect(HARD16_SET.has('keyword')).toBe(false);
    expect(RANK10_SET.has('keyword')).toBe(false);
    expect(ALL_ALLOWED_SET.has('keyword')).toBe(false);
  });
});

describe('Filter Contract: Rank10 Support Status', () => {
  it('SUPPORTED_RANK10_SET contains exactly 4 keys', () => {
    expect(SUPPORTED_RANK10_SET.size).toBe(4);
  });

  it('PARTIAL_RANK10_SET contains exactly 6 keys', () => {
    expect(PARTIAL_RANK10_SET.size).toBe(6);
  });

  it('SUPPORTED + PARTIAL = all 10 Rank10 keys', () => {
    const combined = new Set([...SUPPORTED_RANK10_SET, ...PARTIAL_RANK10_SET]);
    expect(combined.size).toBe(10);
    for (const key of RANK10_KEYS) {
      expect(combined.has(key)).toBe(true);
    }
  });

  it('PARTIAL Rank10 keys match expected list', () => {
    const expected = [
      'national_rank_max',
      'overall_score_min',
      'teaching_score_min',
      'employability_score_min',
      'academic_reputation_score_min',
      'research_score_min',
    ];
    for (const key of expected) {
      expect(PARTIAL_RANK10_SET.has(key)).toBe(true);
    }
  });
});

describe('Filter Contract: Type Guards', () => {
  it('isHard16Key returns true for valid Hard16 keys', () => {
    expect(isHard16Key('country_code')).toBe(true);
    expect(isHard16Key('tuition_usd_max')).toBe(true);
    expect(isHard16Key('intake_months')).toBe(true);
  });

  it('isHard16Key returns false for non-Hard16 keys', () => {
    expect(isHard16Key('world_rank_max')).toBe(false);
    expect(isHard16Key('is_active')).toBe(false);
    expect(isHard16Key('unknown_key')).toBe(false);
    expect(isHard16Key('keyword')).toBe(false);
  });

  it('isRank10Key returns true for valid Rank10 keys', () => {
    expect(isRank10Key('world_rank_max')).toBe(true);
    expect(isRank10Key('institution_id')).toBe(true);
    expect(isRank10Key('ranking_system')).toBe(true);
  });

  it('isRank10Key returns false for non-Rank10 keys', () => {
    expect(isRank10Key('country_code')).toBe(false);
    expect(isRank10Key('is_active')).toBe(false);
  });

  it('isLockedKey returns true for locked keys', () => {
    expect(isLockedKey('is_active')).toBe(true);
    expect(isLockedKey('tuition_basis')).toBe(true);
    expect(isLockedKey('do_not_offer')).toBe(true);
    expect(isLockedKey('partner_priority')).toBe(true);
  });

  it('isLockedKey returns false for non-locked keys', () => {
    expect(isLockedKey('country_code')).toBe(false);
    expect(isLockedKey('world_rank_max')).toBe(false);
  });

  it('isPartialRank10Key identifies NOT_SUPPORTED Rank10 keys', () => {
    expect(isPartialRank10Key('national_rank_max')).toBe(true);
    expect(isPartialRank10Key('overall_score_min')).toBe(true);
    expect(isPartialRank10Key('world_rank_max')).toBe(false);
    expect(isPartialRank10Key('institution_id')).toBe(false);
  });
});

describe('Filter Contract: Validation (Fail-Closed)', () => {
  it('validateFilterKeys passes for valid Hard16 params', () => {
    const params = {
      country_code: 'RU',
      degree_slug: 'bachelor',
      tuition_usd_max: 10000,
    };
    const result = validateFilterKeys(params);
    expect(result.valid).toBe(true);
    expect(result.lockedKeys).toEqual([]);
    expect(result.unknownKeys).toEqual([]);
    expect(result.partialKeys).toEqual([]);
  });

  it('validateFilterKeys STOPS on locked keys', () => {
    const params = {
      country_code: 'RU',
      is_active: true,
      tuition_basis: 'year',
    };
    const result = validateFilterKeys(params);
    expect(result.valid).toBe(false);
    expect(result.lockedKeys).toContain('is_active');
    expect(result.lockedKeys).toContain('tuition_basis');
  });

  it('validateFilterKeys STOPS on unknown keys (no stripping)', () => {
    const params = {
      country_code: 'RU',
      fake_filter: 'value',
      another_fake: 123,
    };
    const result = validateFilterKeys(params);
    expect(result.valid).toBe(false);
    expect(result.unknownKeys).toContain('fake_filter');
    expect(result.unknownKeys).toContain('another_fake');
  });

  it('validateFilterKeys STOPS on keyword in params (not a filter)', () => {
    const params = {
      country_code: 'RU',
      keyword: 'medicine',
    };
    const result = validateFilterKeys(params);
    // keyword is NOT in Hard16, so it's unknown = STOP
    expect(result.valid).toBe(false);
    expect(result.unknownKeys).toContain('keyword');
  });

  it('validateFilterKeys STOPS on PARTIAL Rank10 keys', () => {
    const params = { country_code: 'RU' };
    const rankFilters = {
      ranking_system: 'qs',
      ranking_year: 2025,
      national_rank_max: 100, // PARTIAL = STOP
    };
    const result = validateFilterKeys(params, rankFilters);
    expect(result.valid).toBe(false);
    expect(result.partialKeys).toContain('national_rank_max');
  });

  it('validateFilterKeys passes for SUPPORTED Rank10 keys', () => {
    const params = { country_code: 'RU' };
    const rankFilters = {
      ranking_system: 'qs',
      ranking_year: 2025,
      world_rank_max: 500,
      institution_id: 'uuid-123',
    };
    const result = validateFilterKeys(params, rankFilters);
    expect(result.valid).toBe(true);
    expect(result.partialKeys).toEqual([]);
  });
});

// ============================================================
// (B) FAIL-CLOSED PROOF TESTS
// ============================================================

describe('Fail-Closed: Validator Behavior (NO STRIPPING)', () => {
  it('validateCardsQueryParams STOPS on locked keys', () => {
    const params = {
      country_code: 'RU',
      is_active: true,
      tuition_basis: 'year',
    };
    const result = validateCardsQueryParams(params);
    
    // FAIL-CLOSED: canProceed = false
    expect(result.canProceed).toBe(false);
    expect(result.validatedParams).toBeNull();
    expect(result.violations).not.toBeNull();
    expect(result.violations?.lockedKeys).toContain('is_active');
    expect(result.violations?.lockedKeys).toContain('tuition_basis');
    expect(result.telemetryEvent).toBe(VALIDATOR_EVENTS.CONTRACT_VIOLATION);
  });

  it('validateCardsQueryParams STOPS on unknown keys (no stripping)', () => {
    const params = {
      country_code: 'RU',
      fake_filter: 'value',
    };
    const result = validateCardsQueryParams(params);
    
    expect(result.canProceed).toBe(false);
    expect(result.validatedParams).toBeNull();
    expect(result.violations?.unknownKeys).toContain('fake_filter');
  });

  it('validateCardsQueryParams STOPS on PARTIAL Rank10 keys', () => {
    const params = { country_code: 'RU' };
    const rankFilters = { national_rank_max: 50 };
    
    const result = validateCardsQueryParams(params, rankFilters);
    
    expect(result.canProceed).toBe(false);
    expect(result.violations?.partialKeys).toContain('national_rank_max');
  });

  it('validateCardsQueryParams passes for valid params', () => {
    const params = {
      country_code: 'RU',
      degree_slug: 'bachelor',
      tuition_usd_max: 10000,
    };
    const result = validateCardsQueryParams(params);
    
    expect(result.canProceed).toBe(true);
    expect(result.validatedParams).toEqual(params);
    expect(result.violations).toBeNull();
    expect(result.telemetryEvent).toBeNull();
  });

  it('validateCardsQueryParams handles empty params', () => {
    expect(validateCardsQueryParams({}).canProceed).toBe(true);
    expect(validateCardsQueryParams(null as any).canProceed).toBe(true);
    expect(validateCardsQueryParams(undefined as any).canProceed).toBe(true);
  });

  it('validateCardsQueryParams removes null/undefined values only', () => {
    const params = {
      country_code: 'RU',
      city: null,
      degree_slug: undefined,
    };
    const result = validateCardsQueryParams(params);
    
    expect(result.canProceed).toBe(true);
    expect(result.validatedParams).toEqual({ country_code: 'RU' });
  });
});

// ============================================================
// FILTER MAP VALIDATION TESTS
// ============================================================

describe('Filter Map: Coverage', () => {
  it('every Hard16 key has a SUPPORTED mapping', () => {
    for (const key of HARD16_KEYS) {
      expect(HARD16_FILTER_MAP).toHaveProperty(key);
      expect(HARD16_FILTER_MAP[key].status).toBe('SUPPORTED');
    }
  });

  it('every Rank10 key has a mapping', () => {
    for (const key of RANK10_KEYS) {
      expect(RANK10_FILTER_MAP).toHaveProperty(key);
    }
  });

  it('PARTIAL Rank10 keys have NOT_SUPPORTED status', () => {
    const partial = [
      'national_rank_max',
      'overall_score_min',
      'teaching_score_min',
      'employability_score_min',
      'academic_reputation_score_min',
      'research_score_min',
    ];
    for (const key of partial) {
      expect(RANK10_FILTER_MAP[key as keyof typeof RANK10_FILTER_MAP].status).toBe('NOT_SUPPORTED');
    }
  });

  it('SUPPORTED Rank10 keys have SUPPORTED status', () => {
    const supported = ['ranking_system', 'ranking_year', 'world_rank_max', 'institution_id'];
    for (const key of supported) {
      expect(RANK10_FILTER_MAP[key as keyof typeof RANK10_FILTER_MAP].status).toBe('SUPPORTED');
    }
  });

  it('every Locked key has a mapping', () => {
    for (const key of LOCKED_KEYS) {
      expect(LOCKED_FILTER_MAP).toHaveProperty(key);
      expect(LOCKED_FILTER_MAP[key].reason).toBeDefined();
    }
  });

  it('getFilterCoverageReport returns 30 entries (16+10+4)', () => {
    const report = getFilterCoverageReport();
    expect(report).toHaveLength(30);
  });
});

describe('Filter Map: Tuition Mapping (CORRECTED)', () => {
  it('tuition_usd_min maps to tuition_usd_year_max (program max >= user min)', () => {
    const mapping = HARD16_FILTER_MAP.tuition_usd_min;
    expect(mapping.fieldPath).toBe('tuition_usd_year_max');
    expect(mapping.operator).toBe('range_gte');
    expect(mapping.notes).toContain('CORRECTED');
  });

  it('tuition_usd_max maps to tuition_usd_year_min (program min <= user max)', () => {
    const mapping = HARD16_FILTER_MAP.tuition_usd_max;
    expect(mapping.fieldPath).toBe('tuition_usd_year_min');
    expect(mapping.operator).toBe('range_lte');
    expect(mapping.notes).toContain('CORRECTED');
  });
});

// ============================================================
// SEMANTIC TESTS (Operator Logic)
// ============================================================

describe('Filter Semantics: Operator Types', () => {
  it('instruction_languages uses any_of (array overlap)', () => {
    expect(HARD16_FILTER_MAP.instruction_languages.operator).toBe('any_of');
  });

  it('intake_months uses array_overlap', () => {
    expect(HARD16_FILTER_MAP.intake_months.operator).toBe('array_overlap');
  });

  it('deadline_before uses date_lte', () => {
    expect(HARD16_FILTER_MAP.deadline_before.operator).toBe('date_lte');
  });

  it('boolean filters use boolean operator', () => {
    expect(HARD16_FILTER_MAP.has_dorm.operator).toBe('boolean');
    expect(HARD16_FILTER_MAP.scholarship_available.operator).toBe('boolean');
  });
});

// ============================================================
// TELEMETRY EVENT NAMES
// ============================================================

describe('Telemetry Event Names', () => {
  it('VALIDATOR_EVENTS contains required events', () => {
    expect(VALIDATOR_EVENTS.CONTRACT_VIOLATION).toBe('PORTAL_CONTRACT_VIOLATION');
    expect(VALIDATOR_EVENTS.LOCKED_KEY_DETECTED).toBe('PORTAL_LOCKED_KEY_DETECTED');
    expect(VALIDATOR_EVENTS.UNKNOWN_KEY_DETECTED).toBe('PORTAL_UNKNOWN_FILTER_KEY_BLOCKED');
    expect(VALIDATOR_EVENTS.PARTIAL_RANK10_DETECTED).toBe('PORTAL_UNSUPPORTED_RANK10_KEY_BLOCKED');
  });
});
