import { computeCountryMatrix } from './engine';
import { FIXTURE_APPLICANT } from './fixture';

const matrix = computeCountryMatrix(FIXTURE_APPLICANT);
console.log('=== Door 2 fixture matrix ===');
console.log('applicant:', JSON.stringify(matrix.applicant_summary));
console.log('generated_at:', matrix.generated_at);
console.log('country | status | eligible | blocked | gaps | blockers | confidence');
for (const r of matrix.results) {
  console.log(
    `${r.country_code} | ${r.status} | [${r.eligible_entry_paths.join(',')}] | [${r.blocked_entry_paths.join(',')}] | ${r.blocking_gaps.length} | ${r.blockers.length} | ${r.confidence}`
  );
}
console.log('\n--- DETAIL per country ---');
for (const r of matrix.results) {
  console.log(`\n[${r.country_code}] pack=${r.pack_version}`);
  console.log('  matched_rules:', r.matched_rule_ids.join(', '));
  console.log('  evidence:', r.evidence_ids.join(', '));
  if (r.blocking_gaps.length) console.log('  gaps:', JSON.stringify(r.blocking_gaps));
  if (r.blockers.length) console.log('  blockers:', JSON.stringify(r.blockers));
}
