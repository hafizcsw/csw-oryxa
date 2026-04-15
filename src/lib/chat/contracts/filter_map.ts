/**
 * ════════════════════════════════════════════════════════════════════════════
 * FILTER WIRING MAP - Entity Targets & Operator Semantics
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * ⚠️  CONTRACT LOCKED — DO NOT EDIT WITHOUT CRM CHANGE + EVIDENCE  ⚠️
 * 
 * This file defines WHERE each filter key is applied (Program/University/Join)
 * and HOW it's applied (operator semantics).
 * 
 * CRITICAL: If a key has no mapping or requires_join = true but join unavailable,
 * the filter is NOT WIRED and must cause STOP (Fail-Closed).
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

import { HARD16_KEYS, RANK10_KEYS, LOCKED_KEYS, type Hard16Key, type Rank10Key, type LockedKey } from './filters';

// ============================================================
// ENTITY TARGET TYPES
// ============================================================

export type EntityTarget = 'program' | 'university' | 'program_via_university';

export type OperatorSemantics = 
  | 'exact'           // Exact match (=)
  | 'contains_any'    // Array overlap (ANY)
  | 'range_min'       // >= comparison
  | 'range_max'       // <= comparison
  | 'boolean'         // true/false
  | 'date_before'     // <= date comparison
  | 'date_after';     // >= date comparison

export interface FilterMapping {
  /** The canonical key name */
  key: string;
  /** Which entity this filter targets */
  entity: EntityTarget;
  /** The database field path (column name in view/table) */
  field_path: string;
  /** How the filter is applied */
  operator: OperatorSemantics;
  /** Whether this requires a JOIN (e.g., ranking data) */
  requires_join: boolean;
  /** Human-readable description */
  description: string;
  /** Wiring status */
  wired: boolean;
}

// ============================================================
// HARD16 FILTER MAP (16 keys - all WIRED)
// ============================================================

export const HARD16_FILTER_MAP: Record<Hard16Key, FilterMapping> = {
  // Location (2)
  country_code: {
    key: 'country_code',
    entity: 'program',
    field_path: 'country_code',
    operator: 'exact',
    requires_join: false,
    description: 'Program country ISO code',
    wired: true,
  },
  city: {
    key: 'city',
    entity: 'program',
    field_path: 'city',
    operator: 'exact', // ✅ EXACT MATCH (confirmed in Edge 2026-02-05)
    requires_join: false,
    description: 'Program city name (exact match - NOT contains)',
    wired: true,
  },
  
  // Program Type (2)
  degree_slug: {
    key: 'degree_slug',
    entity: 'program',
    field_path: 'degree_slug',
    operator: 'exact',
    requires_join: false,
    description: 'Degree level (bachelor, master, etc.)',
    wired: true,
  },
  discipline_slug: {
    key: 'discipline_slug',
    entity: 'program',
    field_path: 'discipline_slug',
    operator: 'exact',
    requires_join: false,
    description: 'Academic discipline/major',
    wired: true,
  },
  
  // Study Details (2)
  study_mode: {
    key: 'study_mode',
    entity: 'program',
    field_path: 'study_mode',
    operator: 'exact',
    requires_join: false,
    description: 'Study mode (full_time, part_time, etc.)',
    wired: true,
  },
  instruction_languages: {
    key: 'instruction_languages',
    entity: 'program',
    field_path: 'instruction_languages',
    operator: 'contains_any',
    requires_join: false,
    description: 'Languages of instruction (any-of match)',
    wired: true,
  },
  
  // Tuition (2)
  tuition_usd_min: {
    key: 'tuition_usd_min',
    entity: 'program',
    field_path: 'tuition_usd_year_max', // User min budget filters program max
    operator: 'range_min',
    requires_join: false,
    description: 'Minimum tuition budget (program.max >= user.min)',
    wired: true,
  },
  tuition_usd_max: {
    key: 'tuition_usd_max',
    entity: 'program',
    field_path: 'tuition_usd_year_min', // User max budget filters program min
    operator: 'range_max',
    requires_join: false,
    description: 'Maximum tuition budget (program.min <= user.max)',
    wired: true,
  },
  
  // Duration (1)
  duration_months_max: {
    key: 'duration_months_max',
    entity: 'program',
    field_path: 'duration_months',
    operator: 'range_max',
    requires_join: false,
    description: 'Maximum program duration in months',
    wired: true,
  },
  
  // Dormitory (2)
  has_dorm: {
    key: 'has_dorm',
    entity: 'program',
    field_path: 'has_dorm',
    operator: 'boolean',
    requires_join: false,
    description: 'Whether dormitory is available',
    wired: true,
  },
  dorm_price_monthly_usd_max: {
    key: 'dorm_price_monthly_usd_max',
    entity: 'program',
    field_path: 'dorm_price_monthly_usd',
    operator: 'range_max',
    requires_join: false,
    description: 'Maximum monthly dorm price',
    wired: true,
  },
  
  // Living Cost (1)
  monthly_living_usd_max: {
    key: 'monthly_living_usd_max',
    entity: 'program',
    field_path: 'monthly_living_usd',
    operator: 'range_max',
    requires_join: false,
    description: 'Maximum monthly living cost',
    wired: true,
  },
  
  // Scholarship (2)
  scholarship_available: {
    key: 'scholarship_available',
    entity: 'program',
    field_path: 'scholarship_available',
    operator: 'boolean',
    requires_join: false,
    description: 'Whether scholarships are available',
    wired: true,
  },
  scholarship_type: {
    key: 'scholarship_type',
    entity: 'program',
    field_path: 'scholarship_type',
    operator: 'exact',
    requires_join: false,
    description: 'Type of scholarship (full, partial, etc.)',
    wired: true,
  },
  
  // Timing (2)
  intake_months: {
    key: 'intake_months',
    entity: 'program',
    field_path: 'intake_months',
    operator: 'contains_any',
    requires_join: false,
    description: 'Intake months (overlap match)',
    wired: true,
  },
  deadline_before: {
    key: 'deadline_before',
    entity: 'program',
    field_path: 'deadline_date',
    operator: 'date_before',
    requires_join: false,
    description: 'Application deadline before date',
    wired: true,
  },
};

