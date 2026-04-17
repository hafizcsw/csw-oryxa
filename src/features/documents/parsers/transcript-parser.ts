// ═══════════════════════════════════════════════════════════════
// Transcript Parser — Order 2: Truthful partial extraction
// ═══════════════════════════════════════════════════════════════
// Produces:
//   1. TranscriptIntermediate — local analysis-layer structure
//   2. ExtractedField map for the engine (header fields only)
//
// Honesty contract:
//   - No invention. If grade not found near subject → row.grade_raw = null
//     and 'grade' added to missing_columns.
//   - Partial coverage is reported, not hidden.
//   - GPA scale = null unless explicit text-side evidence.
//   - Header fields are tagged 'regex_heuristic'. Engine + promotion
//     layer will refuse auto-accept (HONESTY GATE 3).
//
// Non-goals (per Order 2 scope):
//   - graduation_date is NOT a primary target.
//   - No canonical schema change. Rows live in intermediate only.
// ═══════════════════════════════════════════════════════════════

import type { ExtractedField, ParserType } from '../document-analysis-model';
import {
  type TranscriptIntermediate,
  type TranscriptRow,
  type TranscriptDisambiguationSignals,
  emptyIntermediate,
} from './transcript-structure';
import type { StructuredDocumentArtifact } from '../structured-browser-artifact-model';

type Fields = Record<string, ExtractedField>;
const PARSER: ParserType = 'regex_heuristic';
// Cap header confidence below AUTO_ACCEPT_THRESHOLD (0.85) so the
// promotion layer cannot accidentally auto-accept transcript fields.
// HONESTY GATE 3 also enforces this independently.
const HEADER_CONFIDENCE = 0.55;

function fld(value: string | number | null, raw: string, confidence: number): ExtractedField {
  return {
    value,
    raw_text: raw,
    confidence,
    parser_source: PARSER,
    evidence_snippet: raw,
  };
}

// ── Disambiguation signals (used by classifier; multi-signal, NOT tabular-only) ──

const TRANSCRIPT_VOCAB_RE = [
  /\btranscript\b/i,
  /\bacademic\s*record\b/i,
  /\bmark\s*sheet\b/i,
  /\bstatement\s*of\s*marks\b/i,
  /كشف\s*(?:ال)?درجات/i,
  /سجل\s*أكاديمي/i,
  /إفادة\s*درجات/i,
];

const GPA_SIGNAL_RE = [
  /\bcgpa\b/i,
  /\bcumulative\b/i,
  /\bgpa\b/i,
  /\bsemester\s*(?:gpa|average)\b/i,
  /المعدل\s*التراكمي/i,
  /المعدل\s*الفصلي/i,
];

const CREDIT_SIGNAL_RE = [
  /\bcredit\s*hours?\b/i,
  /\bcr\.?\s*hr/i,
  /\bunits?\b/i,
  /\bECTS\b/,
  /ساعات?\s*معتمدة/i,
];

const LETTER_GRADE_TOKEN_RE = /\b[A-DF][+\-]?\b/;
const PERCENT_TOKEN_RE = /\b\d{2,3}(?:\.\d+)?\s*%/;
const FRACTION_GRADE_RE = /\b\d{1,3}(?:\.\d+)?\s*\/\s*(?:100|10|5|4(?:\.0+)?)\b/;
const COURSE_CODE_RE = /\b[A-Z]{2,4}\s?\d{2,4}[A-Z]?\b/;

export function computeTranscriptSignals(text: string): TranscriptDisambiguationSignals {
  const vocabulary_hits: string[] = [];
  for (const re of TRANSCRIPT_VOCAB_RE) {
    const m = text.match(re);
    if (m) vocabulary_hits.push(m[0]);
  }
  const gpa_signals: string[] = [];
  for (const re of GPA_SIGNAL_RE) {
    const m = text.match(re);
    if (m) gpa_signals.push(m[0]);
  }
  let credit_pattern_hits = 0;
  for (const re of CREDIT_SIGNAL_RE) {
    const m = text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
    if (m) credit_pattern_hits += m.length;
  }

  const lines = text.split(/\r?\n/);
  let grade_pattern_hits = 0;
  let row_like_lines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 8) continue;
    const hasGrade =
      LETTER_GRADE_TOKEN_RE.test(trimmed) ||
      PERCENT_TOKEN_RE.test(trimmed) ||
      FRACTION_GRADE_RE.test(trimmed);
    if (hasGrade) grade_pattern_hits++;
    // Row-like: has a course-code OR a long subject-ish prefix AND a grade-ish token.
    const looksRow =
      hasGrade && (COURSE_CODE_RE.test(trimmed) || /[A-Za-z\u0600-\u06FF]{4,}.+?\s{2,}/.test(trimmed));
    if (looksRow) row_like_lines++;
  }

  return {
    vocabulary_hits,
    gpa_signals,
    grade_pattern_hits,
    credit_pattern_hits,
    row_like_lines,
  };
}

