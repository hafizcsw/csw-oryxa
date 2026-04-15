/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONTRACT GUARD UNIT TESTS - All 26 Keys Wired (2026-02-05)
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Tests verify Fail-Closed behavior:
 * - HARD16 keys = PASS (16 keys)
 * - RANK10 keys = PASS (10 keys - ALL WIRED)
 * - LOCKED keys = STOP (4 keys)
 * - UNKNOWN keys = STOP
 * - BLOCKED keyword aliases = STOP
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  validateFilterKeys,
  HARD16_KEYS,
  LOCKED_KEYS,
  RANK10_KEYS,
  WIRED_RANK10_KEYS,
  NOT_WIRED_RANK10_KEYS,
  KEYWORD_SET,
  BLOCKED_KEYWORD_SET,
  RANK_THRESHOLD_KEYS,
  isHard16Key,
  isLockedKey,
  isRank10Key,
  isNotWiredRank10Key,
} from '../filters';

describe('Contract Filter Validation - Fail-Closed', () => {
  
  // ============================================================
  // HARD16 TESTS
  // ============================================================
  
  describe('HARD16 Keys (params)', () => {
    it('should PASS when all params are HARD16 keys', () => {
      const params = {
        country_code: 'TR',
        degree_slug: 'bachelor',
        tuition_usd_max: 10000,
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(true);
      expect(result.lockedKeys).toHaveLength(0);
      expect(result.unknownKeys).toHaveLength(0);
      expect(result.partialKeys).toHaveLength(0);
    });
    
    it('should PASS with empty params', () => {
      const result = validateFilterKeys({}, null);
      
      expect(result.valid).toBe(true);
    });
    
    it('should PASS with null params', () => {
      const result = validateFilterKeys(null, null);
      
      expect(result.valid).toBe(true);
    });
    
    it('should verify all 16 HARD16 keys are recognized', () => {
      expect(HARD16_KEYS).toHaveLength(16);
      
      HARD16_KEYS.forEach(key => {
        expect(isHard16Key(key)).toBe(true);
      });
    });
  });
  
  // ============================================================
  // LOCKED KEYS TESTS - MUST STOP
  // ============================================================
  
  describe('LOCKED Keys (STOP)', () => {
    it('should STOP when params contain LOCKED key: is_active', () => {
      const params = {
        country_code: 'TR',
        is_active: true, // LOCKED ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.lockedKeys).toContain('is_active');
    });
    
    it('should STOP when params contain LOCKED key: partner_priority', () => {
      const params = {
        partner_priority: 'star', // LOCKED ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.lockedKeys).toContain('partner_priority');
    });
    
    it('should STOP when params contain LOCKED key: do_not_offer', () => {
      const params = {
        do_not_offer: false, // LOCKED ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.lockedKeys).toContain('do_not_offer');
    });
    
    it('should STOP when params contain LOCKED key: tuition_basis', () => {
      const params = {
        tuition_basis: 'year', // LOCKED ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.lockedKeys).toContain('tuition_basis');
    });
    
    it('should verify all 4 LOCKED keys', () => {
      expect(LOCKED_KEYS).toHaveLength(4);
      expect(LOCKED_KEYS).toContain('is_active');
      expect(LOCKED_KEYS).toContain('partner_priority');
      expect(LOCKED_KEYS).toContain('do_not_offer');
      expect(LOCKED_KEYS).toContain('tuition_basis');
    });
  });
  
  // ============================================================
  // UNKNOWN KEYS TESTS - MUST STOP
  // ============================================================
  
  describe('UNKNOWN Keys (STOP)', () => {
    it('should STOP when params contain unknown key', () => {
      const params = {
        country_code: 'TR',
        random_filter: 'value', // UNKNOWN ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.unknownKeys).toContain('random_filter');
    });
    
    it('should STOP when params contain old V1 alias (NOT normalized)', () => {
      const params = {
        country: 'Turkey', // OLD ALIAS - should be country_code ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.unknownKeys).toContain('country');
    });
  });
  
  // ============================================================
  // KEYWORD EXCEPTION - NOT a filter, handled separately
  // ============================================================
  
  describe('KEYWORD Exception (keyword ONLY allowed)', () => {
    it('should PASS when params contain keyword (search term)', () => {
      const params = {
        country_code: 'TR',
        keyword: 'computer science', // KEYWORD ALLOWED ✅
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(true);
    });
    
    it('should STOP when params contain blocked alias: keywords', () => {
      const params = {
        keywords: ['engineering', 'medicine'], // BLOCKED ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.unknownKeys.some(k => k.includes('keywords'))).toBe(true);
    });
    
    it('should STOP when params contain blocked alias: q', () => {
      const params = {
        q: 'MBA', // BLOCKED ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.unknownKeys.some(k => k.includes('q'))).toBe(true);
    });
    
    it('should STOP when params contain blocked alias: query', () => {
      const params = {
        query: 'data science', // BLOCKED ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.unknownKeys.some(k => k.includes('query'))).toBe(true);
    });
    
    it('should have only keyword in KEYWORD_SET', () => {
      expect(KEYWORD_SET.has('keyword')).toBe(true);
      expect(KEYWORD_SET.size).toBe(1);
    });
    
    it('should have blocked aliases in BLOCKED_KEYWORD_SET', () => {
      expect(BLOCKED_KEYWORD_SET.has('q')).toBe(true);
      expect(BLOCKED_KEYWORD_SET.has('query')).toBe(true);
      expect(BLOCKED_KEYWORD_SET.has('keywords')).toBe(true);
    });
  });
  
  // ============================================================
  // RANK10 FILTERS - institution_id ONLY (Coverage FAIL)
  // ============================================================
  
  describe('Rank Filters (ALL 10 WIRED - 2026-02-05)', () => {
    
    it('should have ALL 10 RANK10 keys WIRED', () => {
      expect(WIRED_RANK10_KEYS).toHaveLength(10);
      expect(RANK10_KEYS).toHaveLength(10);
    });
    
    it('should have 0 NOT_WIRED keys', () => {
      expect(NOT_WIRED_RANK10_KEYS).toHaveLength(0);
    });
    
    it('should PASS when rank_filters contains institution_id alone', () => {
      const result = validateFilterKeys({}, { institution_id: 'some-uuid' });
      expect(result.valid).toBe(true);
    });
    
    it('should PASS when rank_filters contains ranking_system + ranking_year', () => {
      const result = validateFilterKeys({}, {
        ranking_system: 'qs',
        ranking_year: 2025,
      });
      expect(result.valid).toBe(true);
    });
    
    it('should PASS when rank_filters contains full context + threshold', () => {
      const result = validateFilterKeys({}, {
        ranking_system: 'qs',
        ranking_year: 2025,
        world_rank_max: 500,
        overall_score_min: 70,
      });
      expect(result.valid).toBe(true);
    });
    
    it('should STOP when threshold key WITHOUT ranking context', () => {
      // Ranking Consistency Rule: threshold requires system + year
      const result = validateFilterKeys({}, {
        world_rank_max: 500, // Missing context ❌
      });
      
      expect(result.valid).toBe(false);
      expect(result.partialKeys).toContain('missing_ranking_context');
    });
    
    it('should STOP for each threshold key without context', () => {
      RANK_THRESHOLD_KEYS.forEach(key => {
        const result = validateFilterKeys({}, { [key]: 50 });
        
        expect(result.valid).toBe(false);
        expect(result.partialKeys).toContain('missing_ranking_context');
      });
    });
    
    it('should PASS for each threshold key WITH context', () => {
      RANK_THRESHOLD_KEYS.forEach(key => {
        const result = validateFilterKeys({}, {
          ranking_system: 'qs',
          ranking_year: 2025,
          [key]: 50,
        });
        
        expect(result.valid).toBe(true);
      });
    });
    
    it('should STOP when rank_filters contains unknown key', () => {
      const result = validateFilterKeys({}, {
        random_rank: 100, // UNKNOWN ❌
      });
      
      expect(result.valid).toBe(false);
      expect(result.unknownKeys).toContain('rank:random_rank');
    });
    
    it('should have 7 threshold keys requiring context', () => {
      expect(RANK_THRESHOLD_KEYS).toHaveLength(7);
      expect(RANK_THRESHOLD_KEYS).toContain('world_rank_max');
      expect(RANK_THRESHOLD_KEYS).toContain('national_rank_max');
      expect(RANK_THRESHOLD_KEYS).toContain('overall_score_min');
      expect(RANK_THRESHOLD_KEYS).toContain('teaching_score_min');
      expect(RANK_THRESHOLD_KEYS).toContain('employability_score_min');
      expect(RANK_THRESHOLD_KEYS).toContain('academic_reputation_score_min');
      expect(RANK_THRESHOLD_KEYS).toContain('research_score_min');
    });
  });
  
  // ============================================================
  // COMBINED VIOLATIONS
  // ============================================================
  
  describe('Combined Violations', () => {
    it('should report all violations together', () => {
      const params = {
        country_code: 'TR', // VALID
        is_active: true, // LOCKED ❌
        random_key: 'x', // UNKNOWN ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.lockedKeys).toContain('is_active');
      expect(result.unknownKeys).toContain('random_key');
    });
    
    it('should generate error message for violations', () => {
      const params = {
        is_active: true,
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.errorMessage).toBeDefined();
      expect(result.errorMessage).toContain('locked_keys');
      expect(result.errorMessage).toContain('is_active');
    });
  });
  
  // ============================================================
  // NO STRIP BEHAVIOR - FAIL-CLOSED
  // ============================================================
  
  describe('Fail-Closed (NO Strip)', () => {
    it('should NOT strip invalid keys and continue - must STOP', () => {
      const params = {
        country_code: 'TR',
        invalid_key: 'should_cause_stop',
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.unknownKeys).toContain('invalid_key');
    });
    
    it('should NOT allow partial filtering with some valid keys', () => {
      const params = {
        country_code: 'TR',
        degree_slug: 'bachelor',
        tuition_usd_max: 10000,
        invalid_filter: true, // ONE invalid ❌
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
    });
  });
});
