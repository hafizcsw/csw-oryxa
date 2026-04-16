// ═══════════════════════════════════════════════════════════════
// Order 2 — Transcript Lane Harness
// ═══════════════════════════════════════════════════════════════
// Deterministic proof for two synthetic cases:
//   A. Born-digital clean transcript (English, with course rows + GPA)
//   B. Ambiguous grad-vs-transcript (graduation cert wording + scattered grade)
//
// Case C (real degraded transcript) MUST be live-uploaded by the user;
// closure for Order 2 is not granted on harness alone.
//
// Run:  npx tsx scripts/order2-transcript-harness.mts
// ═══════════════════════════════════════════════════════════════

import { classifyDocument } from '../src/features/documents/parsers/content-classifier';
import { parseTranscript } from '../src/features/documents/parsers/transcript-parser';
import {
  applyPromotionRules,
  createProposal,
} from '../src/features/documents/extraction-proposal-model';

// ── Case A: Born-digital clean transcript ───────────────────────
const CASE_A_TEXT = `
University of Cairo
Faculty of Engineering
Official Academic Transcript

Student: Ahmed Hassan
Program: Bachelor of Computer Engineering
Major: Computer Science

Semester 1 — Fall 2021
CS101  Introduction to Programming        A    3 credit hours
MTH121 Calculus I                          B+   4 credit hours
PHY101 General Physics                     B    3 credit hours
ENG101 Technical English                   A-   2 credit hours

Semester 2 — Spring 2022
CS102  Data Structures                     A    3 credit hours
MTH122 Calculus II                         B    4 credit hours
CS201  Algorithms                          A-   3 credit hours

Cumulative GPA: 3.65 / 4.0
Credit hours completed: 22
`;

// ── Case B: Ambiguous grad-vs-transcript ────────────────────────
// Graduation certificate wording + a single scattered grade fragment.
// Should NOT classify as transcript_strong.
const CASE_B_TEXT = `
The University of Alexandria

This is to certify that
Mohamed Ali
has successfully completed the requirements for the
Bachelor of Science degree in Mechanical Engineering
and is hereby awarded the degree with grade B+ (Very Good)
on this 15th day of June 2023.

Conferred under the seal of the university.
`;

interface CaseRunResult {
  label: string;
  classification: string;
  classification_confidence: number;
  transcript_lane_strength: string | null;
  disambiguation_reason: string | null;
  intermediate_summary: string | null;
  rows_count: number;
  partial: boolean;
  coverage_estimate: number;
  header: Record<string, string | null>;
  proposals: Array<{
    field: string;
    status: string;
    auto_apply_candidate: boolean;
    confidence: number;
  }>;
}

function runCase(label: string, fileName: string, text: string): CaseRunResult {
  const cls = classifyDocument({
    fileName,
    textContent: text,
    mimeType: 'application/pdf',
  });

  let rowsCount = 0;
  let partial = true;
  let coverage = 0;
  let intermediateSummary: string | null = null;
  const header: Record<string, string | null> = {
    institution_name: null,
    degree_program: null,
    gpa_raw: null,
    gpa_scale: null,
    grading_system_hint: null,
  };
  const proposals: CaseRunResult['proposals'] = [];

  if (cls.best === 'transcript') {
    const { intermediate, header_fields } = parseTranscript(text);
    rowsCount = intermediate.rows.length;
    partial = intermediate.partial;
    coverage = intermediate.coverage.coverage_estimate;
    intermediateSummary = intermediate.evidence_summary;
    header.institution_name = intermediate.header.institution_name?.value ?? null;
    header.degree_program = intermediate.header.degree_program?.value ?? null;
    header.gpa_raw = intermediate.header.gpa_raw?.value ?? null;
    header.gpa_scale = intermediate.header.gpa_scale?.value ?? null;
    header.grading_system_hint = intermediate.header.grading_system_hint?.value ?? null;

    for (const [fieldKey, extracted] of Object.entries(header_fields)) {
      if (extracted.value == null) continue;
      const proposal = createProposal({
        studentId: 'harness-student',
        documentId: 'harness-doc',
        fieldKey,
        proposedValue: String(extracted.value),
        normalizedValue: String(extracted.value).toLowerCase(),
        confidence: extracted.confidence,
        conflictWithCurrent: false,
      });
      const promoted = applyPromotionRules(proposal, {
        readability: 'readable',
        parser_source: extracted.parser_source,
        source_lane: 'transcript',
      });
      proposals.push({
        field: promoted.field_key,
        status: promoted.proposal_status,
        auto_apply_candidate: promoted.auto_apply_candidate,
        confidence: Number(promoted.confidence.toFixed(3)),
      });
    }
  }

  return {
    label,
    classification: cls.best,
    classification_confidence: Number(cls.confidence.toFixed(3)),
    transcript_lane_strength: cls.transcript_lane_strength,
    disambiguation_reason: cls.transcript_disambiguation_reason,
    intermediate_summary: intermediateSummary,
    rows_count: rowsCount,
    partial,
    coverage_estimate: Number(coverage.toFixed(2)),
    header,
    proposals,
  };
}

const A = runCase('A: born-digital clean transcript', 'transcript_official.pdf', CASE_A_TEXT);
const B = runCase('B: ambiguous grad-vs-transcript', 'graduation_certificate.pdf', CASE_B_TEXT);

console.log('═══════════════════════════════════════════════════════════════');
console.log('Order 2 — Transcript Lane Harness Results');
console.log('═══════════════════════════════════════════════════════════════');
console.log(JSON.stringify({ caseA: A, caseB: B }, null, 2));
console.log('═══════════════════════════════════════════════════════════════');

// ── Assertions ──────────────────────────────────────────────────
const failures: string[] = [];

// Case A expectations: transcript_strong, rows extracted, no auto-accept anywhere.
if (A.classification !== 'transcript') failures.push('A: classification != transcript');
if (A.transcript_lane_strength !== 'transcript_strong')
  failures.push(`A: lane_strength=${A.transcript_lane_strength}, expected transcript_strong`);
if (A.rows_count < 4) failures.push(`A: rows_count=${A.rows_count}, expected >=4`);
if (!A.partial) failures.push('A: partial flag must be true in V1');
if (A.proposals.some(p => p.auto_apply_candidate))
  failures.push('A: HONESTY GATE 3 violated — transcript proposal auto_apply_candidate=true');
if (A.proposals.some(p => p.status === 'auto_accepted'))
  failures.push('A: HONESTY GATE 3 violated — transcript proposal auto_accepted');
if (!A.header.gpa_raw) failures.push('A: header.gpa_raw missing');
if (!A.header.gpa_scale) failures.push('A: header.gpa_scale missing (4.0 was explicit)');

// Case B expectations: must NOT end as transcript_strong.
if (B.classification === 'transcript' && B.transcript_lane_strength === 'transcript_strong')
  failures.push('B: false positive — graduation cert classified as transcript_strong');

console.log('');
if (failures.length === 0) {
  console.log('✅ HARNESS PASS — Cases A + B behave per Order 2 contract.');
  console.log('⏳ Closure pending live Case C (real degraded transcript upload).');
} else {
  console.log('❌ HARNESS FAIL:');
  for (const f of failures) console.log('  -', f);
  process.exit(1);
}
