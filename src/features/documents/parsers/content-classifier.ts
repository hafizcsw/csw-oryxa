// ═══════════════════════════════════════════════════════════════
// Content Classifier — Door 2: Document classification
// ═══════════════════════════════════════════════════════════════
// Classifies extracted text into document slot types.
// Uses pattern matching with weighted scoring.

import type { DocumentSlotType } from '../document-registry-model';

export interface ClassificationScore {
  slot: DocumentSlotType | 'unknown' | 'unsupported';
  score: number;
  evidence: string[];
}

export interface ClassificationOutput {
  best: DocumentSlotType | 'unknown' | 'unsupported';
  confidence: number;
  scores: ClassificationScore[];
  evidence: string[];
}

// MIME types that the analysis pipeline can process
const SUPPORTED_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff',
]);

// ── Patterns with weights ────────────────────────────────────
// Each pattern has a weight: higher = stronger signal for that category

interface WeightedPattern {
  pattern: RegExp;
  weight: number;
}

const PASSPORT_PATTERNS: WeightedPattern[] = [
  { pattern: /passport/i, weight: 3 },
  { pattern: /P<[A-Z]{3}/, weight: 5 },           // MRZ line 1 — very strong
  { pattern: /\b[A-Z0-9]{9}\d\b/, weight: 2 },    // passport number
  { pattern: /nationality/i, weight: 1.5 },
  { pattern: /date.?of.?birth/i, weight: 1 },
  { pattern: /issuing.?authority/i, weight: 2 },
  { pattern: /جواز/i, weight: 3 },                 // Arabic: passport
  { pattern: /سفر/i, weight: 2 },                  // Arabic: travel
  { pattern: /place.?of.?birth/i, weight: 1.5 },
  { pattern: /expiry|expiration/i, weight: 1.5 },
];

const GRADUATION_CERT_PATTERNS: WeightedPattern[] = [
  // Strong signals — specific to graduation certificates
  { pattern: /graduation\s*certificate/i, weight: 5 },
  { pattern: /شهادة\s*(?:ال)?تخرج/i, weight: 5 },     // شهادة تخرج / شهادة التخرج
  { pattern: /شهادة\s*(?:ال)?بكالوريوس/i, weight: 5 }, // شهادة البكالوريوس
  { pattern: /شهادة\s*(?:ال)?ماجستير/i, weight: 5 },
  { pattern: /شهادة\s*(?:ال)?دكتوراه/i, weight: 5 },
  { pattern: /conferred/i, weight: 3 },
  { pattern: /awarded\s*(?:the\s*)?degree/i, weight: 4 },
  { pattern: /hereby\s*certif/i, weight: 3 },
  { pattern: /بموجب\s*هذ/i, weight: 3 },               // بموجب هذا — hereby
  { pattern: /منح/i, weight: 2 },                      // granted/awarded
  // Medium signals
  { pattern: /graduation/i, weight: 2 },
  { pattern: /diploma/i, weight: 2 },
  { pattern: /degree/i, weight: 2 },
  { pattern: /bachelor/i, weight: 2.5 },
  { pattern: /master/i, weight: 1.5 },
  { pattern: /certificate/i, weight: 1 },              // low — too generic
  { pattern: /university/i, weight: 1 },
  { pattern: /faculty/i, weight: 1 },
  { pattern: /شهادة/i, weight: 1.5 },
  { pattern: /تخرج/i, weight: 2 },
  { pattern: /جامعة/i, weight: 1 },
  { pattern: /كلية/i, weight: 1 },
  { pattern: /بكالوريوس/i, weight: 2.5 },
  { pattern: /ماجستير/i, weight: 2 },
  { pattern: /دكتوراه/i, weight: 2 },
  { pattern: /التقدير/i, weight: 1.5 },                // grade/honor
  { pattern: /بتقدير/i, weight: 2 },                   // with grade of
  { pattern: /نجح/i, weight: 1.5 },                    // passed
  { pattern: /اجتاز/i, weight: 1.5 },                  // completed/passed
];

