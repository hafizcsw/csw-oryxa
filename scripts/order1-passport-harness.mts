// ═══════════════════════════════════════════════════════════════
// Order 1 — Passport Lane Hardening: deterministic harness
// ═══════════════════════════════════════════════════════════════
// Exercises the real engine modules (classifier + MRZ parser +
// field extractors + promotion rules) on synthetic fixtures for:
//   Case A — clean passport with valid MRZ
//   Case B — false-positive passport (filename/text suggests
//            passport but no MRZ and weak/no text evidence)
//
// Case C (real degraded passport) MUST come from a live preview
// upload — this harness does not synthesize OCR garbage.
//
// Run:  npx tsx scripts/order1-passport-harness.mts
// ═══════════════════════════════════════════════════════════════

import { classifyDocument } from '../src/features/documents/parsers/content-classifier';
import { parseMrz } from '../src/features/documents/parsers/mrz-parser';
import {
  extractPassportFields,
  extractPassportTextFallback,
} from '../src/features/documents/parsers/field-extractors';
import {
  applyPromotionRules,
  createProposal,
  type ExtractionProposal,
} from '../src/features/documents/extraction-proposal-model';

interface Fixture {
  label: string;
  fileName: string;
  mimeType: string;
  textContent: string;
  /** Simulated readability of the source artifact. */
  readability: 'readable' | 'degraded' | 'unreadable';
}

// ── Case A: clean passport with valid TD3 MRZ ─────────────────
// Real-world TD3 example (synthetic identity, valid checksums not required
// for parser — parser is structural, not check-digit-validating).
const CASE_A: Fixture = {
  label: 'A — clean passport (valid MRZ)',
  fileName: 'passport.pdf',
  mimeType: 'application/pdf',
  readability: 'readable',
  textContent: [
    'REPUBLIC OF JORDAN',
    'PASSPORT',
    'Passport No: N1234567',
    'Nationality: JORDANIAN',
    'Date of Birth: 12 MAR 1995',
    'Sex: M',
    'Date of Expiry: 11 MAR 2030',
    'Place of Birth: AMMAN',
    'Issuing Authority: MINISTRY OF INTERIOR',
    '',
    'P<JORALKHALIDI<<AHMAD<MOHAMMED<<<<<<<<<<<<<<',
    'N1234567<1JOR9503127M3003110<<<<<<<<<<<<<<04',
  ].join('\n'),
};

// ── Case B: false-positive — filename + weak text only ────────
// Filename screams "passport"; text contains the bare word "passport"
// once but NO MRZ and NO labelled identity fields (no "Passport No:",
// no "Date of Birth:", no "Nationality:", no Arabic equivalents).
const CASE_B: Fixture = {
  label: 'B — false positive (filename says passport, no MRZ, weak text)',
  fileName: 'my_passport_application_form.pdf',
  mimeType: 'application/pdf',
  readability: 'readable',
  textContent: [
    'Application Form',
    'Please attach a copy of your passport with this form.',
    'Submission date: 2026-01-15',
    'Reference: APP-7781',
    'Notes: applicant should bring original documents.',
  ].join('\n'),
};

// ── Helpers ───────────────────────────────────────────────────

function runFixture(fx: Fixture): {
  classification: ReturnType<typeof classifyDocument>;
  mrz_found: boolean;
  lane_strength: string | null;
  extracted: Array<{ field: string; parser_source: string; confidence: number; value: string }>;
  proposals: Array<{
    field: string;
    status: ExtractionProposal['proposal_status'];
    auto_apply_candidate: boolean;
    confidence: number;
  }>;
  usefulness: 'useful' | 'unknown' | 'not_useful';
  readability: Fixture['readability'];
  evidence_summary: string;
} {
  // 1. Classify
  const classification = classifyDocument({
    fileName: fx.fileName,
    textContent: fx.textContent,
    mimeType: fx.mimeType,
  });

  // 2. Mirror engine passport-lane gating
  let extracted: Record<string, { value: any; parser_source: string; confidence: number }> = {};
  let mrz_found = false;
  const laneStrength = classification.passport_strength ?? null;

  if (classification.best === 'passport') {
    const mrz = parseMrz(fx.textContent);
    mrz_found = mrz.found;

    if (mrz.found) {
      const fields = extractPassportFields(mrz);
      for (const [k, v] of Object.entries(fields)) {
        extracted[k] = { value: v.value, parser_source: v.parser_source, confidence: v.confidence };
      }
    } else if (laneStrength === 'passport_strong') {
      const fields = extractPassportTextFallback(fx.textContent);
      for (const [k, v] of Object.entries(fields)) {
        extracted[k] = { value: v.value, parser_source: v.parser_source, confidence: v.confidence };
      }
    } else {
      // passport_weak + no MRZ ⇒ no extracted fields
      extracted = {};
    }
  }

  // 3. Usefulness (mirrors engine logic)
  const fieldCount = Object.keys(extracted).length;
  const passportWeakNoMrz =
    classification.best === 'passport' && laneStrength === 'passport_weak' && !mrz_found;

  let usefulness: 'useful' | 'unknown' | 'not_useful';
  if (classification.best === 'unsupported') usefulness = 'not_useful';
  else if (classification.best === 'unknown' && fieldCount === 0) usefulness = 'unknown';
  else if (passportWeakNoMrz) usefulness = 'unknown';
  else if (fieldCount > 0) usefulness = fx.readability === 'degraded' ? 'unknown' : 'useful';
  else usefulness = 'unknown';

  // 4. Build + promote proposals
  const proposals: Array<{
    field: string;
    status: ExtractionProposal['proposal_status'];
    auto_apply_candidate: boolean;
    confidence: number;
  }> = [];

  for (const [fieldKey, ex] of Object.entries(extracted)) {
    if (ex.value == null) continue;
    let proposal = createProposal({
      studentId: 'harness-student',
      documentId: 'harness-doc',
      fieldKey,
      proposedValue: String(ex.value),
      normalizedValue: String(ex.value).toLowerCase().trim(),
      confidence: ex.confidence,
      conflictWithCurrent: false,
    });
    proposal = applyPromotionRules(proposal, {
      readability: fx.readability,
      parser_source: ex.parser_source as any,
      lane_strength: classification.best === 'passport' ? laneStrength : null,
    });
    proposals.push({
      field: proposal.field_key,
      status: proposal.proposal_status,
      auto_apply_candidate: proposal.auto_apply_candidate,
      confidence: Number(proposal.confidence.toFixed(3)),
    });
  }

  const evidence_summary = [
    `mrz_pattern_in_text=${classification.passport_mrz_pattern_in_text}`,
    `passport_text_evidence=[${classification.passport_text_evidence.join(',')}]`,
    `lane_strength=${laneStrength}`,
    `mrz_found=${mrz_found}`,
  ].join(' | ');

  return {
    classification,
    mrz_found,
    lane_strength: laneStrength,
    extracted: Object.entries(extracted).map(([field, v]) => ({
      field,
      parser_source: v.parser_source,
      confidence: Number(v.confidence.toFixed(3)),
      value: String(v.value),
    })),
    proposals,
    usefulness,
    readability: fx.readability,
    evidence_summary,
  };
}

