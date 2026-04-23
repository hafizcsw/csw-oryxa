// ═══════════════════════════════════════════════════════════════
// Door 3 — Experiment harness
// ═══════════════════════════════════════════════════════════════
// Single entrypoint that runs the full Door 1→2→3 chain on any
// ApplicantTruth and emits a deterministic, inspectable artifact.
// No I/O. No actor binding. Caller supplies target context.
// ═══════════════════════════════════════════════════════════════
import type { ApplicantTruth } from './applicant-normalize';
import { computeCountryMatrix } from './engine';
import type { CountryMatrix } from './types';
import {
  buildMeasurementSnapshot,
  extractTopBlockers,
  type MeasurementSnapshot,
  type TopBlocker,
} from './measurement';

export type HarnessMode = 'fixture' | 'live_smoke';

export interface HarnessArtifact {
  mode: HarnessMode;
  target_student_id: string;
  applicant_truth: ApplicantTruth;
  measurement_snapshot: MeasurementSnapshot;
  matrix: CountryMatrix;
  top_blockers: TopBlocker[];
  matched_rule_ids: string[];      // union across countries
  evidence_ids: string[];          // union across countries
  countries_in_matrix: string[];   // proves country pack count at runtime
  generated_at: string;
}

export function runHarness(mode: HarnessMode, truth: ApplicantTruth): HarnessArtifact {
  const trace_id = `harness_${mode}_${truth.student_id}_${Date.now()}`;
  const snapshot = buildMeasurementSnapshot(truth, trace_id);
  const matrix = computeCountryMatrix(truth);

  const ruleSet = new Set<string>();
  const evSet = new Set<string>();
  for (const r of matrix.results) {
    r.matched_rule_ids.forEach((id) => ruleSet.add(id));
    r.evidence_ids.forEach((id) => evSet.add(id));
  }

  return {
    mode,
    target_student_id: truth.student_id,
    applicant_truth: truth,
    measurement_snapshot: snapshot,
    matrix,
    top_blockers: extractTopBlockers(matrix, 10),
    matched_rule_ids: Array.from(ruleSet).sort(),
    evidence_ids: Array.from(evSet).sort(),
    countries_in_matrix: matrix.results.map((r) => r.country_code),
    generated_at: new Date().toISOString(),
  };
}
