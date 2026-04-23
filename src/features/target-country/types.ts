// ═══════════════════════════════════════════════════════════════
// Door 2 — Target Country Reference Layer (After-Secondary only)
// ═══════════════════════════════════════════════════════════════
// Scope:
//   - 10 countries: CN RU US CA DE GB ES FI IT CH
//   - Lane: after-secondary only
//   - Output: country-level eligibility (entry-path granularity only)
//   - NOT in scope: program graph, university match, scholarships,
//     visa, improvement engine, master/PhD lanes.
// ═══════════════════════════════════════════════════════════════

export type CountryCode =
  | 'CN' | 'RU' | 'US' | 'CA' | 'DE' | 'GB' | 'ES' | 'FI' | 'IT' | 'CH';

export const TARGET_COUNTRIES: CountryCode[] = [
  'CN', 'RU', 'US', 'CA', 'DE', 'GB', 'ES', 'FI', 'IT', 'CH',
];

// ── Entry pathways (after-secondary only) ────────────────────

export type EntryPathKind =
  | 'foundation'      // pre-bachelor bridging year
  | 'bridging'        // language/academic bridging program
  | 'short_cycle'     // 2-year diploma / associate / IUT-style
  | 'bachelor_entry'; // direct first-year bachelor admission

// ── Source evidence reference ────────────────────────────────

export interface SourceEvidence {
  evidence_id: string;          // stable id, e.g. "DE.kmk.anabin.2024"
  source_type:
    | 'official_gov'
    | 'official_ministry'
    | 'official_university_assoc'
    | 'recognized_third_party';
  url: string;
  title: string;
  observed_year: number;
  notes?: string;
}

// ── Language rule ────────────────────────────────────────────

export interface LanguageRule {
  rule_id: string;
  language: 'english' | 'local' | 'either';
  local_language_code?: string;     // e.g. "de", "es", "fi", "zh"
  english_test_min: {
    ielts?: number;
    toefl_ibt?: number;
    duolingo?: number;
    pte?: number;
  } | null;
  local_test_min?: {
    test_name: string;              // TestDaF, DELE, YKI, HSK, TORFL …
    level_or_score: string;
  };
  applies_to_paths: EntryPathKind[];
  exemption_basis?: string[];       // e.g. ["english_medium_secondary"]
  evidence_ids: string[];
}

// ── Document rule (high-level only — not per-program) ───────

export interface DocumentRule {
  rule_id: string;
  required_document: 'secondary_certificate' | 'transcript' | 'passport'
    | 'language_certificate' | 'recognition_statement' | 'translation';
  must_be_translated_to?: string;   // ISO lang
  must_be_legalized?: boolean;      // apostille / legalization
  applies_to_paths: EntryPathKind[];
  evidence_ids: string[];
}

// ── Entry pathway rule ───────────────────────────────────────

export interface EntryPathwayRule {
  rule_id: string;
  path_kind: EntryPathKind;
  available: boolean;
  // Eligibility predicates (declarative — engine interprets)
  requires_secondary_completed: boolean;
  min_secondary_grade_pct?: number | null;
  accepted_secondary_kinds?: Array<'general' | 'vocational' | 'technical' | 'diploma'>;
  citizenship_constraints?: {
    blocked?: string[];             // ISO country codes
    allowed_only?: string[];
  } | null;
  notes?: string;
  evidence_ids: string[];
}

// ── Country profile (the truth pack) ─────────────────────────

export interface TargetCountryProfile {
  country_code: CountryCode;
  country_name_en: string;
  primary_local_language: string | null; // ISO lang code
  english_taught_widely_available: boolean;
  pathways: EntryPathwayRule[];
  language_rules: LanguageRule[];
  document_rules: DocumentRule[];
  evidence: SourceEvidence[];
  pack_version: string;             // e.g. "2026.04-v1"
}

// ── Engine output ────────────────────────────────────────────

export type CountryStatus =
  | 'eligible'        // ≥1 entry path open, no hard blockers
  | 'conditional'     // path open but blocking_gaps must be resolved
  | 'blocked'         // no path currently open
  | 'unknown';        // insufficient applicant truth

export type ReasonCode =
  | 'no_secondary_completion'
  | 'secondary_grade_below_min'
  | 'secondary_kind_not_accepted'
  | 'language_test_missing'
  | 'language_score_below_min'
  | 'local_language_required'
  | 'citizenship_blocked'
  | 'citizenship_not_allowed'
  | 'path_unavailable_in_country'
  | 'recognition_statement_required'
  | 'document_legalization_required'
  | 'truth_insufficient';

export interface DecisionReason {
  reason_code: ReasonCode;
  params: Record<string, unknown>;
  matched_rule_id: string;
  evidence_ids: string[];
  severity: 'info' | 'gap' | 'blocker';
}

export interface CountryEligibility {
  country_code: CountryCode;
  status: CountryStatus;
  eligible_entry_paths: EntryPathKind[];
  blocked_entry_paths: EntryPathKind[];
  blocking_gaps: DecisionReason[];      // severity=gap (conditional)
  blockers: DecisionReason[];           // severity=blocker
  info_reasons: DecisionReason[];       // severity=info
  matched_rule_ids: string[];
  evidence_ids: string[];
  confidence: number;                   // 0..1
  pack_version: string;
}

export interface CountryMatrix {
  applicant_summary: {
    student_id: string;
    citizenship: string | null;
    secondary_completed: boolean;
    secondary_kind: string | null;
    secondary_grade_pct: number | null;
    english_test_type: string | null;
    english_total_score: number | null;
    local_language_signals: string[];
  };
  results: CountryEligibility[];
  generated_at: string;                 // ISO
}