function printResult(label: string, r: ReturnType<typeof runFixture>) {
  console.log('\n────────────────────────────────────────────────────');
  console.log(`▶ ${label}`);
  console.log('────────────────────────────────────────────────────');
  console.log(JSON.stringify({
    classification_result: r.classification.best,
    classification_confidence: Number(r.classification.confidence.toFixed(3)),
    lane_strength: r.lane_strength,
    mrz_found: r.mrz_found,
    mrz_pattern_in_text: r.classification.passport_mrz_pattern_in_text,
    passport_text_evidence: r.classification.passport_text_evidence,
    extracted_fields: r.extracted,
    proposal_statuses: r.proposals,
    readability: r.readability,
    usefulness: r.usefulness,
    evidence_summary: r.evidence_summary,
  }, null, 2));
}

// ── Run ───────────────────────────────────────────────────────
const a = runFixture(CASE_A);
const b = runFixture(CASE_B);

printResult(CASE_A.label, a);
printResult(CASE_B.label, b);

// ── Assertions (fail loud if any gate breaks) ─────────────────
const failures: string[] = [];

// Case A expectations
if (a.classification.best !== 'passport')
  failures.push(`A: classification expected 'passport', got '${a.classification.best}'`);
if (a.lane_strength !== 'passport_strong')
  failures.push(`A: lane_strength expected 'passport_strong', got '${a.lane_strength}'`);
if (!a.mrz_found) failures.push('A: MRZ should have been found');
if (a.usefulness !== 'useful') failures.push(`A: usefulness expected 'useful', got '${a.usefulness}'`);
const aMrzFields = a.extracted.filter(e => e.parser_source === 'mrz');
if (aMrzFields.length === 0) failures.push('A: expected MRZ-sourced extracted fields');
const aIdentityProposals = a.proposals.filter(p => p.field.startsWith('identity.'));
const aAutoAccepted = aIdentityProposals.filter(p => p.status === 'auto_accepted');
if (aAutoAccepted.length === 0)
  failures.push('A: expected at least one identity.* auto_accepted (MRZ + readable + low-risk)');

// Case B expectations
if (b.classification.best === 'passport' && b.lane_strength !== 'passport_weak')
  failures.push(`B: when classified as passport, lane_strength must be 'passport_weak', got '${b.lane_strength}'`);
if (b.mrz_found) failures.push('B: MRZ must NOT be found');
if (b.extracted.length > 0 && b.classification.best === 'passport' && b.lane_strength === 'passport_weak')
  failures.push('B: passport_weak + no MRZ must yield ZERO extracted fields');
if (b.usefulness === 'useful')
  failures.push(`B: usefulness must NOT be 'useful' for passport_weak+no-MRZ, got '${b.usefulness}'`);
const bAutoAccepted = b.proposals.filter(p => p.status === 'auto_accepted');
if (bAutoAccepted.length > 0)
  failures.push(`B: must have ZERO auto_accepted proposals, got ${bAutoAccepted.length}`);

console.log('\n════════════════════════════════════════════════════');
if (failures.length === 0) {
  console.log('✅ HARNESS PASS — Cases A and B behave as required.');
  console.log('   (Case C — real degraded passport — still requires live preview proof.)');
  process.exit(0);
} else {
  console.log('❌ HARNESS FAIL');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
