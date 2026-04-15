/**
 * ============================================================
 * PORTAL FILTER MAP - Entity Target & Field Path Mapping
 * ============================================================
 * 
 * Deliverable 2: Explicit mapping for each filter key.
 * 
 * Each filter specifies:
 * - entityTarget: 'program' | 'university' | 'program_join_university'
 * - fieldPath: The actual column in vw_program_search_api_v3_final
 * - operator: Semantic operator type
 * - requiresJoin: Whether ranking join is needed
 * - status: 'SUPPORTED' | 'NOT_SUPPORTED' (NOT_SUPPORTED = STOP if sent)
 * 
 * TUITION MAPPING FIX:
 * - tuition_usd_min (user's minimum budget) → program_max (user can afford at least this)
 * - tuition_usd_max (user's maximum budget) → program_min (user budget covers minimum)
 */

import {
  HARD16_KEYS,
  RANK10_KEYS,
  LOCKED_KEYS,
  PARTIAL_RANK10_SET,
  type Hard16Key,
  type Rank10Key,
  type LockedKey,
} from '@/lib/chat/contracts/filters';

// ============================================================
// FILTER MAPPING TYPES
// ============================================================

export type EntityTarget = 'program' | 'university' | 'program_join_university' | 'ranking_join';

export type OperatorSemantic =
  | 'exact_match'          // country_code = 'RU'
  | 'ilike'                // city ILIKE '%moscow%'
  | 'any_of'               // instruction_languages && ['en', 'ru']
  | 'array_overlap'        // intake_months && [1, 9]
  | 'range_gte'            // tuition_usd >= min
  | 'range_lte'            // tuition_usd <= max
  | 'range_overlap'        // Tuition Trio overlap logic (CORRECTED)
  | 'boolean'              // has_dorm = true
  | 'date_lte';            // deadline_date <= '2026-03-01'

export interface FilterMapping {
  /** The canonical filter key */
  key: string;
  /** Target entity in database */
  entityTarget: EntityTarget;
  /** Column path in vw_program_search_api_v3_final */
  fieldPath: string;
  /** Secondary field for range overlap (tuition) */
  secondaryFieldPath?: string;
  /** Operator semantics for filtering */
  operator: OperatorSemantic;
  /** Whether this filter requires a ranking join */
  requiresJoin: boolean;
  /** Current support status - NOT_SUPPORTED causes STOP */
  status: 'SUPPORTED' | 'NOT_SUPPORTED';
  /** Notes for debugging */
  notes?: string;
}

// ============================================================
// HARD 16 FILTER MAP (ALL SUPPORTED)
// ============================================================