// ============================================================
// RANK10 FILTER MAP (10 keys - all WIRED)
// ============================================================

export const RANK10_FILTER_MAP: Record<Rank10Key, FilterMapping> = {
  // Direct filter (1)
  institution_id: {
    key: 'institution_id',
    entity: 'program_via_university',
    field_path: 'institution_id',
    operator: 'exact',
    requires_join: false, // Already joined in view
    description: 'Direct university/institution ID filter',
    wired: true,
  },
  
  // Context keys (2) - Required for threshold filters
  ranking_system: {
    key: 'ranking_system',
    entity: 'university',
    field_path: 'ranking_system',
    operator: 'exact',
    requires_join: true,
    description: 'Ranking system (qs, the, arwu, etc.)',
    wired: true,
  },
  ranking_year: {
    key: 'ranking_year',
    entity: 'university',
    field_path: 'ranking_year',
    operator: 'exact',
    requires_join: true,
    description: 'Ranking year',
    wired: true,
  },
  
  // Threshold keys (7) - Require ranking_system + ranking_year
  world_rank_max: {
    key: 'world_rank_max',
    entity: 'university',
    field_path: 'world_rank',
    operator: 'range_max',
    requires_join: true,
    description: 'Maximum world ranking position',
    wired: true,
  },
  national_rank_max: {
    key: 'national_rank_max',
    entity: 'university',
    field_path: 'national_rank',
    operator: 'range_max',
    requires_join: true,
    description: 'Maximum national ranking position',
    wired: true,
  },
  overall_score_min: {
    key: 'overall_score_min',
    entity: 'university',
    field_path: 'overall_score',
    operator: 'range_min',
    requires_join: true,
    description: 'Minimum overall score',
    wired: true,
  },
  teaching_score_min: {
    key: 'teaching_score_min',
    entity: 'university',
    field_path: 'teaching_score',
    operator: 'range_min',
    requires_join: true,
    description: 'Minimum teaching score',
    wired: true,
  },
  employability_score_min: {
    key: 'employability_score_min',
    entity: 'university',
    field_path: 'employability_score',
    operator: 'range_min',
    requires_join: true,
    description: 'Minimum employability score',
    wired: true,
  },
  academic_reputation_score_min: {
    key: 'academic_reputation_score_min',
    entity: 'university',
    field_path: 'academic_reputation_score',
    operator: 'range_min',
    requires_join: true,
    description: 'Minimum academic reputation score',
    wired: true,
  },
  research_score_min: {
    key: 'research_score_min',
    entity: 'university',
    field_path: 'research_score',
    operator: 'range_min',
    requires_join: true,
    description: 'Minimum research score',
    wired: true,
  },
};

