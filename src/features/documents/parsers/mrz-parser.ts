// ═══════════════════════════════════════════════════════════════
// MRZ Parser — ICAO 9303 (TD1, TD2, TD3) with check-digit verify
// ═══════════════════════════════════════════════════════════════
// Pure regex + arithmetic. No external LLM. Covers ~all passports
// in the ICAO 9303 standard:
//   • TD3 — 2 lines × 44 chars (modern passports — most common)
//   • TD2 — 2 lines × 36 chars (older passports, some IDs)
//   • TD1 — 3 lines × 30 chars (ID cards, some passports)
//
// Check-digit algorithm: ICAO 9303 weighted (7-3-1) over [0-9A-Z<].
// Validates passport_number, DOB, expiry, and TD3 composite digit.
// ═══════════════════════════════════════════════════════════════

import { lookupCountry } from './iso-country-codes';

export interface MrzChecksumBreakdown {
  passport_number: boolean | null;
  date_of_birth: boolean | null;
  expiry_date: boolean | null;
  composite: boolean | null;
}

export interface MrzResult {
  found: boolean;
  format: 'TD1' | 'TD2' | 'TD3' | null;
  raw_mrz: string | null;             // legacy: full MRZ joined
  raw_mrz_line1: string | null;
  raw_mrz_line2: string | null;
  raw_mrz_line3: string | null;       // TD1 only
  document_type: string | null;       // 'P', 'PD', 'PS', 'I', 'IA', etc.
  surname: string | null;
  given_names: string | null;
  passport_number: string | null;
  nationality: string | null;         // human name (English) or alpha-2 fallback
  nationality_alpha3: string | null;
  date_of_birth: string | null;       // YYYY-MM-DD
  gender: string | null;              // 'M' | 'F' | 'X'
  expiry_date: string | null;         // YYYY-MM-DD
  issuing_country: string | null;     // human name (English) or alpha-2 fallback
  issuing_country_alpha3: string | null;
  confidence: number;                 // 0.0 – 1.0
  checksum_verified: boolean;         // true ⟺ ALL applicable digits passed
  checksum_breakdown: MrzChecksumBreakdown;
}

// ── ICAO 9303 check digit ────────────────────────────────────
const CHAR_VALUE: Record<string, number> = (() => {
  const m: Record<string, number> = { '<': 0 };
  for (let i = 0; i < 10; i++) m[String(i)] = i;
  for (let i = 0; i < 26; i++) m[String.fromCharCode(65 + i)] = i + 10;
  return m;
})();
const WEIGHTS = [7, 3, 1];

function computeCheckDigit(field: string): number {
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const v = CHAR_VALUE[field[i]];
    if (v === undefined) return -1;
    sum += v * WEIGHTS[i % 3];
  }
  return sum % 10;
}

function verifyCheck(field: string, expectedChar: string): boolean | null {
  if (!expectedChar || !/^\d$/.test(expectedChar)) return null;
  const computed = computeCheckDigit(field);
  if (computed < 0) return null;
  return computed === parseInt(expectedChar, 10);
}

// ── Helpers ──────────────────────────────────────────────────
function cleanMrz(text: string): string {
  return text.replace(/[^A-Z0-9<]/g, '');
}

function parseMrzDate(s: string): string | null {
  if (!/^\d{6}$/.test(s)) return null;
  const yy = parseInt(s.slice(0, 2), 10);
  const mm = s.slice(2, 4);
  const dd = s.slice(4, 6);
  if (parseInt(mm, 10) < 1 || parseInt(mm, 10) > 12) return null;
  if (parseInt(dd, 10) < 1 || parseInt(dd, 10) > 31) return null;
  const century = yy > 30 ? '19' : '20';
  return `${century}${s.slice(0, 2)}-${mm}-${dd}`;
}

function parseName(field: string): { surname: string | null; given_names: string | null } {
  const parts = field.split('<<');
  const surname = (parts[0] || '').replace(/</g, ' ').trim() || null;
  const given = (parts[1] || '').replace(/</g, ' ').trim() || null;
  return { surname, given_names: given };
}

function normalizeGender(c: string): string | null {
  if (c === 'M' || c === 'F') return c;
  if (c === '<' || c === ' ' || c === '') return null;
  return 'X';
}

