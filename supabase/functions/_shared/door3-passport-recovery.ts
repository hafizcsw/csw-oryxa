// ═══════════════════════════════════════════════════════════════
// Door 3 — Passport Recovery V1 (TD3-only, OCR-text based)
// ═══════════════════════════════════════════════════════════════
// Reads OCR evidence text, attempts ICAO 9303 TD3 MRZ recovery.
// V1 SCOPE: TD3 only. TD1/TD2 explicitly deferred → needs_review.
// Failure reasons (machine-readable):
//   - mrz_td3_not_found
//   - unsupported_mrz_format_v1   (TD1/TD2 detected)
//   - ocr_text_not_passport_like
//   - mrz_td3_checksum_failed
// ═══════════════════════════════════════════════════════════════

import type { OcrEvidence } from './door3-types.ts';
import type { CanonicalField, LaneKind } from './door3-lane-facts-writer.ts';
import { missingField } from './door3-lane-facts-writer.ts';

const PASSPORT_HINTS = [
  'passport', 'passeport', 'pasaporte', 'reisepass', 'паспорт', '护照',
  'جواز', 'جواز سفر',
];

export interface PassportRecoveryResult {
  lane: LaneKind;                 // always 'passport_lane'
  facts: Record<string, CanonicalField>;
  required: string[];
  notes: string[];
  review_reason: string | null;   // null on success
}

// MRZ alphabet check: A-Z, 0-9, '<'
const MRZ_CHAR = /^[A-Z0-9<]+$/;

function checksum(s: string): number {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let v = 0;
    if (c >= '0' && c <= '9') v = c.charCodeAt(0) - 48;
    else if (c >= 'A' && c <= 'Z') v = c.charCodeAt(0) - 55;
    else if (c === '<') v = 0;
    else return -1;
    sum += v * w[i % 3];
  }
  return sum % 10;
}

function looksPassport(text: string): boolean {
  const lc = text.toLowerCase();
  return PASSPORT_HINTS.some((h) => lc.includes(h));
}

function detectUnsupportedMrz(lines: string[]): boolean {
  // TD1 = 3×30, TD2 = 2×36
  const cleaned = lines.map((l) => l.replace(/\s+/g, '')).filter((l) => MRZ_CHAR.test(l) && l.length >= 30);
  if (cleaned.length >= 3 && cleaned.slice(0, 3).every((l) => l.length === 30)) return true; // TD1
  if (cleaned.length >= 2 && cleaned.slice(0, 2).every((l) => l.length === 36)) return true; // TD2
  return false;
}

function findTd3(lines: string[]): { l1: string; l2: string } | null {
  const cleaned = lines.map((l) => l.replace(/\s+/g, '')).filter((l) => MRZ_CHAR.test(l) && l.length === 44);
  for (let i = 0; i < cleaned.length - 1; i++) {
    if (cleaned[i].startsWith('P') && cleaned[i + 1].length === 44) {
      return { l1: cleaned[i], l2: cleaned[i + 1] };
    }
  }
  return null;
}

