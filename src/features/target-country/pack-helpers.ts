// ═══════════════════════════════════════════════════════════════
// Door 2 — Truth Pack Helpers
// ═══════════════════════════════════════════════════════════════
import type {
  TargetCountryProfile,
  EntryPathwayRule,
  LanguageRule,
  DocumentRule,
  SourceEvidence,
  EntryPathKind,
} from './types';

export function makePathway(
  ruleId: string,
  pathKind: EntryPathKind,
  available: boolean,
  opts: Partial<Omit<EntryPathwayRule, 'rule_id' | 'path_kind' | 'available'>> = {},
): EntryPathwayRule {
  return {
    rule_id: ruleId,
    path_kind: pathKind,
    available,
    requires_secondary_completed: opts.requires_secondary_completed ?? true,
    min_secondary_grade_pct: opts.min_secondary_grade_pct ?? null,
    accepted_secondary_kinds:
      opts.accepted_secondary_kinds ?? ['general', 'vocational', 'technical', 'diploma'],
    citizenship_constraints: opts.citizenship_constraints ?? null,
    notes: opts.notes,
    evidence_ids: opts.evidence_ids ?? [],
  };
}

export function makeLangRule(
  ruleId: string,
  partial: Omit<LanguageRule, 'rule_id'>,
): LanguageRule {
  return { rule_id: ruleId, ...partial };
}

export function makeDocRule(
  ruleId: string,
  partial: Omit<DocumentRule, 'rule_id'>,
): DocumentRule {
  return { rule_id: ruleId, ...partial };
}

export function makeProfile(p: TargetCountryProfile): TargetCountryProfile {
  return p;
}

export function makeEvidence(e: SourceEvidence): SourceEvidence {
  return e;
}