// ── Empty result ─────────────────────────────────────────────
function emptyResult(): MrzResult {
  return {
    found: false, format: null,
    raw_mrz: null, raw_mrz_line1: null, raw_mrz_line2: null, raw_mrz_line3: null,
    document_type: null, surname: null, given_names: null, passport_number: null,
    nationality: null, nationality_alpha3: null, date_of_birth: null, gender: null,
    expiry_date: null, issuing_country: null, issuing_country_alpha3: null,
    confidence: 0, checksum_verified: false,
    checksum_breakdown: { passport_number: null, date_of_birth: null, expiry_date: null, composite: null },
  };
}

function resolveCountry(alpha3: string): { name: string | null; alpha3: string | null } {
  const code = alpha3.replace(/</g, '').toUpperCase();
  if (!code) return { name: null, alpha3: null };
  const c = lookupCountry(code);
  return { name: c?.name_en ?? code, alpha3: code };
}

// ── TD3 — passport (2×44) ────────────────────────────────────
function parseTD3(line1: string, line2: string): MrzResult | null {
  if (line1.length < 44 || line2.length < 44) return null;
  if (!/^P[A-Z<]/.test(line1)) return null;

  const documentType = line1.slice(0, 2).replace(/</g, '');
  const issuing = resolveCountry(line1.slice(2, 5));
  const { surname, given_names } = parseName(line1.slice(5, 44));

  const passportNumberField = line2.slice(0, 9);
  const passportCheck = line2.slice(9, 10);
  const nationality = resolveCountry(line2.slice(10, 13));
  const dobField = line2.slice(13, 19);
  const dobCheck = line2.slice(19, 20);
  const genderChar = line2.slice(20, 21);
  const expiryField = line2.slice(21, 27);
  const expiryCheck = line2.slice(27, 28);
  const personalNumber = line2.slice(28, 42);
  const personalCheck = line2.slice(42, 43);
  const compositeCheck = line2.slice(43, 44);

  const checksum: MrzChecksumBreakdown = {
    passport_number: verifyCheck(passportNumberField, passportCheck),
    date_of_birth: verifyCheck(dobField, dobCheck),
    expiry_date: verifyCheck(expiryField, expiryCheck),
    composite: verifyCheck(
      passportNumberField + passportCheck + dobField + dobCheck + expiryField + expiryCheck + personalNumber + personalCheck,
      compositeCheck,
    ),
  };

  const allVerified =
    checksum.passport_number === true &&
    checksum.date_of_birth === true &&
    checksum.expiry_date === true &&
    checksum.composite === true;

  const result: MrzResult = {
    found: true,
    format: 'TD3',
    raw_mrz: `${line1}\n${line2}`,
    raw_mrz_line1: line1,
    raw_mrz_line2: line2,
    raw_mrz_line3: null,
    document_type: documentType || 'P',
    surname,
    given_names,
    passport_number: passportNumberField.replace(/</g, '') || null,
    nationality: nationality.name,
    nationality_alpha3: nationality.alpha3,
    date_of_birth: parseMrzDate(dobField),
    gender: normalizeGender(genderChar),
    expiry_date: parseMrzDate(expiryField),
    issuing_country: issuing.name,
    issuing_country_alpha3: issuing.alpha3,
    confidence: 0,
    checksum_verified: allVerified,
    checksum_breakdown: checksum,
  };

  result.confidence = scoreConfidence(result);
  return result;
}

