// ═══════════════════════════════════════════════════════════════
// Door 3 — Certificate Recovery V1
// ═══════════════════════════════════════════════════════════════
// Minimal truthful extraction from OCR text. Multilingual keyword based.
// Promotion: ≥3/5 fields with conf ≥0.6 → 'proposed'. Else 'needs_review'.
// Failure reason: certificate_insufficient_evidence
// ═══════════════════════════════════════════════════════════════

import type { OcrEvidence } from './door3-types.ts';
import type { CanonicalField, LaneKind } from './door3-lane-facts-writer.ts';
import { missingField } from './door3-lane-facts-writer.ts';

const INSTITUTION_RX =
  /(university|college|institute|academy|school of|جامعة|كلية|معهد|université|universidad|universität|大学)/i;

const DEGREE_RX =
  /(bachelor|master|m\.?sc|m\.?a\.?|b\.?sc|b\.?a\.?|ph\.?d|doctorate|diploma|degree|درجة|بكالوريوس|ماجستير|دكتوراه|دبلوم|licence|licenciatura|grado)/i;

const NAME_LABEL_RX =
  /(?:^|\s)(?:name|full name|student name|الاسم|اسم الطالب|nom|nombre|姓名)[:\s]+([\p{L}\p{M}\s.'-]{3,80})/iu;

const DATE_RX =
  /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i;

const CERT_TYPE_RX = [
  { rx: /transcript|كشف درجات|relevé/i, type: 'transcript' },
  { rx: /diploma|دبلوم/i, type: 'diploma' },
  { rx: /graduation|تخرج|graduación|abschluss/i, type: 'graduation' },
  { rx: /attendance|حضور/i, type: 'attendance' },
  { rx: /degree|شهادة|certificate/i, type: 'degree' },
];

export interface CertificateRecoveryResult {
  lane: LaneKind;                 // always 'graduation_lane'
  facts: Record<string, CanonicalField>;
  required: string[];
  notes: string[];
  review_reason: string | null;
}

export function recoverCertificate(ev: OcrEvidence): CertificateRecoveryResult {
  const text = ev.pages.map((p) => p.raw_text ?? '').join('\n');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const required = ['student_name', 'institution_name', 'degree_title', 'issue_date', 'certificate_type'];
  const facts: Record<string, CanonicalField> = Object.fromEntries(
    required.map((k) => [k, missingField('door3-certificate-recovery-v1')]),
  );

  // student_name
  const nameMatch = text.match(NAME_LABEL_RX);
  if (nameMatch?.[1]) {
    facts.student_name = {
      value: nameMatch[1].trim(),
      confidence: 0.7, source: 'label_match', status: 'proposed', raw: nameMatch[0],
    };
  }

  // institution_name — first line containing institution keyword
  const instLine = lines.find((l) => INSTITUTION_RX.test(l));
  if (instLine) {
    facts.institution_name = {
      value: instLine.slice(0, 200), confidence: 0.7, source: 'keyword_line', status: 'proposed', raw: instLine,
    };
  }

  // degree_title
  const degLine = lines.find((l) => DEGREE_RX.test(l));
  if (degLine) {
    facts.degree_title = {
      value: degLine.slice(0, 200), confidence: 0.65, source: 'keyword_line', status: 'proposed', raw: degLine,
    };
  }

  // issue_date — first date occurrence
  const dateMatch = text.match(DATE_RX);
  if (dateMatch?.[1]) {
    facts.issue_date = {
      value: dateMatch[1], confidence: 0.6, source: 'regex_date', status: 'proposed', raw: dateMatch[0],
    };
  }

  // certificate_type
  for (const { rx, type } of CERT_TYPE_RX) {
    if (rx.test(text)) {
      facts.certificate_type = {
        value: type, confidence: 0.75, source: 'classifier', status: 'proposed', raw: type,
      };
      break;
    }
  }

  const filled = required.filter((k) => facts[k].value !== null && facts[k].confidence >= 0.6).length;
  const review_reason = filled >= 3 ? null : 'certificate_insufficient_evidence';

  return {
    lane: 'graduation_lane',
    facts,
    required,
    notes: [`fields_filled:${filled}/${required.length}`],
    review_reason,
  };
}