const TRANSCRIPT_PATTERNS: WeightedPattern[] = [
  // Strong — unique to transcripts
  { pattern: /transcript/i, weight: 4 },
  { pattern: /academic.?record/i, weight: 4 },
  { pattern: /كشف\s*(?:ال)?درجات/i, weight: 5 },       // كشف درجات
  { pattern: /سجل\s*أكاديمي/i, weight: 5 },
  { pattern: /mark.?sheet/i, weight: 4 },
  // Medium — shared with certificates but weighted lower
  { pattern: /semester/i, weight: 2 },
  { pattern: /cumulative/i, weight: 2 },
  { pattern: /cgpa/i, weight: 2 },
  { pattern: /credit\s*hours?/i, weight: 2 },
  { pattern: /course\s*(?:code|name|title)/i, weight: 2 },
  // Weak — too generic alone
  { pattern: /gpa/i, weight: 1 },
  { pattern: /grade/i, weight: 0.5 },
  { pattern: /course/i, weight: 0.5 },
  { pattern: /credit/i, weight: 0.5 },
  { pattern: /معدل/i, weight: 1 },
];

const LANGUAGE_CERT_PATTERNS: WeightedPattern[] = [
  { pattern: /ielts/i, weight: 5 },
  { pattern: /toefl/i, weight: 5 },
  { pattern: /duolingo/i, weight: 5 },
  { pattern: /pte.?academic/i, weight: 5 },
  { pattern: /english.?proficiency/i, weight: 3 },
  { pattern: /band.?score/i, weight: 3 },
  { pattern: /listening/i, weight: 1 },
  { pattern: /speaking/i, weight: 1 },
  { pattern: /writing/i, weight: 0.5 },
  { pattern: /test.?report/i, weight: 2 },
  { pattern: /candidate/i, weight: 0.5 },
  { pattern: /test.?date/i, weight: 1 },
];

function scoreWeightedPatterns(text: string, patterns: WeightedPattern[]): { score: number; evidence: string[] } {
  const evidence: string[] = [];
  let totalWeight = 0;
  let maxPossible = 0;

  for (const p of patterns) {
    maxPossible += p.weight;
    const match = text.match(p.pattern);
    if (match) {
      totalWeight += p.weight;
      evidence.push(match[0]);
    }
  }

  // Normalize: score = weighted hits / (maxPossible * 0.25)
  // A document matching ~25% of max weight = score 1.0
  const threshold = maxPossible * 0.25;
  return { score: Math.min(totalWeight / Math.max(threshold, 1), 1.0), evidence };
}

/**
 * Classify document content into a slot type.
 * Uses both filename and extracted text content.
 * Weighted pattern scoring with disambiguation.
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
    { slot: 'passport', ...scoreWeightedPatterns(combined, PASSPORT_PATTERNS) },
    { slot: 'graduation_certificate', ...scoreWeightedPatterns(combined, GRADUATION_CERT_PATTERNS) },
    { slot: 'transcript', ...scoreWeightedPatterns(combined, TRANSCRIPT_PATTERNS) },
    { slot: 'language_certificate', ...scoreWeightedPatterns(combined, LANGUAGE_CERT_PATTERNS) },
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

  // Disambiguation: if graduation_certificate and transcript are close,
  // prefer graduation_certificate (transcripts almost always have tabular data)
  const gradScore = scores.find(s => s.slot === 'graduation_certificate');
  const transScore = scores.find(s => s.slot === 'transcript');
  if (gradScore && transScore && top.slot === 'transcript') {
    // If graduation is within 30% of transcript score, prefer graduation
    if (gradScore.score >= transScore.score * 0.7) {
      return {
        best: 'graduation_certificate',
        confidence: gradScore.score,
        scores,
        evidence: [...gradScore.evidence, '[disambiguated: grad preferred over transcript]'],
      };
    }
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