// ── TD2 — older passports / IDs (2×36) ───────────────────────
function parseTD2(line1: string, line2: string): MrzResult | null {
  if (line1.length < 36 || line2.length < 36) return null;
  if (!/^[PI][A-Z<]/.test(line1)) return null;

  const documentType = line1.slice(0, 2).replace(/</g, '');
  const issuing = resolveCountry(line1.slice(2, 5));
  const { surname, given_names } = parseName(line1.slice(5, 36));

  const passportNumberField = line2.slice(0, 9);
  const passportCheck = line2.slice(9, 10);
  const nationality = resolveCountry(line2.slice(10, 13));
  const dobField = line2.slice(13, 19);
  const dobCheck = line2.slice(19, 20);
  const genderChar = line2.slice(20, 21);
  const expiryField = line2.slice(21, 27);
  const expiryCheck = line2.slice(27, 28);
  const optional = line2.slice(28, 35);
  const compositeCheck = line2.slice(35, 36);

  const checksum: MrzChecksumBreakdown = {
    passport_number: verifyCheck(passportNumberField, passportCheck),
    date_of_birth: verifyCheck(dobField, dobCheck),
    expiry_date: verifyCheck(expiryField, expiryCheck),
    composite: verifyCheck(
      passportNumberField + passportCheck + dobField + dobCheck + expiryField + expiryCheck + optional,
      compositeCheck,
    ),
  };

  const allVerified =
    checksum.passport_number === true &&
    checksum.date_of_birth === true &&
    checksum.expiry_date === true &&
    checksum.composite === true;

  const result: MrzResult = {
    found: true,
    format: 'TD2',
    raw_mrz: `${line1}\n${line2}`,
    raw_mrz_line1: line1,
    raw_mrz_line2: line2,
    raw_mrz_line3: null,
    document_type: documentType || 'P',
    surname,
    given_names,
    passport_number: passportNumberField.replace(/</g, '') || null,
    nationality: nationality.name,
    nationality_alpha3: nationality.alpha3,
    date_of_birth: parseMrzDate(dobField),
    gender: normalizeGender(genderChar),
    expiry_date: parseMrzDate(expiryField),
    issuing_country: issuing.name,
    issuing_country_alpha3: issuing.alpha3,
    confidence: 0,
    checksum_verified: allVerified,
    checksum_breakdown: checksum,
  };
  result.confidence = scoreConfidence(result);
  return result;
}

// ── TD1 — ID cards / some passports (3×30) ───────────────────
function parseTD1(line1: string, line2: string, line3: string): MrzResult | null {
  if (line1.length < 30 || line2.length < 30 || line3.length < 30) return null;
  if (!/^[IAC][A-Z<]/.test(line1)) return null;

  const documentType = line1.slice(0, 2).replace(/</g, '');
  const issuing = resolveCountry(line1.slice(2, 5));
  const passportNumberField = line1.slice(5, 14);
  const passportCheck = line1.slice(14, 15);
  // line1 [15,30] = optional data 1

  const dobField = line2.slice(0, 6);
  const dobCheck = line2.slice(6, 7);
  const genderChar = line2.slice(7, 8);
  const expiryField = line2.slice(8, 14);
  const expiryCheck = line2.slice(14, 15);
  const nationality = resolveCountry(line2.slice(15, 18));
  // line2 [18,29] optional data 2
  const compositeCheck = line2.slice(29, 30);

  const { surname, given_names } = parseName(line3.slice(0, 30));

  const checksum: MrzChecksumBreakdown = {
    passport_number: verifyCheck(passportNumberField, passportCheck),
    date_of_birth: verifyCheck(dobField, dobCheck),
    expiry_date: verifyCheck(expiryField, expiryCheck),
    composite: verifyCheck(
      line1.slice(5, 30) + line2.slice(0, 7) + line2.slice(8, 15) + line2.slice(18, 29),
      compositeCheck,
    ),
  };

  const allVerified =
    checksum.passport_number === true &&
    checksum.date_of_birth === true &&
    checksum.expiry_date === true &&
    checksum.composite === true;

  const result: MrzResult = {
    found: true,
    format: 'TD1',
    raw_mrz: `${line1}\n${line2}\n${line3}`,
    raw_mrz_line1: line1,
    raw_mrz_line2: line2,
    raw_mrz_line3: line3,
    document_type: documentType || 'I',
    surname,
    given_names,
    passport_number: passportNumberField.replace(/</g, '') || null,
    nationality: nationality.name,
    nationality_alpha3: nationality.alpha3,
    date_of_birth: parseMrzDate(dobField),
    gender: normalizeGender(genderChar),
    expiry_date: parseMrzDate(expiryField),
    issuing_country: issuing.name,
    issuing_country_alpha3: issuing.alpha3,
    confidence: 0,
    checksum_verified: allVerified,
    checksum_breakdown: checksum,
  };
  result.confidence = scoreConfidence(result);
  return result;
}

// ── Confidence scoring ───────────────────────────────────────
function scoreConfidence(r: MrzResult): number {
  let fields = 0, total = 8;
  if (r.surname) fields++;
  if (r.given_names) fields++;
  if (r.passport_number && r.passport_number.length >= 5) fields++;
  if (r.nationality_alpha3) fields++;
  if (r.date_of_birth) fields++;
  if (r.gender) fields++;
  if (r.expiry_date) fields++;
  if (r.issuing_country_alpha3) fields++;

  const fieldScore = fields / total;

  // Checksum bonus: each verified digit adds 0.05; full 4/4 → +0.20.
  const cb = r.checksum_breakdown;
  const verifiedCount =
    (cb.passport_number === true ? 1 : 0) +
    (cb.date_of_birth === true ? 1 : 0) +
    (cb.expiry_date === true ? 1 : 0) +
    (cb.composite === true ? 1 : 0);
  const checksumBonus = verifiedCount * 0.05;

  return Math.min(fieldScore * 0.8 + checksumBonus, 1.0);
}

