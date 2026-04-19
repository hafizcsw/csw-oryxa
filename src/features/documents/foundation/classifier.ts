// ═══════════════════════════════════════════════════════════════
// Foundation — Family Classifier (filename + mime + MRZ peek)
// ═══════════════════════════════════════════════════════════════
// Honest, fast, content-blind classifier for the Foundation Gate.
// Uses ONLY:
//   - filename tokens
//   - mime type
//   - (passport candidates only) cheap MRZ peek over PDF text layer
//
// Anything that does not score above thresholds becomes
// 'unknown_document' with low confidence and is routed to review.
// ═══════════════════════════════════════════════════════════════

import type { DocumentFamily } from './families';
import { defaultLaneFor } from './families';
import { unknownDecision, type RouteDecision, ROUTER_VERSION } from './route-decision';
import { parseMrz } from '../parsers/mrz-parser';

interface FilenameSignal {
  family: DocumentFamily;
  score: number;       // 0..1 baseline contribution
  matched: string[];   // matched tokens for audit
}

const TOKENS: Record<Exclude<DocumentFamily, 'unknown_document' | 'composite_document'>, RegExp[]> = {
  passport_id: [
    /\bpassport\b/i, /\bjawaz\b/i, /\bpasaporte\b/i, /\bid[-_ ]?card\b/i,
    /جواز/, /هوية/, /بطاقة/,
  ],
  graduation_certificate: [
    /\bgraduation\b/i, /\bdiploma\b/i, /\bcertificate\b/i, /\bdegree\b/i,
    /شهادة/, /تخرج/, /دبلوم/, /بكالوريوس/, /ثانوية/,
  ],
  language_certificate: [
    /\bielts\b/i, /\btoefl\b/i, /\bduolingo\b/i, /\bpte\b/i, /\bdelf\b/i,
    /\bdalf\b/i, /\bgoethe\b/i, /\btestdaf\b/i, /\bhsk\b/i, /\btopik\b/i,
    /\blanguage\b.*\b(certificate|test|score)\b/i,
  ],
  academic_transcript: [
    /\btranscript\b/i, /\bmarks\b/i, /\bgrades\b/i, /\bgpa\b/i, /\brecord\b/i,
    /كشف/, /درجات/, /سجل[_ ]?أكاديمي/,
  ],
};

function scoreFilename(name: string): FilenameSignal[] {
  const out: FilenameSignal[] = [];
  for (const [family, patterns] of Object.entries(TOKENS) as [DocumentFamily, RegExp[]][]) {
    const matched: string[] = [];
    for (const re of patterns) {
      if (re.test(name)) matched.push(re.source);
    }
    if (matched.length) {
      // 1 hit → 0.55, 2 hits → 0.75, 3+ hits → 0.85 (capped)
      const score = Math.min(0.85, 0.4 + matched.length * 0.15);
      out.push({ family, score, matched });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

function mimeAllowed(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/');
}

/** Cheap MRZ peek — PDF text layer only. No OCR. No raster. No external. */
async function tryPdfTextMrzPeek(file: File): Promise<{ found: boolean; raw: string }> {
  if (file.type !== 'application/pdf') return { found: false, raw: '' };
  try {
    const { extractPdfText } = await import('../parsers/browser-preprocessing').catch(() => ({ extractPdfText: null as any }));
    if (typeof extractPdfText !== 'function') {
      // fallback: dynamic pdfjs is owned by other modules — don't reinvent
      return { found: false, raw: '' };
    }
    const text: string = await extractPdfText(file);
    if (!text || text.length < 30) return { found: false, raw: '' };
    const mrz = parseMrz(text);
    return { found: mrz.found, raw: text.slice(0, 4000) };
  } catch {
    return { found: false, raw: '' };
  }
}

export interface ClassifyInput {
  document_id: string;
  file: File;
}

/** Foundation router — produces a RouteDecision for any file. */
export async function classifyAndRoute(input: ClassifyInput): Promise<RouteDecision> {
  const { document_id, file } = input;
  const reasons: string[] = [];
  const name = file.name || '';
  const mime = file.type || '';

  reasons.push(`filename="${name}"`);
  reasons.push(`mime="${mime || 'unknown'}"`);

  if (!mimeAllowed(mime)) {
    reasons.push('mime_not_pdf_or_image → unknown');
    return unknownDecision(document_id, reasons);
  }

  const filenameSignals = scoreFilename(name);
  let topSignal = filenameSignals[0];

  // ── Passport-only MRZ peek (cheap, PDF text layer only) ──────
  let mrzBoost = 0;
  if (mime === 'application/pdf') {
    const peek = await tryPdfTextMrzPeek(file);
    if (peek.found) {
      mrzBoost = 0.5;
      reasons.push('mrz_peek=found');
      // MRZ presence is a near-definitive passport signal; promote it.
      const passportSignal: FilenameSignal = {
        family: 'passport_id',
        score: Math.max(topSignal?.family === 'passport_id' ? topSignal.score : 0, 0.6) + mrzBoost,
        matched: ['mrz_present', ...(topSignal?.family === 'passport_id' ? topSignal.matched : [])],
      };
      // re-evaluate top
      const merged = [...filenameSignals.filter(s => s.family !== 'passport_id'), passportSignal]
        .sort((a, b) => b.score - a.score);
      topSignal = merged[0];
    } else {
      reasons.push('mrz_peek=not_found');
    }
  }

  if (!topSignal || topSignal.score < 0.55) {
    reasons.push(`top_signal_too_weak(score=${topSignal?.score ?? 0})`);
    return unknownDecision(document_id, reasons);
  }

  const family = topSignal.family;
  const confidence = Math.min(0.99, topSignal.score);
  reasons.push(`top_family=${family}`);
  reasons.push(`top_matches=[${topSignal.matched.join('|')}]`);

  // Truth-honesty: anything below 0.7 still goes to review even if a family is named.
  const requiresReview = confidence < 0.7 || family === 'graduation_certificate' || family === 'academic_transcript';
  if (requiresReview) reasons.push(`requires_review (confidence=${confidence})`);

  const lane = defaultLaneFor(family);
  const isAsync = lane === 'transcript_lane' || lane === 'composite_lane';

  return {
    document_id,
    route_family: family,
    route_confidence: Number(confidence.toFixed(2)),
    route_reasons: reasons,
    selected_lane: lane,
    is_async: isAsync,
    requires_review: requiresReview,
    decided_at: new Date().toISOString(),
    router_version: ROUTER_VERSION,
  };
}
