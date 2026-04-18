// ═══════════════════════════════════════════════════════════════
// Field Extractors — Door 3: Extract canonical fields from text
// ═══════════════════════════════════════════════════════════════
// Regex-based extraction for each document type.
// No external LLM. Returns ExtractedField records.
// ═══════════════════════════════════════════════════════════════

import type { ExtractedField, ParserType } from '../document-analysis-model';
import type { MrzResult } from './mrz-parser';

type Fields = Record<string, ExtractedField>;

function field(
  value: string | number | null,
  raw: string | null,
  confidence: number,
  parser: ParserType = 'regex_heuristic',
  evidence: string | null = null,
): ExtractedField {
  return { value, raw_text: raw, confidence, parser_source: parser, evidence_snippet: evidence };
}

// ── Passport fields from MRZ ─────────────────────────────────
export function extractPassportFields(mrz: MrzResult): Fields {
  if (!mrz.found) return {};
  const f: Fields = {};
  const p: ParserType = 'mrz';

  const fullName = [mrz.given_names, mrz.surname].filter(Boolean).join(' ');
  if (fullName) f['identity.passport_name'] = field(fullName, mrz.raw_mrz, mrz.confidence, p, mrz.raw_mrz);
  if (mrz.passport_number) f['identity.passport_number'] = field(mrz.passport_number, mrz.raw_mrz, mrz.confidence, p, mrz.raw_mrz);
  if (mrz.nationality) f['identity.citizenship'] = field(mrz.nationality, mrz.raw_mrz, mrz.confidence, p, mrz.raw_mrz);
  if (mrz.date_of_birth) f['identity.date_of_birth'] = field(mrz.date_of_birth, mrz.raw_mrz, mrz.confidence, p, mrz.raw_mrz);
  if (mrz.gender) f['identity.gender'] = field(mrz.gender, mrz.raw_mrz, mrz.confidence, p, mrz.raw_mrz);
  if (mrz.expiry_date) f['identity.passport_expiry_date'] = field(mrz.expiry_date, mrz.raw_mrz, mrz.confidence, p, mrz.raw_mrz);
  if (mrz.issuing_country) f['identity.passport_issuing_country'] = field(mrz.issuing_country, mrz.raw_mrz, mrz.confidence, p, mrz.raw_mrz);

  // Derive issue date from expiry (MRZ does NOT encode issue date).
  // Standard validity: 10 years for adults, 5 years for minors (<16 at issue).
  // Tagged as 'regex_heuristic' with lower confidence so the promotion layer
  // keeps it as pending_review (never auto-accepted) — student/staff confirms.
  if (mrz.expiry_date && mrz.date_of_birth) {
    const derived = deriveIssueDateFromExpiry(mrz.expiry_date, mrz.date_of_birth);
    if (derived) {
      f['identity.passport_issue_date'] = field(
        derived,
        mrz.raw_mrz,
        0.55,
        'regex_heuristic',
        `derived from expiry ${mrz.expiry_date} − typical validity`,
      );
    }
  }

  return f;
}

/**
 * Derive passport issue date from expiry + DOB.
 * Standard validity: 10 years (adult) or 5 years (minor <16 at issue).
 * Returns YYYY-MM-DD or null if unparseable.
 */
