// ═══════════════════════════════════════════════════════════════
// Door 3 — Transcript parser (pure, no I/O)
// ═══════════════════════════════════════════════════════════════
// Consumes OcrEvidence (pages[].lines[].text) and produces
// row-level + summary-level facts. Heuristic / regex only.
// No LLM, no external service.
//
// V1 scope: extract GPA/CGPA-like summary metrics + best-effort
// subject rows. Anything ambiguous => needs_review = true.
// Tuning of regex thresholds is deferred to runtime.
// ═══════════════════════════════════════════════════════════════

import type {
  OcrEvidence,
  TranscriptParseResult,
  TranscriptRow,
  TranscriptSummaryMetric,
} from './door3-types.ts';

const GPA_PATTERNS: Array<{ kind: string; rx: RegExp }> = [
  { kind: 'cgpa',          rx: /\b(?:cgpa|cumulative\s*gpa|overall\s*gpa)\s*[:=]?\s*([0-9](?:\.[0-9]{1,3})?)\s*\/?\s*([0-9](?:\.[0-9]{1,2})?)?/i },
  { kind: 'gpa',           rx: /\bgpa\s*[:=]?\s*([0-9](?:\.[0-9]{1,3})?)\s*\/?\s*([0-9](?:\.[0-9]{1,2})?)?/i },
  { kind: 'percentage',    rx: /\b(?:percentage|overall\s*percentage|aggregate)\s*[:=]?\s*([0-9]{1,3}(?:\.[0-9]{1,2})?)\s*%?/i },
  { kind: 'total_credits', rx: /\b(?:total\s*credits?|credits?\s*earned|credit\s*hours?\s*total)\s*[:=]?\s*([0-9]{1,3}(?:\.[0-9]{1,2})?)/i },
];

const SUBJECT_ROW_RX =
  // course-code? + name (chars) + credits + (mark or grade)
  /^([A-Z]{2,5}[\s-]?\d{2,4})?\s*([A-Za-z][A-Za-z .,&'\-/]{3,80}?)\s+(\d{1,2}(?:\.\d{1,2})?)\s+(?:(\d{1,3}(?:\.\d{1,2})?)\s*%?|([A-F][+\-]?))\s*$/;

function normalizeSubject(name: string): string {
  return name.trim().replace(/\s+/g, ' ').replace(/\.+$/, '');
}

function gradeLetterToNumeric(letter: string): number | null {
  const t = letter.trim().toUpperCase();
  const map: Record<string, number> = {
    'A+': 4.0, A: 4.0, 'A-': 3.7,
    'B+': 3.3, B: 3.0, 'B-': 2.7,
    'C+': 2.3, C: 2.0, 'C-': 1.7,
    'D+': 1.3, D: 1.0, 'D-': 0.7,
    F: 0.0,
  };
  return t in map ? map[t] : null;
}

function flatLines(ev: OcrEvidence): Array<{ page: number; text: string; confidence: number }> {
  const out: Array<{ page: number; text: string; confidence: number }> = [];
  for (const p of ev.pages) {
    if (Array.isArray(p.lines) && p.lines.length > 0) {
      for (const l of p.lines) out.push({ page: p.page_index, text: l.text, confidence: l.confidence ?? 0.7 });
    } else if (p.raw_text) {
      for (const t of p.raw_text.split(/\r?\n/)) {
        if (t.trim()) out.push({ page: p.page_index, text: t, confidence: 0.6 });
      }
    }
  }
  return out;
}

export function parseTranscript(ev: OcrEvidence): TranscriptParseResult {
  const notes: string[] = [];
  const lines = flatLines(ev);
  const fullText = lines.map((l) => l.text).join('\n');

  // ─── Summary metrics ─────────────────────────────────────────
  const summary: TranscriptSummaryMetric[] = [];
  for (const { kind, rx } of GPA_PATTERNS) {
    const m = fullText.match(rx);
    if (m) {
      const val = parseFloat(m[1]);
      summary.push({
        metric_type: kind,
        raw_label: m[0].split(/[:=]/)[0]?.trim() ?? null,
        normalized_label: kind,
        raw_value: m[1] ?? null,
        normalized_numeric_value: Number.isFinite(val) ? val : null,
        confidence: 0.7,
        provenance: { match: m[0], regex: rx.source },
      });
    }
  }

  // ─── Row-level ───────────────────────────────────────────────
  const rows: TranscriptRow[] = [];
  for (const ln of lines) {
    const m = ln.text.match(SUBJECT_ROW_RX);
    if (!m) continue;
    const [, , subjectRaw, creditsRaw, markRaw, gradeRaw] = m;
    if (!subjectRaw) continue;
    const subjectNorm = normalizeSubject(subjectRaw);
    const creditsNum = creditsRaw ? parseFloat(creditsRaw) : null;
    const markNum = markRaw ? parseFloat(markRaw) : null;
    const gradeNum = gradeRaw ? gradeLetterToNumeric(gradeRaw) : null;

    // confidence: combine line confidence with regex strictness
    const conf = Math.min(0.9, (ln.confidence ?? 0.6) * 0.85);

    rows.push({
      academic_period: null,
      subject_name_raw: subjectRaw.trim(),
      subject_name_normalized: subjectNorm,
      mark_raw: markRaw ?? gradeRaw ?? null,
      mark_numeric: markNum ?? gradeNum,
      credit_hours_raw: creditsRaw ?? null,
      credit_hours_numeric: creditsNum,
      grade_raw: gradeRaw ?? null,
      row_confidence: conf,
      provenance: { page: ln.page, source_line: ln.text, line_confidence: ln.confidence },
    });
  }

  if (rows.length === 0) notes.push('no_subject_rows_matched');
  if (summary.length === 0) notes.push('no_summary_metrics_matched');

  const lowConfidenceRows = rows.filter((r) => r.row_confidence < 0.5).length;
  const needsReview =
    rows.length === 0 ||
    summary.length === 0 ||
    lowConfidenceRows > rows.length / 2;

  return {
    rows,
    summary,
    meta: {
      institution_name: null, // V1: not extracted (deferred)
      student_name: null,
      document_language: null,
      processing_mode: ev.engine === 'pdfjs-text-layer' ? 'pdf_text' : 'internal_ocr',
    },
    needs_review: needsReview,
    notes,
  };
}