// ── Header field extraction (truthful, conservative) ─────────────

function extractInstitution(text: string): { value: string; raw: string; confidence: number } | null {
  const patterns: RegExp[] = [
    /(?:university\s+of\s+[^\n,]{2,60})/i,
    /([A-Z][A-Za-z&\.\-\s]{3,60}\s+university)\b/,
    /\b(جامعة\s+[^\n,]{2,60})/,
    /\b(كلية\s+[^\n,]{2,60})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const value = (m[1] ?? m[0]).trim().replace(/\s+/g, ' ');
      return { value, raw: m[0], confidence: HEADER_CONFIDENCE };
    }
  }
  return null;
}

function extractDegreeProgram(text: string): { value: string; raw: string; confidence: number } | null {
  const patterns: RegExp[] = [
    /(?:program|major|specialization|degree\s+program)\s*:?\s*([^\n,;]{3,80})/i,
    /(?:bachelor|master|ph\.?d|doctorate)(?:'?s)?\s*(?:of|in)\s+([^\n,;]{3,80})/i,
    /(?:تخصص|البرنامج|درجة)\s*:?\s*([^\n,؛]{3,80})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      return { value: m[1].trim(), raw: m[0], confidence: HEADER_CONFIDENCE };
    }
  }
  return null;
}

interface GpaParse {
  value: { value: string; raw: string; confidence: number };
  scale: { value: string; raw: string; confidence: number } | null;
}

function extractGpa(text: string): GpaParse | null {
  // Strict: must be near explicit GPA/CGPA label and on a 0..100 / 0..10 / 0..5 / 0..4 axis.
  const labeled =
    text.match(
      /(?:cgpa|cumulative\s*gpa|overall\s*gpa|gpa)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:\/|out\s*of|of)?\s*([0-9]+(?:\.[0-9]+)?)?/i,
    ) ||
    text.match(
      /(?:المعدل\s*التراكمي|المعدل)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:\/|من)?\s*([0-9]+(?:\.[0-9]+)?)?/,
    );

  if (!labeled) return null;
  const raw = labeled[0];
  const valueStr = labeled[1];
  const scaleStr = labeled[2] ?? null;

  // Only accept scale if it's a recognised denominator. Otherwise scale=null
  // (truthful: do not invent a 4.0 scale on a percentage transcript).
  const validScale = scaleStr && /^(?:4(?:\.0+)?|5(?:\.0+)?|10(?:\.0+)?|100)$/.test(scaleStr);

  return {
    value: { value: valueStr, raw, confidence: HEADER_CONFIDENCE },
    scale: validScale
      ? { value: scaleStr!, raw, confidence: HEADER_CONFIDENCE }
      : null,
  };
}

function extractGradingSystemHint(text: string): { value: string; raw: string; confidence: number } | null {
  const m =
    text.match(/\b(credit\s*hours?|ECTS|units?|ساعات?\s*معتمدة)\b/i) || null;
  if (!m) return null;
  return { value: m[0].toLowerCase(), raw: m[0], confidence: 0.5 };
}

// ── Row reconstruction (partial, truthful) ──────────────────────

