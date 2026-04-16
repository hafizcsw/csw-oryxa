// ═══════════════════════════════════════════════════════════════
// Content Classifier — Door 1: Internal document classification
// ═══════════════════════════════════════════════════════════════
// Classifies documents based on text content + filename heuristics.
// No external LLM. Pure regex/pattern matching.
// Fixed MIME gate: checks actual MIME type properly.
// ═══════════════════════════════════════════════════════════════

import type { DocumentSlotType } from '../document-registry-model';

export interface ClassificationScore {
  slot: DocumentSlotType;
  score: number;        // 0.0–1.0
  evidence: string[];   // keywords/patterns that matched
}

export interface ClassificationOutput {
  best: DocumentSlotType;
  confidence: number;
  scores: ClassificationScore[];
  evidence: string[];
}

// ── Supported MIME types ─────────────────────────────────────
const SUPPORTED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// ── Keyword patterns per document type ───────────────────────

const PASSPORT_PATTERNS = [
  /passport/i,
  /machine.?readable/i,
  /P<[A-Z]{3}/,            // MRZ line 1
  /\b[A-Z0-9]{9}\d\b/,     // passport number pattern
  /nationality/i,
  /date.?of.?birth/i,
  /issuing.?authority/i,
  /جواز/,                   // Arabic: passport
  /سفر/,                    // Arabic: travel
];

const GRADUATION_CERT_PATTERNS = [
  /graduation/i,
  /certificate/i,
  /diploma/i,
  /degree/i,
  /bachelor/i,
  /master/i,
  /awarded/i,
  /conferred/i,
  /university/i,
  /faculty/i,
  /شهادة/,                  // Arabic: certificate
  /تخرج/,                   // Arabic: graduation
  /جامعة/,                  // Arabic: university
  /كلية/,                   // Arabic: faculty
  /بكالوريوس/,              // Arabic: bachelor
  /ماجستير/,                // Arabic: master
];

const TRANSCRIPT_PATTERNS = [
  /transcript/i,
  /academic.?record/i,
  /course/i,
  /credit/i,
  /grade/i,
  /semester/i,
  /gpa/i,
  /cumulative/i,
  /cgpa/i,
  /mark.?sheet/i,
  /كشف.?درجات/,
  /سجل.?أكاديمي/,
  /معدل/,                   // Arabic: GPA
];

const LANGUAGE_CERT_PATTERNS = [
  /ielts/i,
  /toefl/i,
  /duolingo/i,
  /pte.?academic/i,
  /english.?proficiency/i,
  /band.?score/i,
  /overall.?score/i,
  /listening/i,
  /speaking/i,
  /reading/i,
  /writing/i,
  /test.?report/i,
  /candidate/i,
  /test.?date/i,
];

function scorePatterns(text: string, patterns: RegExp[]): { score: number; evidence: string[] } {
  const evidence: string[] = [];
  let hits = 0;
  for (const p of patterns) {
    const match = text.match(p);
    if (match) {
      hits++;
      evidence.push(match[0]);
    }
  }
  return { score: Math.min(hits / Math.max(patterns.length * 0.3, 3), 1.0), evidence };
}

/**
 * Classify document content into a slot type.
 * Uses both filename and extracted text content.
 * MIME gate now checks exact MIME type against supported set.
 */
export function classifyDocument(params: {
  fileName: string;
  textContent: string;
  mimeType: string;
}): ClassificationOutput {
  const { fileName, textContent, mimeType } = params;
  const combined = `${fileName}\n${textContent}`;

  // Fixed MIME gate: check exact MIME type
  if (mimeType && !SUPPORTED_MIMES.has(mimeType)) {
    return {
      best: 'unsupported',
      confidence: 1.0,
      scores: [],
      evidence: [`Unsupported MIME: ${mimeType}`],
    };
  }

  const scores: ClassificationScore[] = [
    { slot: 'passport', ...scorePatterns(combined, PASSPORT_PATTERNS) },
    { slot: 'graduation_certificate', ...scorePatterns(combined, GRADUATION_CERT_PATTERNS) },
    { slot: 'transcript', ...scorePatterns(combined, TRANSCRIPT_PATTERNS) },
    { slot: 'language_certificate', ...scorePatterns(combined, LANGUAGE_CERT_PATTERNS) },
  ];

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const top = scores[0];
  
  // Require minimum score to classify
  if (top.score < 0.15) {
    return {
      best: 'unknown',
      confidence: 0,
      scores,
      evidence: ['No strong pattern match'],
    };
  }

  // Check if top two are too close (ambiguous)
  const second = scores[1];
  const ambiguous = second && (top.score - second.score) < 0.1 && second.score > 0.15;

  return {
    best: top.slot,
    confidence: ambiguous ? top.score * 0.7 : top.score,
    scores,
    evidence: top.evidence,
  };
}