function deriveIssueDateFromExpiry(expiryYmd: string, dobYmd: string): string | null {
  const exp = new Date(expiryYmd);
  const dob = new Date(dobYmd);
  if (isNaN(exp.getTime()) || isNaN(dob.getTime())) return null;

  // Probe 10-year validity first
  const probe = new Date(exp);
  probe.setFullYear(exp.getFullYear() - 10);
  const ageAtIssue10 = probe.getFullYear() - dob.getFullYear();
  const validityYears = ageAtIssue10 < 16 ? 5 : 10;

  const issue = new Date(exp);
  issue.setFullYear(exp.getFullYear() - validityYears);

  const yyyy = issue.getFullYear();
  const mm = String(issue.getMonth() + 1).padStart(2, '0');
  const dd = String(issue.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── Passport TEXT FALLBACK (NO MRZ) ───────────────────────────
// Used only when MRZ is absent. Returns weak-evidence fields tagged
// 'regex_heuristic' so the promotion layer can refuse auto-accept.
//
// IMPORTANT: this lane is intentionally conservative. It must NOT
// produce identity fields without an explicit nearby label — bare
// numbers / bare names in arbitrary OCR noise are NOT enough.
export function extractPassportTextFallback(text: string): Fields {
  const f: Fields = {};
  if (!text || text.trim().length === 0) return f;
  const p: ParserType = 'regex_heuristic';
  const lowConf = 0.45; // capped well below AUTO_ACCEPT_THRESHOLD

  // Passport number (must be near explicit label)
  const numMatch = text.match(
    /(?:passport\s*(?:no|number|n[°o]\.?)|رقم\s*(?:ال)?جواز)\s*:?\s*([A-Z0-9]{6,12})/i,
  );
  if (numMatch) {
    f['identity.passport_number'] = field(numMatch[1].toUpperCase(), numMatch[0], lowConf, p, numMatch[0]);
  }

  // Date of birth (must be near explicit label)
  const dobMatch = text.match(
    /(?:date\s*of\s*birth|d\.?o\.?b\.?|تاريخ\s*الميلاد)\s*:?\s*([0-9]{1,2}[\s\/\-\.][0-9A-Za-z]{1,9}[\s\/\-\.][0-9]{2,4}|\d{4}[\-\/]\d{2}[\-\/]\d{2})/i,
  );
  if (dobMatch) {
    f['identity.date_of_birth'] = field(dobMatch[1].trim(), dobMatch[0], lowConf, p, dobMatch[0]);
  }

  // Expiry date (must be near explicit label)
  const expMatch = text.match(
    /(?:date\s*of\s*expiry|expiry|expires?|تاريخ\s*الانتهاء)\s*:?\s*([0-9]{1,2}[\s\/\-\.][0-9A-Za-z]{1,9}[\s\/\-\.][0-9]{2,4}|\d{4}[\-\/]\d{2}[\-\/]\d{2})/i,
  );
  if (expMatch) {
    f['identity.passport_expiry_date'] = field(expMatch[1].trim(), expMatch[0], lowConf, p, expMatch[0]);
  }

  // Issue date (must be near explicit label)
  const issueMatch = text.match(
    /(?:date\s*of\s*issue|issue\s*date|issued\s*on|تاريخ\s*(?:ال)?(?:إصدار|الإصدار|الاصدار))\s*:?\s*([0-9]{1,2}[\s\/\-\.][0-9A-Za-z]{1,9}[\s\/\-\.][0-9]{2,4}|\d{4}[\-\/]\d{2}[\-\/]\d{2})/i,
  );
  if (issueMatch) {
    f['identity.passport_issue_date'] = field(issueMatch[1].trim(), issueMatch[0], lowConf, p, issueMatch[0]);
  }

  // Gender (must be near explicit label)
  const genderMatch = text.match(/(?:sex|gender|الجنس)\s*:?\s*([MFmf])\b/);
  if (genderMatch) {
    const v = genderMatch[1].toUpperCase();
    f['identity.gender'] = field(v, genderMatch[0], lowConf, p, genderMatch[0]);
  }

  // Nationality (must be near explicit label)
  const natMatch = text.match(/(?:nationality|الجنسية)\s*:?\s*([A-Z]{3}|[A-Za-z\u0600-\u06FF\s]{3,40})/);
  if (natMatch) {
    f['identity.citizenship'] = field(natMatch[1].trim(), natMatch[0], lowConf, p, natMatch[0]);
  }

  return f;
}

// ── Graduation certificate fields from text ──────────────────
//
// Engine v2 — robust to noisy OCR, mixed AR/EN, varied layouts.
// All fields stay below AUTO_ACCEPT_THRESHOLD (0.85) — graduation lane
// is review-first per HONESTY GATE 4. Confidence reflects pattern quality.
export function extractGraduationFields(text: string): Fields {
  const f: Fields = {};
  // Normalize: collapse whitespace, unify Arabic digits, strip tatweel
  const norm = normalizeForExtraction(text);

  // ─── Credential type ──────────────────────────────────────
  const typePatterns: Array<{ re: RegExp; canonical: string }> = [
    { re: /\b(ph\.?\s*d|doctorate|doctoral)\b/i, canonical: 'phd' },
    { re: /\bدكتوراه\b/, canonical: 'phd' },
    { re: /\b(master(?:'?s)?|m\.?\s*sc|m\.?\s*a|mba)\b/i, canonical: 'master' },
    { re: /\bماجستير\b/, canonical: 'master' },
    { re: /\b(bachelor(?:'?s)?|b\.?\s*sc|b\.?\s*a|b\.?\s*eng|undergraduate)\b/i, canonical: 'bachelor' },
    { re: /\bبكالوريوس\b/, canonical: 'bachelor' },
    { re: /\b(higher\s*diploma|advanced\s*diploma)\b/i, canonical: 'higher_diploma' },
    { re: /\b(diploma)\b/i, canonical: 'diploma' },
    { re: /\bدبلوم\b/, canonical: 'diploma' },
    { re: /\b(associate)\b/i, canonical: 'associate' },
  ];
  for (const { re, canonical } of typePatterns) {
    const m = norm.match(re);
    if (m) {
      f['academic.credential_type'] = field(canonical, m[0], 0.8, 'regex_heuristic', m[0]);
      break;
    }
  }

  // ─── Credential / program name ────────────────────────────
  const degreePatterns: RegExp[] = [
    /(?:degree|diploma|certificate)\s*(?:of|in|:)\s*([^\n,;]{3,80})/i,
    /(?:bachelor|master|doctorate)(?:'?s)?\s*(?:of|in|degree\s+in)\s*([^\n,;]{3,80})/i,
    /awarded\s*(?:the\s*)?(?:degree\s*(?:of|in)\s*)?([^\n,;]{3,80})/i,
    /major(?:\s*in)?\s*:?\s*([^\n,;]{3,80})/i,
    /field\s*of\s*study\s*:?\s*([^\n,;]{3,80})/i,
    /شهادة\s*(?:ال)?(?:بكالوريوس|ماجستير|دكتوراه|دبلوم)\s*(?:في|ب)?\s*([^\n,;]{3,80})/i,
    /درجة\s*(?:ال)?(?:بكالوريوس|ماجستير|دكتوراه)\s*(?:في|ب)?\s*([^\n,;]{3,80})/i,
    /(?:التخصص|تخصص|القسم|قسم)\s*:?\s*([^\n,;]{3,80})/i,
  ];
  for (const dp of degreePatterns) {
    const m = norm.match(dp);
    if (m && m[1]) {
      const cleaned = cleanFieldValue(m[1]);
      if (cleaned.length >= 3) {
        f['academic.credential_name'] = field(cleaned, m[0], 0.72, 'regex_heuristic', m[0]);
        break;
      }
    }
  }

  // ─── Institution ──────────────────────────────────────────
  const uniPatterns: RegExp[] = [
    // English: capture name AFTER "University of X" OR before "University"
    /([A-Z][A-Za-z\u00C0-\u017F\.\s&'\-]{2,60})\s+university\b/i,
    /\buniversity\s+of\s+([A-Z][A-Za-z\u00C0-\u017F\.\s&'\-]{2,60})/i,
    /\b(?:university|college|institute|academy|school)\s*(?:of|:)?\s*([^\n,;]{3,80})/i,
    /جامعة\s+([^\n,;]{3,80})/,
    /كلية\s+([^\n,;]{3,80})/,
    /معهد\s+([^\n,;]{3,80})/,
    /أكاديمية\s+([^\n,;]{3,80})/,
  ];
  for (const up of uniPatterns) {
    const m = norm.match(up);
    if (m && m[1]) {
      const cleaned = cleanFieldValue(m[1]);
      if (cleaned.length >= 3) {
        f['academic.awarding_institution'] = field(cleaned, m[0], 0.72, 'regex_heuristic', m[0]);
        break;
      }
    }
  }

  // ─── Graduation year ──────────────────────────────────────
  const yearPatterns: Array<{ re: RegExp; conf: number }> = [
    { re: /(?:graduated?|conferred|awarded|granted|class\s+of|completed)\s*(?:on|in)?\s*:?\s*(?:[A-Za-z]+\s+)?(\d{4})/i, conf: 0.8 },
    { re: /(?:تخرج|تخرّج|التخرج|منحت?|بتاريخ)\s*(?:في|عام|سنة)?\s*:?\s*(?:[\u0600-\u06FF]+\s+)?(\d{4})/, conf: 0.8 },
    { re: /(?:عام|سنة|دفعة)\s*:?\s*(\d{4})/, conf: 0.7 },
    { re: /(\d{4})\s*(?:م|ميلادي|ميلادية)/, conf: 0.7 },
    { re: /(?:date\s*of\s*(?:graduation|award|conferral))\s*:?\s*(?:\d{1,2}[\s\/\-\.][A-Za-z\d]{1,9}[\s\/\-\.])?(\d{4})/i, conf: 0.8 },
    { re: /\b(20[0-3]\d|19[7-9]\d)\b/, conf: 0.45 }, // fallback: any plausible year
  ];
  for (const { re, conf } of yearPatterns) {
    const m = norm.match(re);
    if (m) {
      const yr = parseInt(m[1], 10);
      if (yr >= 1970 && yr <= new Date().getFullYear() + 1) {
        f['academic.graduation_year'] = field(yr, m[0], conf, 'regex_heuristic', m[0]);
        break;
      }
    }
  }

  // ─── GPA + scale (multi-format) ───────────────────────────
  const gpa = extractGpaWithScale(norm);
  if (gpa) {
    f['academic.gpa_raw'] = field(gpa.raw, gpa.evidence, gpa.confidence, 'regex_heuristic', gpa.evidence);
    if (gpa.scale != null) {
      f['academic.grading_scale'] = field(String(gpa.scale), gpa.evidence, gpa.confidence - 0.05, 'regex_heuristic', gpa.evidence);
    }
  }

  // ─── Honors / classification (تقدير) ──────────────────────
  const honor = extractHonor(norm);
  if (honor) {
    f['academic.honors'] = field(honor.canonical, honor.evidence, honor.confidence, 'regex_heuristic', honor.evidence);
  }

  // ─── Certificate / serial number ──────────────────────────
  const certNumMatch = norm.match(
    /(?:certificate\s*(?:no|number|n[°o]\.?)|serial\s*(?:no|number)|رقم\s*(?:ال)?شهادة|الرقم\s*التسلسلي)\s*:?\s*([A-Z0-9\-\/]{4,30})/i,
  );
  if (certNumMatch) {
    f['academic.certificate_number'] = field(certNumMatch[1], certNumMatch[0], 0.7, 'regex_heuristic', certNumMatch[0]);
  }

  return f;
}

// ─── Helpers ─────────────────────────────────────────────────

function normalizeForExtraction(input: string): string {
  if (!input) return '';
  // Convert Arabic-Indic digits to ASCII digits
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let out = input.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
  // Strip tatweel
  out = out.replace(/\u0640/g, '');
  // Collapse runs of whitespace but preserve newlines
  out = out.replace(/[ \t]+/g, ' ');
  return out;
}

function cleanFieldValue(v: string): string {
  return v
    .replace(/\s+/g, ' ')
    .replace(/[\.\-_:;،,]+$/g, '')
    .replace(/^[\.\-_:;،,]+/g, '')
    .trim();
}

interface GpaResult {
  raw: string;
  scale: number | null;
  confidence: number;
  evidence: string;
}

function extractGpaWithScale(text: string): GpaResult | null {
  // Pattern 1: explicit "GPA: X / Y" or "X out of Y"
  const explicit = text.match(
    /(?:cgpa|gpa|cumulative\s*(?:gpa|average)|grade\s*point\s*average|المعدل\s*(?:التراكمي|العام)?|معدل)\s*:?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:\/|out\s*of|من|على)\s*([0-9]+(?:\.[0-9]+)?)/i,
  );
  if (explicit) {
    const val = parseFloat(explicit[1]);
    const scale = parseFloat(explicit[2]);
    if (isPlausibleGpa(val, scale)) {
      return { raw: explicit[1], scale, confidence: 0.85, evidence: explicit[0] };
    }
  }

  // Pattern 2: "GPA: X" with no scale — infer from value range
  const noScale = text.match(
    /(?:cgpa|gpa|cumulative\s*(?:gpa|average)|grade\s*point\s*average|المعدل\s*(?:التراكمي|العام)?)\s*:?\s*([0-9]+(?:\.[0-9]+)?)\b/i,
  );
  if (noScale) {
    const val = parseFloat(noScale[1]);
    const inferred = inferScale(val);
    if (inferred) {
      return { raw: noScale[1], scale: inferred, confidence: 0.7, evidence: noScale[0] };
    }
  }

  // Pattern 3: percentage "نسبة 85.5%" or "Average 85.5%"
  const pct = text.match(
    /(?:percentage|average|النسبة\s*المئوية|النسبة)\s*:?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i,
  );
  if (pct) {
    return { raw: pct[1], scale: 100, confidence: 0.8, evidence: pct[0] };
  }

  return null;
}

function isPlausibleGpa(val: number, scale: number): boolean {
  if (!Number.isFinite(val) || !Number.isFinite(scale)) return false;
  if (![4, 5, 10, 100].includes(scale)) return false;
  return val >= 0 && val <= scale;
}

function inferScale(val: number): number | null {
  if (val > 0 && val <= 4) return 4;
  if (val > 4 && val <= 5) return 5;
  if (val > 5 && val <= 10) return 10;
  if (val > 10 && val <= 100) return 100;
  return null;
}

function extractHonor(text: string): { canonical: string; confidence: number; evidence: string } | null {
  const honors: Array<{ re: RegExp; canonical: string }> = [
    { re: /summa\s*cum\s*laude/i, canonical: 'summa_cum_laude' },
    { re: /magna\s*cum\s*laude/i, canonical: 'magna_cum_laude' },
    { re: /cum\s*laude/i, canonical: 'cum_laude' },
    { re: /first\s*class\s*(?:honou?rs)?/i, canonical: 'first_class' },
    { re: /second\s*class\s*(?:honou?rs)?\s*(?:upper)?/i, canonical: 'second_class_upper' },
    { re: /(?:with\s*)?distinction/i, canonical: 'distinction' },
    { re: /(?:with\s*)?honou?rs/i, canonical: 'honors' },
    { re: /ممتاز\s*مع\s*مرتبة\s*الشرف/, canonical: 'excellent_with_honors' },
    { re: /مرتبة\s*الشرف/, canonical: 'with_honors' },
    { re: /امتياز/, canonical: 'excellent' },
    { re: /ممتاز/, canonical: 'excellent' },
    { re: /جيد\s*جدا?ً?/, canonical: 'very_good' },
    { re: /جيد/, canonical: 'good' },
    { re: /مقبول/, canonical: 'pass' },
  ];
  for (const { re, canonical } of honors) {
    const m = text.match(re);
    if (m) return { canonical, confidence: 0.75, evidence: m[0] };
  }
  return null;
}

// ── Transcript fields from text ──────────────────────────────
export function extractTranscriptFields(text: string): Fields {
  const f: Fields = {};

  // Institution
  const uniMatch = text.match(/(?:university|جامعة|college|institute)\s*(?:of|:)?\s*([^\n,]{3,80})/i);
  if (uniMatch) f['academic.institution_name'] = field(uniMatch[1].trim(), uniMatch[0], 0.7, 'regex_heuristic', uniMatch[0]);

  // Program name
  const progMatch = text.match(/(?:program|major|specialization|تخصص|faculty)\s*:?\s*([^\n,]{3,60})/i);
  if (progMatch) f['academic.credential_name'] = field(progMatch[1].trim(), progMatch[0], 0.6, 'regex_heuristic', progMatch[0]);

  // GPA
  const gpaMatch = text.match(/(?:gpa|cgpa|cumulative|معدل)\s*:?\s*([0-9]+\.?[0-9]*)\s*(?:\/|out\s*of)?\s*([0-9]+\.?[0-9]*)?/i);
  if (gpaMatch) {
    f['academic.gpa_raw'] = field(gpaMatch[1], gpaMatch[0], 0.8, 'regex_heuristic', gpaMatch[0]);
    if (gpaMatch[2]) f['academic.grading_scale'] = field(gpaMatch[2], gpaMatch[0], 0.7, 'regex_heuristic', gpaMatch[0]);
  }

  // Study status
  const statusMatch = text.match(/\b(graduated|enrolled|completed|withdrawn|dismissed)\b/i);
  if (statusMatch) f['academic.credential_type'] = field(statusMatch[1].toLowerCase(), statusMatch[0], 0.6, 'regex_heuristic', statusMatch[0]);

  return f;
}

// ── Language certificate fields from text ─────────────────────
export function extractLanguageCertFields(text: string): Fields {
  const f: Fields = {};

  // Test type
  const testTypeMatch = text.match(/\b(ielts|toefl|duolingo|pte\s*academic?)\b/i);
  if (testTypeMatch) {
    const normalized = testTypeMatch[1].toLowerCase().replace(/\s+/g, '_');
    f['language.english_test_type'] = field(normalized, testTypeMatch[0], 0.95, 'regex_heuristic', testTypeMatch[0]);
  }

  // Overall/total score
  const overallMatch = text.match(/(?:overall|total|band)\s*(?:score|band)?\s*:?\s*([0-9]+\.?[0-9]*)/i);
  if (overallMatch) f['language.english_total_score'] = field(parseFloat(overallMatch[1]), overallMatch[0], 0.9, 'regex_heuristic', overallMatch[0]);

  // Sub-scores
  const listeningMatch = text.match(/listening\s*:?\s*([0-9]+\.?[0-9]*)/i);
  if (listeningMatch) f['language.english_listening_score'] = field(parseFloat(listeningMatch[1]), listeningMatch[0], 0.85, 'regex_heuristic', listeningMatch[0]);

  const readingMatch = text.match(/reading\s*:?\s*([0-9]+\.?[0-9]*)/i);
  if (readingMatch) f['language.english_reading_score'] = field(parseFloat(readingMatch[1]), readingMatch[0], 0.85, 'regex_heuristic', readingMatch[0]);

  const writingMatch = text.match(/writing\s*:?\s*([0-9]+\.?[0-9]*)/i);
  if (writingMatch) f['language.english_writing_score'] = field(parseFloat(writingMatch[1]), writingMatch[0], 0.85, 'regex_heuristic', writingMatch[0]);

  const speakingMatch = text.match(/speaking\s*:?\s*([0-9]+\.?[0-9]*)/i);
  if (speakingMatch) f['language.english_speaking_score'] = field(parseFloat(speakingMatch[1]), speakingMatch[0], 0.85, 'regex_heuristic', speakingMatch[0]);

  // Test date
  const dateMatch = text.match(/(?:test|exam)\s*date\s*:?\s*(\d{1,2}[\s\/\-\.]\w{3,9}[\s\/\-\.]\d{2,4}|\d{4}[\-\/]\d{2}[\-\/]\d{2})/i);
  if (dateMatch) f['language.english_test_date'] = field(dateMatch[1], dateMatch[0], 0.7, 'regex_heuristic', dateMatch[0]);

  // Expiry date
  const expiryMatch = text.match(/(?:valid\s*until|expiry|expires?)\s*:?\s*(\d{1,2}[\s\/\-\.]\w{3,9}[\s\/\-\.]\d{2,4}|\d{4}[\-\/]\d{2}[\-\/]\d{2})/i);
  if (expiryMatch) f['language.english_expiry_date'] = field(expiryMatch[1], expiryMatch[0], 0.7, 'regex_heuristic', expiryMatch[0]);

  return f;
}