function reconstructRow(line: string): TranscriptRow | null {
  const trimmed = line.trim();
  if (trimmed.length < 8) return null;

  const codeMatch = trimmed.match(COURSE_CODE_RE);
  const letterMatch = trimmed.match(LETTER_GRADE_TOKEN_RE);
  const percentMatch = trimmed.match(PERCENT_TOKEN_RE);
  const fractionMatch = trimmed.match(FRACTION_GRADE_RE);
  const creditMatch = trimmed.match(/\b(\d{1,2}(?:\.\d)?)\s*(?:credit\s*hours?|cr\.?\s*hr|units?|ECTS|ساعات?)\b/i);
  const standaloneCredit = !creditMatch ? trimmed.match(/(?<![\d\.])(\d{1,2})(?![\d\.])\s*$/) : null;

  const grade =
    (letterMatch && letterMatch[0]) ||
    (percentMatch && percentMatch[0]) ||
    (fractionMatch && fractionMatch[0]) ||
    null;

  // A line qualifies as a row only if it has at least subject-ish text + (grade OR credits).
  const subjectish = trimmed.replace(COURSE_CODE_RE, '').trim();
  const hasSubjectText = /[A-Za-z\u0600-\u06FF]{4,}/.test(subjectish);
  if (!hasSubjectText) return null;
  if (!grade && !creditMatch) return null;

  // Subject = text before the grade token if present, else cleaned line.
  let subject_raw: string | null = null;
  if (grade) {
    const idx = trimmed.indexOf(grade);
    const prefix = trimmed.slice(0, idx).trim().replace(COURSE_CODE_RE, '').trim();
    if (prefix.length >= 3) subject_raw = prefix;
  }
  if (!subject_raw) {
    subject_raw = subjectish.length >= 3 ? subjectish.slice(0, 80) : null;
  }

  const credits_raw =
    (creditMatch && creditMatch[1]) ||
    (standaloneCredit && standaloneCredit[1]) ||
    null;

  const missing: TranscriptRow['missing_columns'] = [];
  if (!subject_raw) missing.push('subject');
  if (!grade) missing.push('grade');
  if (!credits_raw) missing.push('credits');
  missing.push('term'); // we don't try to attach term per-row in V1; truthful gap.

  // Confidence: row gets 0.5 base, +0.1 per recovered column, capped at 0.75.
  let confidence = 0.5;
  if (subject_raw) confidence += 0.1;
  if (grade) confidence += 0.1;
  if (credits_raw) confidence += 0.05;
  if (codeMatch) confidence += 0.05;
  confidence = Math.min(confidence, 0.75);

  return {
    raw_line: trimmed.slice(0, 200),
    subject_raw,
    course_code: codeMatch ? codeMatch[0] : null,
    grade_raw: grade,
    credits_raw,
    term_raw: null,
    confidence,
    missing_columns: missing,
  };
}

// ── Public API ────────────────────────────────────────────────

export interface TranscriptParseResult {
  intermediate: TranscriptIntermediate;
  header_fields: Fields;
  /** Telemetry: how the structured artifact contributed (browser-only). */
  structured_artifact_used?: {
    used: boolean;
    extra_rows_added: number;
    tabular_candidates_seen: number;
  };
}

/**
 * Parse transcript text. Optionally consume a StructuredDocumentArtifact
 * (browser-only structured layer) to recover additional row candidates the
 * line-by-line regex pass missed. Honesty contract preserved: structured
 * rows are deduped and tagged with the same partial-truth confidence cap.
 */