// ============================================================
// LOCKED KEYS MAP (4 keys - server-only, NEVER from client)
// ============================================================

export const LOCKED_FILTER_MAP: Record<LockedKey, FilterMapping> = {
  is_active: {
    key: 'is_active',
    entity: 'program',
    field_path: 'is_active',
    operator: 'boolean',
    requires_join: false,
    description: 'LOCKED: Program active status (server-only)',
    wired: false, // NEVER wired for client
  },
  partner_priority: {
    key: 'partner_priority',
    entity: 'university',
    field_path: 'partner_priority',
    operator: 'exact',
    requires_join: false,
    description: 'LOCKED: Partner priority level (server-only)',
    wired: false, // NEVER wired for client
  },
  do_not_offer: {
    key: 'do_not_offer',
    entity: 'program',
    field_path: 'do_not_offer',
    operator: 'boolean',
    requires_join: false,
    description: 'LOCKED: Do not offer flag (server-only)',
    wired: false, // NEVER wired for client
  },
  tuition_basis: {
    key: 'tuition_basis',
    entity: 'program',
    field_path: 'tuition_basis',
    operator: 'exact',
    requires_join: false,
    description: 'LOCKED: Tuition calculation basis (server-only)',
    wired: false, // NEVER wired for client
  },
};

// ============================================================
// COMBINED FILTER MAP (26 allowed + 4 locked)
// ============================================================

export const ALL_FILTER_MAP: Record<string, FilterMapping> = {
  ...HARD16_FILTER_MAP,
  ...RANK10_FILTER_MAP,
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get filter mapping for a key
 */
export function getFilterMapping(key: string): FilterMapping | null {
  return ALL_FILTER_MAP[key] || LOCKED_FILTER_MAP[key as LockedKey] || null;
}

/**
 * Check if a filter key is wired (can be used)
 */
export function isFilterWired(key: string): boolean {
  const mapping = ALL_FILTER_MAP[key];
  return mapping?.wired === true;
}

/**
 * Check if a filter requires JOIN
 */
export function filterRequiresJoin(key: string): boolean {
  const mapping = getFilterMapping(key);
  return mapping?.requires_join === true;
}

/**
 * Get all filters targeting a specific entity
 */
export function getFiltersByEntity(entity: EntityTarget): FilterMapping[] {
  return Object.values(ALL_FILTER_MAP).filter(m => m.entity === entity);
}

// ============================================================
// WIRING STATUS SUMMARY
// ============================================================

export const WIRING_STATUS = {
  HARD16: {
    total: HARD16_KEYS.length,
    wired: Object.values(HARD16_FILTER_MAP).filter(m => m.wired).length,
  },
  RANK10: {
    total: RANK10_KEYS.length,
    wired: Object.values(RANK10_FILTER_MAP).filter(m => m.wired).length,
  },
  LOCKED: {
    total: LOCKED_KEYS.length,
    wired: 0, // NEVER wired for client
  },
  get summary() {
    const totalAllowed = this.HARD16.total + this.RANK10.total;
    const totalWired = this.HARD16.wired + this.RANK10.wired;
    return {
      total_allowed_keys: totalAllowed,
      total_wired: totalWired,
      coverage_percent: Math.round((totalWired / totalAllowed) * 100),
      status: totalWired === totalAllowed ? 'FULL' : 'PARTIAL',
    };
  },
};