// ── Orchestrator ─────────────────────────────────────────────
/**
 * Try all MRZ formats in order: TD3 → TD2 → TD1.
 * Returns the first successful parse, or empty result.
 *
 * Acceptance gate: a parse is considered successful only if it
 * produces at least passport_number, DOB, and expiry. Pure regex
 * shape match without those critical fields is rejected.
 */
export function parseMrz(text: string): MrzResult {
  if (!text || text.length < 30) return emptyResult();

  const rawLines = text.split(/\n|\r/).map(l => l.trim()).filter(l => l.length >= 20);
  // Cleaned lines, preserving order. Each line stripped to [A-Z0-9<].
  const cleaned = rawLines.map(cleanMrz).filter(l => l.length >= 28);

  const isViable = (r: MrzResult | null): r is MrzResult =>
    !!r && !!r.passport_number && !!r.date_of_birth && !!r.expiry_date;

  /**
   * Locate a TD3-style document line within a cleaned string.
   * Returns the 44-char window starting at the doc-type marker, or null.
   * MRZ may have leading OCR noise — we scan for the canonical pattern.
   */
  const findTD3Line1 = (s: string): string | null => {
    if (s.length < 44) return null;
    const m = s.match(/[PI][A-Z<][A-Z<]{3}/);
    if (!m || m.index === undefined) return null;
    if (m.index + 44 > s.length) {
      // Tail too short — pad with '<' (filler) so check digits over surname zone still work
      const window = s.slice(m.index).padEnd(44, '<');
      return window.length >= 44 ? window.slice(0, 44) : null;
    }
    return s.slice(m.index, m.index + 44);
  };

  const findTD3Line2 = (s: string): string | null => {
    if (s.length < 44) return null;
    // line 2 is mostly alnum + '<'; pick the longest such window
    return s.slice(0, 44);
  };

  // ── TD3 attempt (2 × 44) ───────────────────────────────────
  for (let i = 0; i < cleaned.length; i++) {
    const l1 = findTD3Line1(cleaned[i]);
    if (!l1) continue;
    for (let j = i + 1; j < cleaned.length; j++) {
      const l2 = findTD3Line2(cleaned[j]);
      if (!l2) continue;
      const r = parseTD3(l1, l2);
      if (isViable(r)) return r;
      break;
    }
  }

  // ── TD2 attempt (2 × 36) ───────────────────────────────────
  for (let i = 0; i < cleaned.length - 1; i++) {
    if (cleaned[i].length >= 36 && cleaned[i].length < 44) {
      const m = cleaned[i].match(/[PI][A-Z<][A-Z<]{3}/);
      if (!m || m.index === undefined) continue;
      const l1 = cleaned[i].slice(m.index, m.index + 36);
      if (l1.length < 36) continue;
      for (let j = i + 1; j < cleaned.length; j++) {
        if (cleaned[j].length >= 36 && cleaned[j].length < 44) {
          const l2 = cleaned[j].slice(0, 36);
          const r = parseTD2(l1, l2);
          if (isViable(r)) return r;
          break;
        }
      }
    }
  }

  // ── TD1 attempt (3 × 30) ───────────────────────────────────
  for (let i = 0; i < cleaned.length - 2; i++) {
    if (cleaned[i].length >= 30 && cleaned[i].length < 36) {
      const m = cleaned[i].match(/[IAC][A-Z<][A-Z<]{3}/);
      if (!m || m.index === undefined) continue;
      const l1 = cleaned[i].slice(m.index, m.index + 30);
      const l2 = cleaned[i + 1]?.length >= 30 ? cleaned[i + 1].slice(0, 30) : null;
      const l3 = cleaned[i + 2]?.length >= 30 ? cleaned[i + 2].slice(0, 30) : null;
      if (l1.length === 30 && l2 && l3) {
        const r = parseTD1(l1, l2, l3);
        if (isViable(r)) return r;
      }
    }
  }

  return emptyResult();
}