export function parseTranscript(
  text: string,
  structured?: StructuredDocumentArtifact | null,
): TranscriptParseResult {
  const intermediate = emptyIntermediate(PARSER);
  const fields: Fields = {};

  if (!text || text.trim().length === 0) {
    intermediate.evidence_summary = 'empty_text';
    return { intermediate, header_fields: fields };
  }

  intermediate.signals = computeTranscriptSignals(text);

  // Header
  const inst = extractInstitution(text);
  if (inst) {
    intermediate.header.institution_name = inst;
    fields['academic.institution_name'] = fld(inst.value, inst.raw, inst.confidence);
  }
  const prog = extractDegreeProgram(text);
  if (prog) {
    intermediate.header.degree_program = prog;
    fields['academic.credential_name'] = fld(prog.value, prog.raw, prog.confidence);
  }
  const gpa = extractGpa(text);
  if (gpa) {
    intermediate.header.gpa_raw = gpa.value;
    fields['academic.gpa_raw'] = fld(gpa.value.value, gpa.value.raw, gpa.value.confidence);
    if (gpa.scale) {
      intermediate.header.gpa_scale = gpa.scale;
      fields['academic.grading_scale'] = fld(gpa.scale.value, gpa.scale.raw, gpa.scale.confidence);
    }
  }
  const grading = extractGradingSystemHint(text);
  if (grading) {
    intermediate.header.grading_system_hint = grading;
    // grading hint stays in intermediate only (no canonical field for it).
  }

  // Rows — Order 2 honesty fix: separate inspected vs row-like candidates.
  const lines = text.split(/\r?\n/);
  let inspected = 0;
  let rowLikeCandidates = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 8) continue;
    inspected++;
    const subjectish = trimmed.replace(COURSE_CODE_RE, '').trim();
    const hasSubjectText = /[A-Za-z\u0600-\u06FF]{4,}/.test(subjectish);
    if (!hasSubjectText) continue;
    const hasGradeish =
      LETTER_GRADE_TOKEN_RE.test(trimmed) ||
      PERCENT_TOKEN_RE.test(trimmed) ||
      FRACTION_GRADE_RE.test(trimmed);
    const hasCredit = /\b\d{1,2}(?:\.\d)?\s*(?:credit\s*hours?|cr\.?\s*hr|units?|ECTS|ساعات?)\b/i.test(trimmed);
    const hasCode = COURSE_CODE_RE.test(trimmed);
    if (!(hasGradeish || hasCredit || hasCode)) continue;
    rowLikeCandidates++;
    const row = reconstructRow(line);
    if (row) intermediate.rows.push(row);
  }

  // ── Optional: merge in tabular row_candidates from structured artifact ──
  // Browser-only artifact. Pure additive: dedupe by raw_line prefix, never
  // overwrite existing rows. Tagged with same partial-truth flag.
  // Coverage denominator honesty fix (Option A):
  //   base_row_like_candidates = unique row-like lines from primary text pass
  //   structured_tabular_candidates = total tabular row_candidates seen in artifact
  //   structured_unique_candidates_added = those NOT already represented in base set
  //                                        (same dedupe key as numerator path)
  //   effective_row_like_candidates = base + unique_added  (NO double counting)
  let extraRowsAdded = 0;
  let tabularCandidatesSeen = 0;
  let structuredUniqueCandidatesAdded = 0;
  if (structured && structured.builder !== 'none' && structured.pages.length > 0) {
    // Dedupe key MUST match numerator dedupe to keep denominator honest.
    const seenKeys = new Set(intermediate.rows.map(r => r.raw_line.slice(0, 80)));
    for (const page of structured.pages) {
      for (const cand of page.row_candidates) {
        if (!cand.is_tabular) continue;
        tabularCandidatesSeen++;
        const key = cand.raw_line.slice(0, 80);
        if (seenKeys.has(key)) continue;
        // Unique candidate not present in base row-like set — counts toward denominator.
        structuredUniqueCandidatesAdded++;
        seenKeys.add(key);
        const row = reconstructRow(cand.raw_line);
        if (!row) continue;
        intermediate.rows.push(row);
        extraRowsAdded++;
      }
    }
  }

  const effectiveRowLikeCandidates = rowLikeCandidates + structuredUniqueCandidatesAdded;
  intermediate.coverage = {
    inspected_lines: inspected,
    row_like_candidates: effectiveRowLikeCandidates,
    rows_reconstructed: intermediate.rows.length,
    coverage_estimate:
      effectiveRowLikeCandidates > 0
        ? Math.min(intermediate.rows.length / effectiveRowLikeCandidates, 1)
        : 0,
    partial: true, // V1 always treats transcript parse as partial truth.
  };
  intermediate.partial = true;

  intermediate.evidence_summary = [
    `vocab=${intermediate.signals.vocabulary_hits.length}`,
    `gpa_sig=${intermediate.signals.gpa_signals.length}`,
    `grade_hits=${intermediate.signals.grade_pattern_hits}`,
    `credit_hits=${intermediate.signals.credit_pattern_hits}`,
    `row_like=${intermediate.signals.row_like_lines}`,
    `rows=${intermediate.rows.length}/${effectiveRowLikeCandidates} (inspected=${inspected}, base=${rowLikeCandidates}, struct_seen=${tabularCandidatesSeen}, struct_unique=${structuredUniqueCandidatesAdded})`,
    `coverage=${intermediate.coverage.coverage_estimate.toFixed(2)}`,
    `structured_extra=${extraRowsAdded}`,
  ].join(' ');

  return {
    intermediate,
    header_fields: fields,
    structured_artifact_used: {
      used: !!(structured && structured.builder !== 'none'),
      extra_rows_added: extraRowsAdded,
      tabular_candidates_seen: tabularCandidatesSeen,
    },
  };
}