export const HARD16_FILTER_MAP: Record<Hard16Key, FilterMapping> = {
  // 1-2. Location
  country_code: {
    key: 'country_code',
    entityTarget: 'program',
    fieldPath: 'country_code',
    operator: 'exact_match',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
  city: {
    key: 'city',
    entityTarget: 'program',
    fieldPath: 'city',
    operator: 'ilike',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
  
  // 3-4. Program Type
  degree_slug: {
    key: 'degree_slug',
    entityTarget: 'program',
    fieldPath: 'degree_slug',
    operator: 'exact_match',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
  discipline_slug: {
    key: 'discipline_slug',
    entityTarget: 'program',
    fieldPath: 'discipline_slug',
    operator: 'exact_match',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
  
  // 5-6. Study Details
  study_mode: {
    key: 'study_mode',
    entityTarget: 'program',
    fieldPath: 'study_mode',
    operator: 'exact_match',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
  instruction_languages: {
    key: 'instruction_languages',
    entityTarget: 'program',
    fieldPath: 'instruction_languages',
    operator: 'any_of',
    requiresJoin: false,
    status: 'SUPPORTED',
    notes: 'Uses && array overlap operator',
  },
  
  // 7-8. Tuition (CORRECTED MAPPING)
  tuition_usd_min: {
    key: 'tuition_usd_min',
    entityTarget: 'program',
    // User's minimum budget → compare against program's MAXIMUM tuition
    // Logic: program_max >= user_min (program can cost at least user's minimum)
    fieldPath: 'tuition_usd_year_max',
    operator: 'range_gte',
    requiresJoin: false,
    status: 'SUPPORTED',
    notes: 'CORRECTED: program_max >= user_min (budget range overlap)',
  },
  tuition_usd_max: {
    key: 'tuition_usd_max',
    entityTarget: 'program',
    // User's maximum budget → compare against program's MINIMUM tuition
    // Logic: program_min <= user_max (user can afford at least the minimum)
    fieldPath: 'tuition_usd_year_min',
    operator: 'range_lte',
    requiresJoin: false,
    status: 'SUPPORTED',
    notes: 'CORRECTED: program_min <= user_max (budget range overlap)',
  },
  
  // 9. Duration
  duration_months_max: {
    key: 'duration_months_max',
    entityTarget: 'program',
    fieldPath: 'duration_months',
    operator: 'range_lte',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
  
  // 10-11. Dormitory
  has_dorm: {
    key: 'has_dorm',
    entityTarget: 'program',
    fieldPath: 'has_dorm',
    operator: 'boolean',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
  dorm_price_monthly_usd_max: {
    key: 'dorm_price_monthly_usd_max',
    entityTarget: 'program',
    fieldPath: 'dorm_price_monthly_usd',
    operator: 'range_lte',
    requiresJoin: false,
    status: 'SUPPORTED',
    notes: 'Uses COALESCE(0) fallback',
  },
  
  // 12. Living Cost
  monthly_living_usd_max: {
    key: 'monthly_living_usd_max',
    entityTarget: 'program',
    fieldPath: 'monthly_living_usd',
    operator: 'range_lte',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
  
  // 13-14. Scholarship
  scholarship_available: {
    key: 'scholarship_available',
    entityTarget: 'program',
    fieldPath: 'scholarship_available',
    operator: 'boolean',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
  scholarship_type: {
    key: 'scholarship_type',
    entityTarget: 'program',
    fieldPath: 'scholarship_type',
    operator: 'exact_match',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
  
  // 15-16. Timing
  intake_months: {
    key: 'intake_months',
    entityTarget: 'program',
    fieldPath: 'intake_months',
    operator: 'array_overlap',
    requiresJoin: false,
    status: 'SUPPORTED',
    notes: 'Uses && array overlap operator',
  },
  deadline_before: {
    key: 'deadline_before',
    entityTarget: 'program',
    fieldPath: 'deadline_date',
    operator: 'date_lte',
    requiresJoin: false,
    status: 'SUPPORTED',
  },
};

// ============================================================
// RANK 10 FILTER MAP (4 SUPPORTED, 6 NOT_SUPPORTED)
// ============================================================
// ✅ ALL 10 RANK10 KEYS NOW SUPPORTED (2026-02-05)

export const RANK10_FILTER_MAP: Record<Rank10Key, FilterMapping> = {
  // 1-2. Ranking System (SUPPORTED - meta-filters)
  ranking_system: {
    key: 'ranking_system',
    entityTarget: 'ranking_join',
    fieldPath: 'ranking_system',
    operator: 'exact_match',
    requiresJoin: true,
    status: 'SUPPORTED',
    notes: 'Used to select ranking dataset',
  },
  ranking_year: {
    key: 'ranking_year',
    entityTarget: 'ranking_join',
    fieldPath: 'ranking_year',
    operator: 'exact_match',
    requiresJoin: true,
    status: 'SUPPORTED',
    notes: 'Required with ranking_system for threshold filters',
  },
  
  // 3-4. Rank Limits
  world_rank_max: {
    key: 'world_rank_max',
    entityTarget: 'ranking_join',
    fieldPath: 'world_rank',
    operator: 'range_lte',
    requiresJoin: true,
    status: 'SUPPORTED',
    notes: 'Requires ranking_system + ranking_year',
  },
  national_rank_max: {
    key: 'national_rank_max',
    entityTarget: 'ranking_join',
    fieldPath: 'national_rank',
    operator: 'range_lte',
    requiresJoin: true,
    status: 'SUPPORTED',
    notes: 'Requires ranking_system + ranking_year',
  },
  
  // 5-9. Score Thresholds (ALL SUPPORTED)
  overall_score_min: {
    key: 'overall_score_min',
    entityTarget: 'ranking_join',
    fieldPath: 'overall_score',
    operator: 'range_gte',
    requiresJoin: true,
    status: 'SUPPORTED',
    notes: 'Requires ranking_system + ranking_year',
  },
  teaching_score_min: {
    key: 'teaching_score_min',
    entityTarget: 'ranking_join',
    fieldPath: 'teaching_score',
    operator: 'range_gte',
    requiresJoin: true,
    status: 'SUPPORTED',
    notes: 'Requires ranking_system + ranking_year',
  },
  employability_score_min: {
    key: 'employability_score_min',
    entityTarget: 'ranking_join',
    fieldPath: 'employability_score',
    operator: 'range_gte',
    requiresJoin: true,
    status: 'SUPPORTED',
    notes: 'Requires ranking_system + ranking_year',
  },
  academic_reputation_score_min: {
    key: 'academic_reputation_score_min',
    entityTarget: 'ranking_join',
    fieldPath: 'academic_reputation_score',
    operator: 'range_gte',
    requiresJoin: true,
    status: 'SUPPORTED',
    notes: 'Requires ranking_system + ranking_year',
  },
  research_score_min: {
    key: 'research_score_min',
    entityTarget: 'ranking_join',
    fieldPath: 'research_score',
    operator: 'range_gte',
    requiresJoin: true,
    status: 'SUPPORTED',
    notes: 'Requires ranking_system + ranking_year',
  },
  
  // 10. Institution (SUPPORTED - direct filter)
  institution_id: {
    key: 'institution_id',
    entityTarget: 'program',
    fieldPath: 'university_id',
    operator: 'exact_match',
    requiresJoin: false,
    status: 'SUPPORTED',
    notes: 'Alias for university_id - no join needed',
  },
};

// ============================================================
// LOCKED KEYS (System-Only)
// ============================================================

export const LOCKED_FILTER_MAP: Record<LockedKey, { key: string; reason: string }> = {
  is_active: {
    key: 'is_active',
    reason: 'Server-side only: always true for active programs',
  },
  partner_priority: {
    key: 'partner_priority',
    reason: 'Server-side only: controls ranking priority',
  },
  do_not_offer: {
    key: 'do_not_offer',
    reason: 'Server-side only: always false to exclude hidden programs',
  },
  tuition_basis: {
    key: 'tuition_basis',
    reason: 'Server-side only: fixed to "year" for consistency',
  },
};

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Get filter mapping for a Hard16 key
 */
export function getHard16Mapping(key: Hard16Key): FilterMapping {
  return HARD16_FILTER_MAP[key];
}

/**
 * Get filter mapping for a Rank10 key
 */
export function getRank10Mapping(key: Rank10Key): FilterMapping {
  return RANK10_FILTER_MAP[key];
}

/**
 * Check if a filter is fully supported (SUPPORTED status)
 */
export function isFilterSupported(key: string): boolean {
  const hard16 = HARD16_FILTER_MAP[key as Hard16Key];
  if (hard16) return hard16.status === 'SUPPORTED';
  
  const rank10 = RANK10_FILTER_MAP[key as Rank10Key];
  if (rank10) return rank10.status === 'SUPPORTED';
  
  return false;
}

/**
 * Check if a Rank10 key is NOT_SUPPORTED (triggers STOP)
 */
export function isRank10NotSupported(key: string): boolean {
  return PARTIAL_RANK10_SET.has(key);
}

/**
 * Get all filters with their support status
 */
export function getFilterCoverageReport(): Array<{
  key: string;
  type: 'HARD16' | 'RANK10' | 'LOCKED';
  status: string;
  entityTarget: string;
  fieldPath: string;
  notes?: string;
}> {
  const report: Array<{
    key: string;
    type: 'HARD16' | 'RANK10' | 'LOCKED';
    status: string;
    entityTarget: string;
    fieldPath: string;
    notes?: string;
  }> = [];
  
  // Hard 16
  for (const key of HARD16_KEYS) {
    const mapping = HARD16_FILTER_MAP[key];
    report.push({
      key,
      type: 'HARD16',
      status: mapping.status,
      entityTarget: mapping.entityTarget,
      fieldPath: mapping.fieldPath,
      notes: mapping.notes,
    });
  }
  
  // Rank 10
  for (const key of RANK10_KEYS) {
    const mapping = RANK10_FILTER_MAP[key];
    report.push({
      key,
      type: 'RANK10',
      status: mapping.status,
      entityTarget: mapping.entityTarget,
      fieldPath: mapping.fieldPath,
      notes: mapping.notes,
    });
  }
  
  // Locked
  for (const key of LOCKED_KEYS) {
    const mapping = LOCKED_FILTER_MAP[key];
    report.push({
      key,
      type: 'LOCKED',
      status: 'BLOCKED',
      entityTarget: 'N/A',
      fieldPath: 'N/A',
      notes: mapping.reason,
    });
  }
  
  return report;
}
