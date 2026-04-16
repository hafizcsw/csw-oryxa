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

  return f;
}

// ── Graduation certificate fields from text ──────────────────
export function extractGraduationFields(text: string): Fields {
  const f: Fields = {};

  // Credential type (check first — used to build credential name)
  const typePatterns = [
    /\b(bachelor(?:'?s)?)\b/i,
    /\b(master(?:'?s)?)\b/i,
    /\b(ph\.?d|doctorate)\b/i,
    /\b(diploma)\b/i,
    /\b(associate)\b/i,
    /\b(بكالوريوس)\b/i,
    /\b(ماجستير)\b/i,
    /\b(دكتوراه)\b/i,
    /\b(دبلوم)\b/i,
  ];
  for (const tp of typePatterns) {
    const m = text.match(tp);
    if (m) {
      f['academic.credential_type'] = field(m[1].toLowerCase(), m[0], 0.8, 'regex_heuristic', m[0]);
      break;
    }
  }

  // Degree/credential name — English patterns
  const degreePatterns = [
    /(?:degree|diploma|certificate)\s*(?:of|in|:)\s*([^\n,]{3,60})/i,
    /(?:bachelor|master)(?:'?s)?\s*(?:of|in|degree\s+in)\s*([^\n,]{3,80})/i,
    /awarded\s*(?:the\s*)?(?:degree\s*(?:of|in)\s*)?([^\n,]{3,60})/i,
  ];
  // Arabic patterns for credential name
  const degreeArabicPatterns = [
    /شهادة\s*(?:ال)?(?:بكالوريوس|ماجستير|دكتوراه|دبلوم)\s*(?:في|ب)?\s*([^\n,]{3,60})/i,
    /(?:تخصص|قسم)\s*:?\s*([^\n,]{3,60})/i,
    /درجة\s*(?:ال)?(?:بكالوريوس|ماجستير)\s*(?:في|ب)?\s*([^\n,]{3,60})/i,
  ];
  for (const dp of [...degreePatterns, ...degreeArabicPatterns]) {
    const m = text.match(dp);
    if (m) {
      f['academic.credential_name'] = field(m[1].trim(), m[0], 0.7, 'regex_heuristic', m[0]);
      break;
    }
  }

  // Institution — English
  const uniPatterns = [
    /(?:university|college|institute|institution)\s*(?:of|:)?\s*([^\n,]{3,80})/i,
  ];
  // Institution — Arabic
  const uniArabicPatterns = [
    /جامعة\s+([^\n,]{3,80})/i,
    /كلية\s+([^\n,]{3,80})/i,
    /معهد\s+([^\n,]{3,80})/i,
  ];
  for (const up of [...uniPatterns, ...uniArabicPatterns]) {
    const m = text.match(up);
    if (m) {
      f['academic.awarding_institution'] = field(m[1].trim(), m[0], 0.7, 'regex_heuristic', m[0]);
      break;
    }
  }

  // Graduation year
  const yearPatterns = [
    /(?:graduated?|conferred|awarded|class\s+of)\s*:?\s*(\d{4})/i,
    /(?:عام|سنة|دفعة)\s*:?\s*(\d{4})/i,
    /(\d{4})\s*(?:م|ميلادي)/i,  // 2020م or 2020 ميلادي
    /\b(20[0-2]\d|19[89]\d)\b/,   // fallback: any recent year
  ];
  for (const yp of yearPatterns) {
    const m = text.match(yp);
    if (m) {
      f['academic.graduation_year'] = field(parseInt(m[1]), m[0], 0.7, 'regex_heuristic', m[0]);
      break;
    }
  }

  // Grade/GPA
  const gpaPatterns = [
    /(?:gpa|grade|cgpa|cumulative)\s*:?\s*([0-9]+\.?[0-9]*)\s*(?:\/|out\s*of)?\s*([0-9]+\.?[0-9]*)?/i,
    /(?:معدل|التقدير|بتقدير)\s*:?\s*([^\n,]{2,30})/i,
    /(?:المعدل\s*التراكمي)\s*:?\s*([0-9]+\.?[0-9]*)\s*(?:من)?\s*([0-9]+\.?[0-9]*)?/i,
  ];
  for (const gp of gpaPatterns) {
    const m = text.match(gp);
    if (m) {
      f['academic.gpa_raw'] = field(m[1], m[0], 0.75, 'regex_heuristic', m[0]);
      if (m[2]) f['academic.grading_scale'] = field(m[2], m[0], 0.7, 'regex_heuristic', m[0]);
      break;
    }
  }

  return f;
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
