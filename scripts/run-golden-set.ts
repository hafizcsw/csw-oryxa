// Phase A Golden Set runner — verifies normalizer against approved fixtures.
import { sourceNormalizer } from '../src/features/source-normalization/engine';
import { GOLDEN_SET } from '../src/features/source-normalization/fixtures/golden-set';

interface FailReason {
  field: string;
  expected: unknown;
  actual: unknown;
}

function arrEq(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].map(String).sort();
  const sb = [...b].map(String).sort();
  return sa.every((v, i) => v === sb[i]);
}

function evaluate(caseId: string): {
  pass: boolean;
  reasons: FailReason[];
  expected: any;
  actual: any;
} {
  const c = GOLDEN_SET.find((g) => g.case_id === caseId)!;
  const actual = sourceNormalizer.normalize(c.input);
  const exp = c.expected;
  const fails: FailReason[] = [];

  if (exp.normalized_credential_kind !== undefined && exp.normalized_credential_kind !== actual.normalized_credential_kind) {
    fails.push({ field: 'kind', expected: exp.normalized_credential_kind, actual: actual.normalized_credential_kind });
  }
  if (exp.normalized_credential_subtype !== undefined && exp.normalized_credential_subtype !== actual.normalized_credential_subtype) {
    fails.push({ field: 'subtype', expected: exp.normalized_credential_subtype, actual: actual.normalized_credential_subtype });
  }
  if (exp.normalized_grade_pct !== undefined && exp.normalized_grade_pct !== actual.normalized_grade_pct) {
    fails.push({ field: 'grade_pct', expected: exp.normalized_grade_pct, actual: actual.normalized_grade_pct });
  }
  if (exp.needs_manual_review !== undefined && exp.needs_manual_review !== actual.needs_manual_review) {
    fails.push({ field: 'needs_review', expected: exp.needs_manual_review, actual: actual.needs_manual_review });
  }
  if (exp.matched_rule_ids !== undefined && !arrEq(exp.matched_rule_ids, actual.matched_rule_ids)) {
    fails.push({ field: 'matched_rule_ids', expected: exp.matched_rule_ids, actual: actual.matched_rule_ids });
  }
  if ((exp as any).reason_codes !== undefined) {
    const expCodes = (exp as any).reason_codes as string[];
    const actCodes = actual.decisions.map((d) => d.reason_code);
    const missing = expCodes.filter((rc) => !actCodes.includes(rc as any));
    if (missing.length > 0) {
      fails.push({ field: 'reason_codes(missing)', expected: expCodes, actual: actCodes });
    }
  }

  return { pass: fails.length === 0, reasons: fails, expected: exp, actual };
}

const results = GOLDEN_SET.map((c) => ({
  case_id: c.case_id,
  category: c.category,
  ...evaluate(c.case_id),
}));

const passed = results.filter((r) => r.pass).length;
const total = results.length;

console.log('═══════════════════════════════════════════════════════════');
console.log(`Golden Set: ${passed}/${total} passed`);
console.log('═══════════════════════════════════════════════════════════');
for (const r of results) {
  const mark = r.pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark}  [${r.category}]  ${r.case_id}`);
  if (!r.pass) {
    for (const f of r.reasons) {
      console.log(`    └─ ${f.field}: expected=${JSON.stringify(f.expected)}  actual=${JSON.stringify(f.actual)}`);
    }
  }
}
console.log('═══════════════════════════════════════════════════════════');
console.log(JSON.stringify({ passed, total }, null, 2));
process.exit(passed === total ? 0 : 1);
