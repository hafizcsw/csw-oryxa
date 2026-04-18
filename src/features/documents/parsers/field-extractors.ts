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
// Conservative-but-usable: every field requires an explicit nearby label
// (English / Arabic / French / Spanish). Bare numbers in OCR noise are
// NEVER promoted. Date patterns accept multiple separators (/ - . space)
// and DD/MMM/YYYY (e.g. "01 NOV 2018") commonly seen in passport scans.
export function extractPassportTextFallback(text: string): Fields {
  const f: Fields = {};
  if (!text || text.trim().length === 0) return f;
  const p: ParserType = 'regex_heuristic';
  const lowConf = 0.55; // capped well below AUTO_ACCEPT_THRESHOLD

  // Reusable date sub-pattern: DD[sep]MMM-or-MM[sep]YYYY  OR  YYYY-MM-DD
  const DATE = String.raw`(\d{1,2}[\s\/\-\.][0-9A-Za-z\u0600-\u06FF]{1,9}[\s\/\-\.]\d{2,4}|\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2})`;

  // ── Passport number (label-anchored; multi-language) ──────
  const numMatch = text.match(
    new RegExp(
      `(?:passport\\s*(?:no|number|n[°o]\\.?)|رقم\\s*(?:ال)?جواز|n[°o]\\s*de\\s*(?:passeport|pasaporte)|reisepass[\\s-]*nr|护照号码?)\\s*[:.]?\\s*([A-Z0-9]{6,12})`,
      'i',
    ),
  );
  if (numMatch) {
    f['identity.passport_number'] = field(numMatch[1].toUpperCase(), numMatch[0], lowConf, p, numMatch[0]);
  }

  // ── Surname / family name ─────────────────────────────────
  const surnameMatch = text.match(
    /(?:surname|family\s*name|last\s*name|nom(?:\s*de\s*famille)?|apellidos?|nachname|اللقب|الاسم\s*العائلي|اسم\s*العائلة)\s*[:.]?\s*([A-Z\u00C0-\u017F\u0600-\u06FF][A-Za-z\u00C0-\u017F\u0600-\u06FF\s\-']{1,40})/i,
  );
  if (surnameMatch) {
    const surname = surnameMatch[1].trim().replace(/\s{2,}/g, ' ');
    if (surname.length >= 2 && surname.length <= 40) {
      f['identity.passport_surname'] = field(surname, surnameMatch[0], lowConf, p, surnameMatch[0]);
    }
  }

  // ── Given names ───────────────────────────────────────────
  const givenMatch = text.match(
    /(?:given\s*names?|first\s*names?|fore[\s-]*names?|pr[ée]noms?|nombres?|vornamen?|الاسم(?:\s*الأول)?|الأسماء|الاسم\s*الكامل)\s*[:.]?\s*([A-Z\u00C0-\u017F\u0600-\u06FF][A-Za-z\u00C0-\u017F\u0600-\u06FF\s\-']{1,60})/i,
  );
  if (givenMatch) {
    const given = givenMatch[1].trim().replace(/\s{2,}/g, ' ');
    if (given.length >= 2 && given.length <= 60) {
      f['identity.passport_given_names'] = field(given, givenMatch[0], lowConf, p, givenMatch[0]);
    }
  }

  // ── Synthesize full passport name when both halves exist ──
  const surnameVal = f['identity.passport_surname']?.value as string | undefined;
  const givenVal = f['identity.passport_given_names']?.value as string | undefined;
  if (givenVal && surnameVal) {
    f['identity.passport_name'] = field(
      `${givenVal} ${surnameVal}`,
      `${givenMatch?.[0] ?? ''} | ${surnameMatch?.[0] ?? ''}`,
      lowConf,
      p,
      `synthesized: given+surname`,
    );
  } else if (givenVal || surnameVal) {
    // Single-half capture is still better than nothing.
    f['identity.passport_name'] = field(
      (givenVal ?? surnameVal)!,
      (givenMatch ?? surnameMatch)![0],
      lowConf - 0.1,
      p,
      'partial: one of (given|surname) only',
    );
  }

  // ── Date of birth (label-anchored) ────────────────────────
  const dobMatch = text.match(
    new RegExp(
      `(?:date\\s*of\\s*birth|d\\.?o\\.?b\\.?|birth\\s*date|تاريخ\\s*(?:ال)?ميلاد|date\\s*de\\s*naissance|fecha\\s*de\\s*nacimiento|geburtsdatum|出生日期)\\s*[:.]?\\s*${DATE}`,
      'i',
    ),
  );
  if (dobMatch) {
    f['identity.date_of_birth'] = field(dobMatch[1].trim(), dobMatch[0], lowConf, p, dobMatch[0]);
  }

  // ── Expiry date (label-anchored, layout-aware) ───────────
  // Bilingual passport layouts often print "Date of Issue  Date of Expiry"
  // with TWO dates following on the next line ("01/11/2018  31/10/2025").
  // A naive regex `expiry ... DATE` captures the FIRST date which is the
  // ISSUE date. We capture up to TWO dates after the expiry label and
  // prefer the LATER one (heuristic: expiry > issue).
  const expWindow = text.match(
    new RegExp(
      `(?:date\\s*of\\s*expiry|expiry(?:\\s*date)?|expires?(?:\\s*on)?|valid\\s*until|تاريخ\\s*(?:ال)?(?:انتهاء|الانتهاء|الإنتهاء)|date\\s*d[''']?expiration|fecha\\s*de\\s*caducidad|g[üu]ltig\\s*bis|有效期至)\\s*[:.]?\\s*${DATE}(?:[\\s\\S]{0,30}?${DATE})?`,
      'i',
    ),
  );
  if (expWindow) {
    const d1 = expWindow[1]?.trim();
    const d2 = expWindow[2]?.trim();
    const chosen = pickLaterDate(d1, d2) || d1;
    if (chosen) {
      f['identity.passport_expiry_date'] = field(chosen, expWindow[0], lowConf, p, expWindow[0]);
    }
  }

  // ── Issue date (label-anchored) ───────────────────────────
  // Symmetrical: capture two dates, prefer the EARLIER one as issue.
  const issueWindow = text.match(
    new RegExp(
      `(?:date\\s*of\\s*issue|issue\\s*date|issued\\s*on|date\\s*of\\s*delivery|تاريخ\\s*(?:ال)?(?:إصدار|الإصدار|الاصدار)|date\\s*de\\s*d[ée]livrance|fecha\\s*de\\s*expedici[óo]n|ausstellungsdatum|签发日期)\\s*[:.]?\\s*${DATE}(?:[\\s\\S]{0,30}?${DATE})?`,
      'i',
    ),
  );
  if (issueWindow) {
    const d1 = issueWindow[1]?.trim();
    const d2 = issueWindow[2]?.trim();
    const chosen = pickEarlierDate(d1, d2) || d1;
    if (chosen) {
      f['identity.passport_issue_date'] = field(chosen, issueWindow[0], lowConf, p, issueWindow[0]);
    }
  }

  // ── Sex / gender ──────────────────────────────────────────
  const genderMatch = text.match(
    /(?:sex|gender|sexe|sexo|geschlecht|الجنس|性别)\s*[:.]?\s*([MF]|male|female|masculin|f[ée]minin|masculino|femenino|m[äa]nnlich|weiblich|ذكر|أنثى)\b/i,
  );
  if (genderMatch) {
    const v = genderMatch[1].toUpperCase();
    const norm = v.startsWith('M') || v === 'MASCULIN' || v === 'MASCULINO' || v === 'MÄNNLICH' || v === 'MANNLICH' || v === 'ذكر' ? 'M'
              : v.startsWith('F') || v === 'WEIBLICH' || v === 'أنثى' ? 'F' : v;
    f['identity.gender'] = field(norm, genderMatch[0], lowConf, p, genderMatch[0]);
  }

  // ── Nationality (label-anchored, label-token guard) ──────
  // Bilingual passports print "Nationality  Sex" on one line and
  // "EGYPTIAN  M" on the next. The naive regex captured "Sex" as a
  // 3-letter alpha-3. We scan up to the next 80 chars for a value that
  // is NOT a known co-label (sex/gender/date/place/office/type/code).
  const natRe = new RegExp(
    `(?:nationality|nationalit[ée]|nacionalidad|staatsangeh[öo]rigkeit|الجنسية|国籍)\\s*[:.]?\\s*([\\s\\S]{1,80})`,
    'i',
  );
  const natRaw = text.match(natRe);
  if (natRaw) {
    const natValue = pickFirstNonLabelToken(natRaw[1]);
    if (natValue) {
      f['identity.citizenship'] = field(natValue, natRaw[0], lowConf, p, natRaw[0]);
    }
  }

  // ── Issuing country / authority (label-anchored) ──────────
  const issuingMatch = text.match(
    /(?:issuing\s*(?:authority|country|state|office)|country\s*of\s*issue|pays\s*[ée]metteur|pa[íi]s\s*(?:de\s*)?expedici[óo]n|ausstellender\s*staat|جهة\s*(?:ال)?[إا]صدار|بلد\s*(?:ال)?[إا]صدار|签发国家?)\s*[:.]?\s*([A-Z]{3}\b|[A-Za-z\u00C0-\u017F\u0600-\u06FF][A-Za-z\u00C0-\u017F\u0600-\u06FF\s\-]{2,40})/i,
  );
  if (issuingMatch) {
    f['identity.passport_issuing_country'] = field(issuingMatch[1].trim(), issuingMatch[0], lowConf, p, issuingMatch[0]);
  }

  // ── Place of birth (label-anchored, optional) ─────────────
  const pobMatch = text.match(
    /(?:place\s*of\s*birth|lieu\s*de\s*naissance|lugar\s*de\s*nacimiento|geburtsort|محل\s*(?:ال)?ميلاد|مكان\s*(?:ال)?ميلاد|出生地点?)\s*[:.]?\s*([A-Za-z\u00C0-\u017F\u0600-\u06FF][A-Za-z\u00C0-\u017F\u0600-\u06FF\s\-,]{2,60})/i,
  );
  if (pobMatch) {
    f['identity.place_of_birth'] = field(pobMatch[1].trim(), pobMatch[0], lowConf, p, pobMatch[0]);
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

// Words that look like 3-letter alpha codes but are actually CO-LABELS
// printed next to "Nationality" on bilingual passports. We must never
// promote these as the nationality value.
const PASSPORT_CO_LABELS = new Set([
  'sex', 'gender', 'date', 'place', 'office', 'type', 'code',
  'name', 'nom', 'no', 'num', 'dob', 'pob', 'doe', 'doi',
  'mrz', 'passport', 'country', 'nat', 'sig',
  'issue', 'expiry', 'expiration', 'birth', 'issuing', 'authority',
  'of', 'and', 'the', 'state', 'national',
]);

// Known nationality adjectives/demonyms commonly printed on passports.
// When a label-anchored window contains one of these (even fused with
// noise like "8EGYPTIAN"), we prefer it as the citizenship value.
const NATIONALITY_DEMONYMS = [
  'EGYPTIAN', 'SAUDI', 'EMIRATI', 'JORDANIAN', 'LEBANESE', 'SYRIAN',
  'IRAQI', 'PALESTINIAN', 'KUWAITI', 'QATARI', 'BAHRAINI', 'OMANI',
  'YEMENI', 'MOROCCAN', 'ALGERIAN', 'TUNISIAN', 'LIBYAN', 'SUDANESE',
  'AMERICAN', 'BRITISH', 'CANADIAN', 'AUSTRALIAN', 'GERMAN', 'FRENCH',
  'ITALIAN', 'SPANISH', 'TURKISH', 'INDIAN', 'PAKISTANI', 'CHINESE',
  'JAPANESE', 'KOREAN', 'RUSSIAN', 'BRAZILIAN', 'MEXICAN', 'NIGERIAN',
];

/**
 * Pick the first plausible value-token after a label, skipping over
 * known co-labels. Returns null if none found within window.
 *
 * Hardening: strips leading digits (OCR noise like "8EGYPTIAN" → "EGYPTIAN")
 * and prefers known nationality demonyms when present anywhere in window.
 */
function pickFirstNonLabelToken(window: string): string | null {
  if (!window) return null;

  // Priority 1: scan whole window for a known demonym (handles fused tokens)
  const upper = window.toUpperCase();
  for (const demonym of NATIONALITY_DEMONYMS) {
    if (upper.includes(demonym)) return demonym;
  }

  // Priority 2: token scan with digit-prefix stripping
  const tokens = window
    .split(/[\s:;,.\/\\|]+/)
    .map(t => t.trim().replace(/^\d+/, '')) // strip leading digits ("8EGYPTIAN" → "EGYPTIAN")
    .filter(t => t.length > 0);
  for (const tok of tokens) {
    if (PASSPORT_CO_LABELS.has(tok.toLowerCase())) continue;
    if (/^\d+$/.test(tok)) continue;
    if (tok.length < 2) continue;
    if (/^[A-Z]{3}$/.test(tok)) return tok;
    if (/^[A-Za-z\u00C0-\u017F\u0600-\u06FF][A-Za-z\u00C0-\u017F\u0600-\u06FF\-']{2,30}$/.test(tok)) {
      return tok;
    }
  }
  return null;
}

/** Parse loose date string → ms epoch (NaN if unparseable). */
function parseLooseDateMs(s: string | null | undefined): number {
  if (!s) return NaN;
  const t = s.trim();
  let m = t.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{1,2})[\s\/\-\.](\d{1,2})[\s\/\-\.](\d{2,4})$/);
  if (m) {
    const yr = +m[3] < 100 ? (+m[3] > 30 ? 1900 + +m[3] : 2000 + +m[3]) : +m[3];
    return Date.UTC(yr, +m[2] - 1, +m[1]);
  }
  m = t.match(/^(\d{1,2})[\s\/\-\.]([A-Za-z]{3,9})[\s\/\-\.](\d{2,4})$/);
  if (m) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
    };
    const idx = months[m[2].toLowerCase().slice(0, 3)];
    if (idx === undefined) return NaN;
    const yr = +m[3] < 100 ? (+m[3] > 30 ? 1900 + +m[3] : 2000 + +m[3]) : +m[3];
    return Date.UTC(yr, idx, +m[1]);
  }
  return NaN;
}

function pickLaterDate(a?: string, b?: string): string | null {
  const ma = parseLooseDateMs(a);
  const mb = parseLooseDateMs(b);
  if (!isNaN(ma) && !isNaN(mb)) return mb > ma ? (b ?? null) : (a ?? null);
  if (!isNaN(ma)) return a ?? null;
  if (!isNaN(mb)) return b ?? null;
  return null;
}

function pickEarlierDate(a?: string, b?: string): string | null {
  const ma = parseLooseDateMs(a);
  const mb = parseLooseDateMs(b);
  if (!isNaN(ma) && !isNaN(mb)) return ma < mb ? (a ?? null) : (b ?? null);
  if (!isNaN(ma)) return a ?? null;
  if (!isNaN(mb)) return b ?? null;
  return null;
}


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
