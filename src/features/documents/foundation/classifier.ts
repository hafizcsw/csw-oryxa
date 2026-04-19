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

/** Normalize filename: lowercase, replace separators with spaces, strip extension. */
function normalizeName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')          // strip extension
    .replace(/[_\-.]+/g, ' ')         // separators → space
    .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase → spaced
    .toLowerCase()
    .trim();
}

function scoreFilename(name: string): FilenameSignal[] {
  const normalized = normalizeName(name);
  const out: FilenameSignal[] = [];
  for (const [family, patterns] of Object.entries(TOKENS) as [DocumentFamily, RegExp[]][]) {
    const matched: string[] = [];
    for (const re of patterns) {
      if (re.test(normalized)) matched.push(re.source);
    }
    if (matched.length) {
      // 1 hit → 0.55, 2 hits → 0.70, 3+ hits → 0.85 (capped)
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
    const pdfjsLib: any = await import('pdfjs-dist');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf, disableWorker: true }).promise;
    const pagesToScan = Math.min(pdf.numPages, 2);
    let text = '';
    for (let p = 1; p <= pagesToScan; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += '\n' + content.items.map((it: any) => it.str).join(' ');
      if (text.length > 8000) break;
    }
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
  /** Declared slot/kind from the upload UI. Low-confidence hint only. */
  declared_slot?: string | null;
}

/** Map a declared slot string (from upload UI) to a known DocumentFamily.
 *  Conservative — only maps unambiguous slot values. */
function declaredSlotToFamily(slot: string | null | undefined): DocumentFamily | null {
  if (!slot) return null;
  const s = slot.toLowerCase().trim();
  if (s === 'passport' || s === 'passport_id' || s === 'id_card') return 'passport_id';
  if (
    s === 'certificate' || s === 'graduation_certificate' || s === 'diploma' ||
    s === 'degree' || s === 'graduation'
  ) return 'graduation_certificate';
  if (
    s === 'language' || s === 'language_certificate' || s === 'ielts' ||
    s === 'toefl' || s === 'duolingo'
  ) return 'language_certificate';
  if (s === 'transcript' || s === 'academic_transcript') return 'academic_transcript';
  return null;
}

/** Foundation router — produces a RouteDecision for any file. */
export async function classifyAndRoute(input: ClassifyInput): Promise<RouteDecision> {
  const { document_id, file, declared_slot } = input;
  const reasons: string[] = [];
  const name = file.name || '';
  const mime = file.type || '';

  reasons.push(`filename="${name}"`);
  reasons.push(`mime="${mime || 'unknown'}"`);
  if (declared_slot) reasons.push(`declared_slot="${declared_slot}"`);

  if (!mimeAllowed(mime)) {
    reasons.push('mime_not_pdf_or_image → unknown');
    return unknownDecision(document_id, reasons);
  }

  const filenameSignals = scoreFilename(name);
  let topSignal = filenameSignals[0];

  // ── Declared-slot hint: low-confidence declared signal ───────
  // Only kicks in when filename produced no match. Caps at 0.55 → review_required.
  const declaredFamily = declaredSlotToFamily(declared_slot);
  if (!topSignal && declaredFamily) {
    topSignal = {
      family: declaredFamily,
      score: 0.55,
      matched: [`declared_slot:${declared_slot}`],
    };
    reasons.push(`declared_slot_signal=${declaredFamily}@0.55`);
  }

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

  if (!topSignal || topSignal.score < 0.5) {
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
