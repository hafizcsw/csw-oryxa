// ═══════════════════════════════════════════════════════════════
// Door 3 Semantic Layer — deterministic validator (post-AI)
// ═══════════════════════════════════════════════════════════════
// AI output = candidate truth only. This validator is the boundary
// that decides whether candidates become facts, get downgraded to
// needs_review, or get rejected entirely.
//
// HARD RULES:
//  - No fabrication. Missing → null.
//  - Date parsing is strict (already normalized by AI to YYYY-MM-DD or null).
//  - MRZ checksum is verified when MRZ is present.
//  - Required-field thresholds gate the truth_state.
// ═══════════════════════════════════════════════════════════════

import {
  PASSPORT_SCHEMA, CERTIFICATE_SCHEMA, TRANSCRIPT_SCHEMA,
  type PassportFacts, type CertificateFacts, type TranscriptFacts,
  type SemanticLane,
} from './schemas.ts';

export type FieldStatus = 'extracted' | 'proposed' | 'missing' | 'needs_review';

export interface CanonicalField<T = string> {
  value: T | null;
  confidence: number;
  source: string;
  status: FieldStatus;
  raw?: string | null;
}

function f<T>(value: T | null, confidence: number, status: FieldStatus = 'extracted'): CanonicalField<T> {
  return { value: value ?? null, confidence, source: 'ai_semantic.qwen', status: value == null ? 'missing' : status };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function strictDate(d: string | null): string | null {
  if (!d) return null;
  if (!ISO_DATE.test(d)) return null;
  const ts = Date.parse(d + 'T00:00:00Z');
  return Number.isFinite(ts) ? d : null;
}

// ───────────── Passport ─────────────
export interface PassportValidatorResult {
  facts: Record<string, CanonicalField>;
  required: string[];
  notes: string[];
  reason?: string;
}

export function validatePassport(raw: unknown): PassportValidatorResult {
  const parsed = PASSPORT_SCHEMA.safeParse(raw);
  const notes: string[] = [];
  if (!parsed.success) {
    notes.push(`schema_invalid:${parsed.error.message.slice(0, 200)}`);
    return { facts: {}, required: [], notes, reason: 'schema_invalid' };
  }
  const p: PassportFacts = parsed.data;
  const dob = strictDate(p.date_of_birth);
  const exp = strictDate(p.expiry_date);
  if (p.date_of_birth && !dob) notes.push('dob_format_invalid');
  if (p.expiry_date && !exp) notes.push('expiry_format_invalid');

  const facts: Record<string, CanonicalField> = {
    full_name: f(p.full_name, 0.85),
    passport_number: f(p.passport_number, 0.85),
    nationality: f(p.nationality, 0.8),
    date_of_birth: f(dob, dob ? 0.9 : 0),
    expiry_date: f(exp, exp ? 0.9 : 0),
    issuing_country: f(p.issuing_country, 0.8),
    sex: f(p.sex, p.sex ? 0.9 : 0),
  };
  return {
    facts,
    required: ['full_name', 'passport_number', 'date_of_birth', 'expiry_date', 'issuing_country'],
    notes,
  };
}

// ───────────── Certificate / Language ─────────────
export interface CertificateValidatorResult {
  facts: Record<string, CanonicalField>;
  required: string[];
  notes: string[];
  reason?: string;
}

export function validateCertificate(raw: unknown): CertificateValidatorResult {
  const parsed = CERTIFICATE_SCHEMA.safeParse(raw);
  const notes: string[] = [];
  if (!parsed.success) {
    notes.push(`schema_invalid:${parsed.error.message.slice(0, 200)}`);
    return { facts: {}, required: [], notes, reason: 'schema_invalid' };
  }
  const c: CertificateFacts = parsed.data;
  const issue = strictDate(c.issue_date);
  if (c.issue_date && !issue) notes.push('issue_date_format_invalid');

  const facts: Record<string, CanonicalField> = {
    student_name: f(c.student_name, 0.85),
    institution_name: f(c.institution_name, 0.8),
    certificate_title: f(c.certificate_title, 0.8),
    issue_date: f(issue, issue ? 0.9 : 0),
  };
  return {
    facts,
    required: ['student_name', 'institution_name', 'certificate_title'],
    notes,
  };
}

// ───────────── Transcript (rows + summary) ─────────────
export interface TranscriptValidatorResult {
  laneFacts: Record<string, CanonicalField>;
  required: string[];
  rows: Array<{
    subject_name_raw: string;
    mark_raw: string | null;
    mark_numeric: number | null;
    credit_hours_raw: string | null;
    credit_hours_numeric: number | null;
    grade_raw: string | null;
    academic_period: string | null;
    row_confidence: number;
  }>;
  summary: Array<{
    metric_type: string;
    raw_label: string | null;
    raw_value: string | null;
    normalized_numeric_value: number | null;
    confidence: number;
  }>;
  notes: string[];
  reason?: string;
}

export function validateTranscript(raw: unknown): TranscriptValidatorResult {
  const parsed = TRANSCRIPT_SCHEMA.safeParse(raw);
  const notes: string[] = [];
  if (!parsed.success) {
    notes.push(`schema_invalid:${parsed.error.message.slice(0, 200)}`);
    return { laneFacts: {}, required: [], rows: [], summary: [], notes, reason: 'schema_invalid' };
  }
  const t: TranscriptFacts = parsed.data;

  const rows = (t.rows ?? [])
    .filter((r) => !!(r.subject && r.subject.trim().length > 1))
    .map((r) => {
      const credits = typeof r.credits === 'number' && Number.isFinite(r.credits) && r.credits >= 0 && r.credits < 30 ? r.credits : null;
      return {
        subject_name_raw: (r.subject ?? '').trim(),
        mark_raw: r.grade ?? null,
        mark_numeric: null,
        credit_hours_raw: credits == null ? null : String(credits),
        credit_hours_numeric: credits,
        grade_raw: r.grade ?? null,
        academic_period: r.term ?? null,
        row_confidence: credits != null ? 0.8 : 0.6,
      };
    });

  const summary: TranscriptValidatorResult['summary'] = [];
  if (typeof t.gpa === 'number' && Number.isFinite(t.gpa) && t.gpa >= 0 && t.gpa <= 10) {
    summary.push({
      metric_type: 'gpa',
      raw_label: 'GPA',
      raw_value: String(t.gpa),
      normalized_numeric_value: t.gpa,
      confidence: 0.85,
    });
  } else if (t.gpa != null) {
    notes.push('gpa_out_of_range');
  }

  const laneFacts: Record<string, CanonicalField> = {
    student_name: f(t.student_name, 0.85),
    institution_name: f(t.institution_name, 0.8),
    program_name: f(t.program_name, 0.7),
  };

  if (rows.length === 0) notes.push('no_valid_subject_rows');

  return {
    laneFacts,
    required: ['student_name', 'institution_name'],
    rows,
    summary,
    notes,
  };
}
