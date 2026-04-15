// ═══════════════════════════════════════════════════════════════
// Transcript Parser — Door 4: Subject Row Extraction
// ═══════════════════════════════════════════════════════════════
// Text-based parsing only. Regex + table-lite heuristics.
// No OCR for images. No external LLM.
// Returns SubjectRow[] from transcript text content.
// ═══════════════════════════════════════════════════════════════

import type { SubjectRow } from './types';
import { normalizeSubjectFamily, normalizeGradeTo100 } from './types';

/**
 * Parse subject rows from transcript text content.
 * Uses line-by-line heuristic: looks for lines with subject + grade patterns.
 */
export function parseTranscriptSubjects(params: {
  textContent: string;
  studentId: string;
  documentId: string;
}): SubjectRow[] {
  const { textContent, studentId, documentId } = params;
  if (!textContent || textContent.trim().length < 20) return [];

  const rows: SubjectRow[] = [];
  const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const parsed = parseSubjectLine(line);
    if (!parsed) continue;

    const family = normalizeSubjectFamily(parsed.subjectName);
    const gradeNorm = parsed.grade ? normalizeGradeTo100(parsed.grade, parsed.scale) : null;

    rows.push({
      row_id: crypto.randomUUID(),
      student_id: studentId,
      source_document_id: documentId,
      subject_raw_name: parsed.subjectName,
      subject_canonical_name: null, // V1: no canonical name DB
      subject_family: family,
      grade_raw: parsed.grade,
      grade_normalized: gradeNorm,
      credits: parsed.credits,
      level: null,
      year_or_term: parsed.term,
      passed: gradeNorm !== null ? gradeNorm >= 50 : null,
      confidence: parsed.confidence,
    });
  }

  return rows;
}

// ── Line parsing heuristic ───────────────────────────────────

interface ParsedLine {
  subjectName: string;
  grade: string | null;
  credits: number | null;
  term: string | null;
  scale: string | null;
  confidence: number;
}

/**
 * Try to parse a single line as a subject row.
 * Common patterns:
 *   "Mathematics    A+    3"
 *   "CHEM101 General Chemistry  85/100  4 credits"
 *   "Biology   3.5/4.0   3"
 */
function parseSubjectLine(line: string): ParsedLine | null {
  // Skip header/footer lines
  if (/^(subject|course|name|code|grade|credit|total|gpa|cgpa|semester|year|student|university|faculty|page|date)/i.test(line)) return null;
  if (line.length < 5 || line.length > 200) return null;
  if (/^[-=_.*]+$/.test(line)) return null; // separator lines

  // Pattern 1: "Subject Name   Grade   Credits"
  // Look for a line with text + number/letter grade pattern
  const tabSplit = line.split(/\t+/);
  if (tabSplit.length >= 2) {
    return parseColumns(tabSplit);
  }

  // Pattern 2: multiple spaces as column separator
  const spaceSplit = line.split(/\s{3,}/);
  if (spaceSplit.length >= 2) {
    return parseColumns(spaceSplit);
  }

  // Pattern 3: grade after colon "Mathematics: A+"
  const colonMatch = line.match(/^(.{3,50}):\s*([A-Fa-f][+-]?|\d{1,3}(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*$/);
  if (colonMatch) {
    return {
      subjectName: colonMatch[1].trim(),
      grade: colonMatch[2].trim(),
      credits: null,
      term: null,
      scale: null,
      confidence: 0.6,
    };
  }

  return null;
}

function parseColumns(cols: string[]): ParsedLine | null {
  const cleaned = cols.map(c => c.trim()).filter(Boolean);
  if (cleaned.length < 2) return null;

  // First column = subject name (must have letters)
  const subjectName = cleaned[0];
  if (!/[a-zA-Z\u0600-\u06FF]{2,}/.test(subjectName)) return null;
  // Skip if it looks like a number/code only
  if (/^\d+$/.test(subjectName)) return null;

  let grade: string | null = null;
  let credits: number | null = null;
  let scale: string | null = null;

  for (let i = 1; i < cleaned.length; i++) {
    const val = cleaned[i];
    
    // Grade: letter grade
    if (/^[A-Fa-f][+-]?$/.test(val)) {
      grade = val;
      continue;
    }
    
    // Grade: numeric with optional scale  e.g. "85/100", "3.5/4.0"
    const numGrade = val.match(/^(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?$/);
    if (numGrade && !grade) {
      grade = numGrade[1];
      scale = numGrade[2] || null;
      continue;
    }

    // Credits: small integer
    const credNum = parseInt(val);
    if (!isNaN(credNum) && credNum >= 1 && credNum <= 12 && !credits) {
      credits = credNum;
      continue;
    }
  }

  if (!grade) return null; // Must have at least a grade

  return {
    subjectName,
    grade,
    credits,
    term: null,
    scale,
    confidence: 0.55,
  };
}
