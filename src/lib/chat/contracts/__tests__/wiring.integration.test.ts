/**
 * ════════════════════════════════════════════════════════════════════════════
 * FILTER WIRING INTEGRATION TESTS
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Tests verify END-TO-END filter wiring:
 * - Contract validation (HARD16, RANK10, LOCKED, UNKNOWN)
 * - Positive/Negative cases for each key
 * - Range boundary tests
 * - Fail-Closed behavior
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  validateFilterKeys,
  HARD16_KEYS,
  RANK10_KEYS,
  LOCKED_KEYS,
  RANK_THRESHOLD_KEYS,
} from '../filters';
import {
  HARD16_FILTER_MAP,
  RANK10_FILTER_MAP,
  getFilterMapping,
} from '../filter_map';

describe('Filter Wiring Integration Tests', () => {
  
  // ============================================================
  // CONTRACT VALIDATION TESTS
  // ============================================================
  
  describe('Contract Validation - Fail-Closed', () => {
    
    describe('HARD16 Keys (params)', () => {
      
      it('should PASS with all HARD16 keys individually', () => {
        HARD16_KEYS.forEach(key => {
          const params = { [key]: 'test_value' };
          const result = validateFilterKeys(params, null);
          
          expect(result.valid).toBe(true);
          expect(result.lockedKeys).toHaveLength(0);
          expect(result.unknownKeys).toHaveLength(0);
        });
      });
      
      it('should PASS with all HARD16 keys combined', () => {
        const params: Record<string, unknown> = {};
        HARD16_KEYS.forEach(key => {
          params[key] = 'test';
        });
        
        const result = validateFilterKeys(params, null);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('RANK10 Keys (rank_filters)', () => {
      
      it('should PASS with institution_id alone', () => {
        const result = validateFilterKeys({}, { institution_id: 'uuid-123' });
        expect(result.valid).toBe(true);
      });
      
      it('should PASS with ranking_system + ranking_year', () => {
        const result = validateFilterKeys({}, {
          ranking_system: 'qs',
          ranking_year: 2025,
        });
        expect(result.valid).toBe(true);
      });
      
      it('should PASS with full ranking context (system + year + thresholds)', () => {
        const result = validateFilterKeys({}, {
          ranking_system: 'qs',
          ranking_year: 2025,
          world_rank_max: 500,
          overall_score_min: 70,
        });
        expect(result.valid).toBe(true);
      });
      
      it('should FAIL with threshold key but NO ranking context', () => {
        const result = validateFilterKeys({}, {
          world_rank_max: 500, // Missing ranking_system + ranking_year
        });
        expect(result.valid).toBe(false);
        expect(result.partialKeys).toContain('missing_ranking_context');
      });
      
      it('should FAIL with score_min but NO ranking context', () => {
        const result = validateFilterKeys({}, {
          overall_score_min: 70,
        });
        expect(result.valid).toBe(false);
        expect(result.partialKeys).toContain('missing_ranking_context');
      });
    });
    
    describe('LOCKED Keys (STOP)', () => {
      
      it('should STOP for each LOCKED key', () => {
        LOCKED_KEYS.forEach(key => {
          const result = validateFilterKeys({ [key]: 'test' }, null);
          
          expect(result.valid).toBe(false);
          expect(result.lockedKeys).toContain(key);
        });
      });
      
      it('should STOP even when LOCKED key mixed with valid keys', () => {
        const params = {
          country_code: 'TR',
          degree_slug: 'bachelor',
          is_active: true, // LOCKED
        };
        
        const result = validateFilterKeys(params, null);
        expect(result.valid).toBe(false);
        expect(result.lockedKeys).toContain('is_active');
      });
    });
    
    describe('UNKNOWN Keys (STOP)', () => {
      
      it('should STOP for unknown keys in params', () => {
        const unknownKeys = [
          'random_filter',
          'country', // Old alias
          'degree', // Old alias
          'tuition', // Not canonical
          'language', // Not canonical
        ];
        
        unknownKeys.forEach(key => {
          const result = validateFilterKeys({ [key]: 'test' }, null);
          
          expect(result.valid).toBe(false);
          expect(result.unknownKeys.some(k => k.includes(key) || k === key)).toBe(true);
        });
      });
      
      it('should STOP for unknown keys in rank_filters', () => {
        const result = validateFilterKeys({}, {
          invalid_rank: 100,
        });
        
        expect(result.valid).toBe(false);
        expect(result.unknownKeys).toContain('rank:invalid_rank');
      });
    });
    
    describe('Keyword Exception', () => {
      
      it('should PASS with keyword (allowed)', () => {
        const result = validateFilterKeys({
          country_code: 'TR',
          keyword: 'computer science',
        }, null);
        
        expect(result.valid).toBe(true);
      });
      
      it('should STOP with blocked keyword aliases', () => {
        const blockedAliases = ['q', 'query', 'keywords'];
        
        blockedAliases.forEach(alias => {
          const result = validateFilterKeys({ [alias]: 'test' }, null);
          
          expect(result.valid).toBe(false);
          expect(result.unknownKeys.some(k => k.includes(alias))).toBe(true);
        });
      });
    });
  });
  
  // ============================================================
  // FILTER MAP VERIFICATION
  // ============================================================
  
  describe('Filter Map Verification', () => {
    
    it('all HARD16 keys should have valid mapping', () => {
      HARD16_KEYS.forEach(key => {
        const mapping = getFilterMapping(key);
        
        expect(mapping).not.toBeNull();
        expect(mapping?.wired).toBe(true);
        expect(mapping?.entity).toBe('program');
        expect(mapping?.field_path).toBeDefined();
        expect(mapping?.operator).toBeDefined();
      });
    });
    
    it('all RANK10 keys should have valid mapping', () => {
      RANK10_KEYS.forEach(key => {
        const mapping = getFilterMapping(key);
        
        expect(mapping).not.toBeNull();
        expect(mapping?.wired).toBe(true);
        expect(mapping?.field_path).toBeDefined();
        expect(mapping?.operator).toBeDefined();
      });
    });
    
    it('all LOCKED keys should have mapping but NOT wired', () => {
      LOCKED_KEYS.forEach(key => {
        const mapping = getFilterMapping(key);
        
        expect(mapping).not.toBeNull();
        expect(mapping?.wired).toBe(false);
      });
    });
  });
  
  // ============================================================
  // RANKING CONSISTENCY RULE
  // ============================================================
  
  describe('Ranking Consistency Rule', () => {
    
    it('should identify all threshold keys', () => {
      expect(RANK_THRESHOLD_KEYS).toHaveLength(7);
      expect(RANK_THRESHOLD_KEYS).toContain('world_rank_max');
      expect(RANK_THRESHOLD_KEYS).toContain('national_rank_max');
      expect(RANK_THRESHOLD_KEYS).toContain('overall_score_min');
      expect(RANK_THRESHOLD_KEYS).toContain('teaching_score_min');
      expect(RANK_THRESHOLD_KEYS).toContain('employability_score_min');
      expect(RANK_THRESHOLD_KEYS).toContain('academic_reputation_score_min');
      expect(RANK_THRESHOLD_KEYS).toContain('research_score_min');
    });
    
    it('each threshold key should FAIL without context', () => {
      RANK_THRESHOLD_KEYS.forEach(key => {
        const result = validateFilterKeys({}, { [key]: 50 });
        
        expect(result.valid).toBe(false);
        expect(result.partialKeys).toContain('missing_ranking_context');
      });
    });
    
    it('each threshold key should PASS with context', () => {
      RANK_THRESHOLD_KEYS.forEach(key => {
        const result = validateFilterKeys({}, {
          ranking_system: 'qs',
          ranking_year: 2025,
          [key]: 50,
        });
        
        expect(result.valid).toBe(true);
      });
    });
  });
  
  // ============================================================
  // FAIL-CLOSED PROOF
  // ============================================================
  
  describe('Fail-Closed Proof', () => {
    
    it('PROOF: Unknown key causes STOP (not strip)', () => {
      const params = {
        country_code: 'TR', // Valid
        unknown_filter: 'test', // Unknown
      };
      
      const result = validateFilterKeys(params, null);
      
      // Must STOP, not strip and continue
      expect(result.valid).toBe(false);
      expect(result.unknownKeys).toContain('unknown_filter');
    });
    
    it('PROOF: Locked key causes STOP (not ignored)', () => {
      const params = {
        country_code: 'TR', // Valid
        partner_priority: 'star', // Locked
      };
      
      const result = validateFilterKeys(params, null);
      
      // Must STOP, not ignore and continue
      expect(result.valid).toBe(false);
      expect(result.lockedKeys).toContain('partner_priority');
    });
    
    it('PROOF: Multiple violations are all reported', () => {
      const params = {
        is_active: true, // Locked
        partner_priority: 'star', // Locked
        unknown_key: 'x', // Unknown
      };
      
      const result = validateFilterKeys(params, null);
      
      expect(result.valid).toBe(false);
      expect(result.lockedKeys).toHaveLength(2);
      expect(result.unknownKeys).toHaveLength(1);
    });
    
    it('PROOF: Error message is generated for violations', () => {
      const result = validateFilterKeys({ is_active: true }, null);
      
      expect(result.errorMessage).toBeDefined();
      expect(result.errorMessage).toContain('contract_violation');
      expect(result.errorMessage).toContain('locked_keys');
    });
  });
  
  // ============================================================
  // OPERATOR SEMANTICS VERIFICATION
  // ============================================================
  
  describe('Operator Semantics', () => {
    
    it('exact match keys should have exact operator', () => {
      const exactKeys = [
        'country_code', 'city', 'degree_slug', 'discipline_slug',
        'study_mode', 'scholarship_type',
      ];
      
      exactKeys.forEach(key => {
        const mapping = HARD16_FILTER_MAP[key as keyof typeof HARD16_FILTER_MAP];
        expect(mapping.operator).toBe('exact');
      });
    });
    
    it('array keys should have contains_any operator', () => {
      expect(HARD16_FILTER_MAP.instruction_languages.operator).toBe('contains_any');
      expect(HARD16_FILTER_MAP.intake_months.operator).toBe('contains_any');
    });
    
    it('range max keys should have range_max operator', () => {
      const rangeMaxKeys = [
        'tuition_usd_max', 'duration_months_max',
        'dorm_price_monthly_usd_max', 'monthly_living_usd_max',
      ];
      
      rangeMaxKeys.forEach(key => {
        const mapping = HARD16_FILTER_MAP[key as keyof typeof HARD16_FILTER_MAP];
        expect(mapping.operator).toBe('range_max');
      });
    });
    
    it('range min keys should have range_min operator', () => {
      expect(HARD16_FILTER_MAP.tuition_usd_min.operator).toBe('range_min');
      expect(RANK10_FILTER_MAP.overall_score_min.operator).toBe('range_min');
    });
    
    it('boolean keys should have boolean operator', () => {
      expect(HARD16_FILTER_MAP.has_dorm.operator).toBe('boolean');
      expect(HARD16_FILTER_MAP.scholarship_available.operator).toBe('boolean');
    });
    
    it('date keys should have date_before operator', () => {
      expect(HARD16_FILTER_MAP.deadline_before.operator).toBe('date_before');
    });
  });
});
