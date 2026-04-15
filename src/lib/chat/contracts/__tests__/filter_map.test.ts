/**
 * ════════════════════════════════════════════════════════════════════════════
 * FILTER MAP UNIT TESTS - Wiring Verification
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Tests verify that ALL 26 filter keys have proper mapping:
 * - Entity target (program/university/join)
 * - Field path (database column)
 * - Operator semantics
 * - Wiring status
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest';
import {
  HARD16_FILTER_MAP,
  RANK10_FILTER_MAP,
  LOCKED_FILTER_MAP,
  ALL_FILTER_MAP,
  WIRING_STATUS,
  getFilterMapping,
  isFilterWired,
  filterRequiresJoin,
  getFiltersByEntity,
} from '../filter_map';
import {
  HARD16_KEYS,
  RANK10_KEYS,
  LOCKED_KEYS,
} from '../filters';

describe('Filter Map - Wiring Verification', () => {
  
  // ============================================================
  // HARD16 MAPPING TESTS
  // ============================================================
  
  describe('HARD16 Filter Mapping (16 keys)', () => {
    
    it('should have mapping for ALL 16 HARD16 keys', () => {
      HARD16_KEYS.forEach(key => {
        expect(HARD16_FILTER_MAP[key]).toBeDefined();
        expect(HARD16_FILTER_MAP[key].key).toBe(key);
      });
    });
    
    it('should have all HARD16 keys wired', () => {
      HARD16_KEYS.forEach(key => {
        expect(HARD16_FILTER_MAP[key].wired).toBe(true);
      });
    });
    
    it('should have correct entity targets', () => {
      // All HARD16 target 'program' directly
      HARD16_KEYS.forEach(key => {
        expect(HARD16_FILTER_MAP[key].entity).toBe('program');
      });
    });
    
    it('should have correct operator semantics', () => {
      // Exact match keys
      expect(HARD16_FILTER_MAP.country_code.operator).toBe('exact');
      expect(HARD16_FILTER_MAP.city.operator).toBe('exact');
      expect(HARD16_FILTER_MAP.degree_slug.operator).toBe('exact');
      expect(HARD16_FILTER_MAP.discipline_slug.operator).toBe('exact');
      expect(HARD16_FILTER_MAP.study_mode.operator).toBe('exact');
      expect(HARD16_FILTER_MAP.scholarship_type.operator).toBe('exact');
      
      // Contains-any keys (arrays)
      expect(HARD16_FILTER_MAP.instruction_languages.operator).toBe('contains_any');
      expect(HARD16_FILTER_MAP.intake_months.operator).toBe('contains_any');
      
      // Range min keys
      expect(HARD16_FILTER_MAP.tuition_usd_min.operator).toBe('range_min');
      
      // Range max keys
      expect(HARD16_FILTER_MAP.tuition_usd_max.operator).toBe('range_max');
      expect(HARD16_FILTER_MAP.duration_months_max.operator).toBe('range_max');
      expect(HARD16_FILTER_MAP.dorm_price_monthly_usd_max.operator).toBe('range_max');
      expect(HARD16_FILTER_MAP.monthly_living_usd_max.operator).toBe('range_max');
      
      // Boolean keys
      expect(HARD16_FILTER_MAP.has_dorm.operator).toBe('boolean');
      expect(HARD16_FILTER_MAP.scholarship_available.operator).toBe('boolean');
      
      // Date keys
      expect(HARD16_FILTER_MAP.deadline_before.operator).toBe('date_before');
    });
    
    it('should NOT require JOIN for HARD16 keys', () => {
      HARD16_KEYS.forEach(key => {
        expect(HARD16_FILTER_MAP[key].requires_join).toBe(false);
      });
    });
  });
  
  // ============================================================
  // RANK10 MAPPING TESTS
  // ============================================================
  
  describe('RANK10 Filter Mapping (10 keys)', () => {
    
    it('should have mapping for ALL 10 RANK10 keys', () => {
      RANK10_KEYS.forEach(key => {
        expect(RANK10_FILTER_MAP[key]).toBeDefined();
        expect(RANK10_FILTER_MAP[key].key).toBe(key);
      });
    });
    
    it('should have all RANK10 keys wired', () => {
      RANK10_KEYS.forEach(key => {
        expect(RANK10_FILTER_MAP[key].wired).toBe(true);
      });
    });
    
    it('should have correct entity targets', () => {
      // institution_id targets program via university
      expect(RANK10_FILTER_MAP.institution_id.entity).toBe('program_via_university');
      
      // All other RANK10 target university
      const universityKeys = [
        'ranking_system', 'ranking_year', 'world_rank_max', 'national_rank_max',
        'overall_score_min', 'teaching_score_min', 'employability_score_min',
        'academic_reputation_score_min', 'research_score_min',
      ];
      universityKeys.forEach(key => {
        expect(RANK10_FILTER_MAP[key as keyof typeof RANK10_FILTER_MAP].entity).toBe('university');
      });
    });
    
    it('should have correct operator semantics', () => {
      // Exact match
      expect(RANK10_FILTER_MAP.institution_id.operator).toBe('exact');
      expect(RANK10_FILTER_MAP.ranking_system.operator).toBe('exact');
      expect(RANK10_FILTER_MAP.ranking_year.operator).toBe('exact');
      
      // Range max (lower rank = better)
      expect(RANK10_FILTER_MAP.world_rank_max.operator).toBe('range_max');
      expect(RANK10_FILTER_MAP.national_rank_max.operator).toBe('range_max');
      
      // Range min (higher score = better)
      expect(RANK10_FILTER_MAP.overall_score_min.operator).toBe('range_min');
      expect(RANK10_FILTER_MAP.teaching_score_min.operator).toBe('range_min');
      expect(RANK10_FILTER_MAP.employability_score_min.operator).toBe('range_min');
      expect(RANK10_FILTER_MAP.academic_reputation_score_min.operator).toBe('range_min');
      expect(RANK10_FILTER_MAP.research_score_min.operator).toBe('range_min');
    });
    
    it('should require JOIN for ranking keys (except institution_id)', () => {
      expect(RANK10_FILTER_MAP.institution_id.requires_join).toBe(false);
      
      const joinRequiredKeys = [
        'ranking_system', 'ranking_year', 'world_rank_max', 'national_rank_max',
        'overall_score_min', 'teaching_score_min', 'employability_score_min',
        'academic_reputation_score_min', 'research_score_min',
      ];
      joinRequiredKeys.forEach(key => {
        expect(RANK10_FILTER_MAP[key as keyof typeof RANK10_FILTER_MAP].requires_join).toBe(true);
      });
    });
  });
  
  // ============================================================
  // LOCKED MAPPING TESTS
  // ============================================================
  
  describe('LOCKED Filter Mapping (4 keys)', () => {
    
    it('should have mapping for ALL 4 LOCKED keys', () => {
      LOCKED_KEYS.forEach(key => {
        expect(LOCKED_FILTER_MAP[key]).toBeDefined();
        expect(LOCKED_FILTER_MAP[key].key).toBe(key);
      });
    });
    
    it('should have all LOCKED keys NOT wired (server-only)', () => {
      LOCKED_KEYS.forEach(key => {
        expect(LOCKED_FILTER_MAP[key].wired).toBe(false);
      });
    });
  });
  
  // ============================================================
  // COMBINED MAP TESTS
  // ============================================================
  
  describe('Combined Filter Map (26 allowed)', () => {
    
    it('should have exactly 26 keys in ALL_FILTER_MAP', () => {
      expect(Object.keys(ALL_FILTER_MAP)).toHaveLength(26);
    });
    
    it('should NOT include LOCKED keys in ALL_FILTER_MAP', () => {
      LOCKED_KEYS.forEach(key => {
        expect(ALL_FILTER_MAP[key]).toBeUndefined();
      });
    });
    
    it('should include all HARD16 and RANK10 keys', () => {
      HARD16_KEYS.forEach(key => {
        expect(ALL_FILTER_MAP[key]).toBeDefined();
      });
      RANK10_KEYS.forEach(key => {
        expect(ALL_FILTER_MAP[key]).toBeDefined();
      });
    });
  });
  
  // ============================================================
  // HELPER FUNCTION TESTS
  // ============================================================
  
  describe('Helper Functions', () => {
    
    it('getFilterMapping should return mapping for valid keys', () => {
      expect(getFilterMapping('country_code')).toBeDefined();
      expect(getFilterMapping('country_code')?.key).toBe('country_code');
      
      expect(getFilterMapping('institution_id')).toBeDefined();
      expect(getFilterMapping('institution_id')?.key).toBe('institution_id');
      
      // Should also return LOCKED keys
      expect(getFilterMapping('is_active')).toBeDefined();
    });
    
    it('getFilterMapping should return null for unknown keys', () => {
      expect(getFilterMapping('random_key')).toBeNull();
      expect(getFilterMapping('invalid')).toBeNull();
    });
    
    it('isFilterWired should correctly identify wired filters', () => {
      // HARD16 = wired
      expect(isFilterWired('country_code')).toBe(true);
      expect(isFilterWired('tuition_usd_max')).toBe(true);
      
      // RANK10 = wired
      expect(isFilterWired('institution_id')).toBe(true);
      expect(isFilterWired('world_rank_max')).toBe(true);
      
      // LOCKED = not in ALL_FILTER_MAP, so false
      expect(isFilterWired('is_active')).toBe(false);
      
      // Unknown = false
      expect(isFilterWired('random')).toBe(false);
    });
    
    it('filterRequiresJoin should correctly identify join requirements', () => {
      // HARD16 = no join
      expect(filterRequiresJoin('country_code')).toBe(false);
      expect(filterRequiresJoin('tuition_usd_max')).toBe(false);
      
      // institution_id = no join (already in view)
      expect(filterRequiresJoin('institution_id')).toBe(false);
      
      // Other RANK10 = join required
      expect(filterRequiresJoin('ranking_system')).toBe(true);
      expect(filterRequiresJoin('world_rank_max')).toBe(true);
    });
    
    it('getFiltersByEntity should return correct filters', () => {
      const programFilters = getFiltersByEntity('program');
      expect(programFilters.length).toBe(16); // All HARD16
      
      const universityFilters = getFiltersByEntity('university');
      expect(universityFilters.length).toBe(9); // RANK10 except institution_id
      
      const joinFilters = getFiltersByEntity('program_via_university');
      expect(joinFilters.length).toBe(1); // institution_id only
    });
  });
  
  // ============================================================
  // WIRING STATUS TESTS
  // ============================================================
  
  describe('Wiring Status Summary', () => {
    
    it('should report correct HARD16 wiring status', () => {
      expect(WIRING_STATUS.HARD16.total).toBe(16);
      expect(WIRING_STATUS.HARD16.wired).toBe(16);
    });
    
    it('should report correct RANK10 wiring status', () => {
      expect(WIRING_STATUS.RANK10.total).toBe(10);
      expect(WIRING_STATUS.RANK10.wired).toBe(10);
    });
    
    it('should report correct LOCKED status (never wired)', () => {
      expect(WIRING_STATUS.LOCKED.total).toBe(4);
      expect(WIRING_STATUS.LOCKED.wired).toBe(0);
    });
    
    it('should report FULL coverage (26/26)', () => {
      const summary = WIRING_STATUS.summary;
      expect(summary.total_allowed_keys).toBe(26);
      expect(summary.total_wired).toBe(26);
      expect(summary.coverage_percent).toBe(100);
      expect(summary.status).toBe('FULL');
    });
  });
});
