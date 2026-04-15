import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredPaths = [
  'docs/russian/runtime-verification-checklist.md',
  'docs/russian/intensive-750-runtime-verification-checklist.md',
  'docs/russian/intensive-750-assessment-verification-checklist.md',
  'docs/russian/staging-closure-handoff.md',
  'scripts/validate-russian-shared-core-runtime.mjs',
  'scripts/bootstrap-russian-intensive-proof.mjs',
  'supabase/migrations/20260322110000_russian_execution_pack_1_foundation.sql',
  'supabase/migrations/20260322124500_russian_execution_pack_1_runtime_closure.sql',
  'supabase/migrations/20260322153000_russian_assessment_scoring_payloads.sql',
  'supabase/migrations/20260323120000_russian_intensive_review_state.sql',
];

const missing = requiredPaths.filter((relativePath) => !fs.existsSync(path.join(root, relativePath)));
if (missing.length) {
  console.error('Russian runtime-proof pack validation failed:');
  for (const item of missing) console.error(`- missing ${item}`);
  process.exit(1);
}

const checklist = fs.readFileSync(path.join(root, 'docs/russian/runtime-verification-checklist.md'), 'utf8');
for (const snippet of [
  '20260323120000_russian_intensive_review_state.sql',
  'scripts/bootstrap-russian-intensive-proof.mjs',
  'learning_exam_notices',
  'russian_intensive_review_states',
]) {
  if (!checklist.includes(snippet)) {
    console.error(`Russian runtime-proof pack validation failed: checklist missing ${snippet}`);
    process.exit(1);
  }
}

console.log('Russian runtime-proof pack validation passed.');