function fmtYYMMDD(s: string): string | null {
  if (!/^\d{6}$/.test(s)) return null;
  return `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
}

export function recoverPassport(ev: OcrEvidence): PassportRecoveryResult {
  const allText = ev.pages.map((p) => p.raw_text ?? '').join('\n');
  const allLines = allText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const required = [
    'full_name', 'passport_number', 'nationality',
    'date_of_birth', 'expiry_date', 'issuing_country', 'sex', 'mrz_present',
  ];
  const facts: Record<string, CanonicalField> = Object.fromEntries(
    required.map((k) => [k, missingField('door3-passport-recovery-v1')]),
  );

  // Default mrz_present = false (truthful until proven otherwise)
  facts.mrz_present = { value: 'false', confidence: 1, source: 'door3-passport-recovery-v1', status: 'extracted' };

  if (!looksPassport(allText)) {
    return {
      lane: 'passport_lane', facts, required,
      notes: ['ocr_text_not_passport_like'],
      review_reason: 'ocr_text_not_passport_like',
    };
  }

  if (detectUnsupportedMrz(allLines)) {
    return {
      lane: 'passport_lane', facts, required,
      notes: ['unsupported_mrz_format_v1 (TD1/TD2 not handled in V1)'],
      review_reason: 'unsupported_mrz_format_v1',
    };
  }

  const td3 = findTd3(allLines);
  if (!td3) {
    return {
      lane: 'passport_lane', facts, required,
      notes: ['mrz_td3_not_found'],
      review_reason: 'mrz_td3_not_found',
    };
  }

  const { l1, l2 } = td3;

  // Line 1: P<XXXSURNAME<<GIVEN<NAMES<<<<<...
  const issuing_country_raw = l1.slice(2, 5);
  const namePart = l1.slice(5);
  const [surnameRaw, givenRaw = ''] = namePart.split('<<');
  const surname = surnameRaw.replace(/</g, ' ').trim();
  const given_names = givenRaw.replace(/</g, ' ').trim();

  // Line 2 fields
  const passport_number_raw = l2.slice(0, 9);
  const passport_number_check = l2.slice(9, 10);
  const nationality_raw = l2.slice(10, 13);
  const dob_raw = l2.slice(13, 19);
  const dob_check = l2.slice(19, 20);
  const gender_raw = l2.slice(20, 21);
  const expiry_raw = l2.slice(21, 27);
  const expiry_check = l2.slice(27, 28);

  const c1 = checksum(passport_number_raw) === parseInt(passport_number_check, 10);
  const c2 = checksum(dob_raw) === parseInt(dob_check, 10);
  const c3 = checksum(expiry_raw) === parseInt(expiry_check, 10);

  const allOk = c1 && c2 && c3;
  const baseConf = allOk ? 0.92 : 0.55;

  const src = 'mrz_td3';
  const fullName = (given_names || surname)
    ? `${given_names} ${surname}`.replace(/\s+/g, ' ').trim()
    : null;
  const baseStatus: 'extracted' | 'needs_review' = allOk && fullName ? 'extracted' : 'needs_review';

  facts.full_name        = { value: fullName, confidence: fullName ? baseConf : 0.3, source: src, status: baseStatus, raw: `${surnameRaw}<<${givenRaw}` };
  facts.passport_number  = { value: passport_number_raw.replace(/</g, ''), confidence: c1 ? 0.95 : 0.5, source: src, status: c1 ? 'extracted' : 'needs_review', raw: passport_number_raw };
  facts.nationality      = { value: nationality_raw.replace(/</g, '') || null, confidence: 0.9, source: src, status: 'extracted', raw: nationality_raw };
  facts.date_of_birth    = { value: fmtYYMMDD(dob_raw), confidence: c2 ? 0.95 : 0.5, source: src, status: c2 ? 'extracted' : 'needs_review', raw: dob_raw };
  facts.expiry_date      = { value: fmtYYMMDD(expiry_raw), confidence: c3 ? 0.95 : 0.5, source: src, status: c3 ? 'extracted' : 'needs_review', raw: expiry_raw };
  facts.issuing_country  = { value: issuing_country_raw.replace(/</g, '') || null, confidence: 0.9, source: src, status: 'extracted', raw: issuing_country_raw };
  facts.sex              = { value: gender_raw === '<' ? null : gender_raw, confidence: 0.9, source: src, status: gender_raw === '<' ? 'needs_review' : 'extracted', raw: gender_raw };
  facts.mrz_present      = { value: 'true', confidence: 1, source: src, status: 'extracted' };

  return {
    lane: 'passport_lane',
    facts,
    required,
    notes: [
      `mrz_td3_found`,
      `checksum_passport_number:${c1}`,
      `checksum_dob:${c2}`,
      `checksum_expiry:${c3}`,
      `provenance_surname:${surname}`,
      `provenance_given_names:${given_names}`,
    ],
    review_reason: allOk ? null : 'mrz_td3_checksum_failed',
  };
}
