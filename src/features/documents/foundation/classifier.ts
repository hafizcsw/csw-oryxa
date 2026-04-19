// ═══════════════════════════════════════════════════════════════
// Foundation — Family Classifier (CONTENT-FIRST, v2)
// ═══════════════════════════════════════════════════════════════
// Order of authority (highest first):
//   1. MRZ presence in PDF text          → passport_id @ 0.95
//   2. Content keyword match in PDF text → up to 0.90
//   3. Filename token match              → CAPPED @ 0.55 (hint only)
//   4. Declared slot                     → 0.50 (hint only)
//
// Hard rules:
//   • filename/declared_slot ALONE never produce a confident decision
//     → result is always requires_review=true if no content evidence
//   • Image files (no OCR in Door 1) → content deferred → max 0.55, review
//   • Content vs filename mismatch → content wins, mismatch logged
// ═══════════════════════════════════════════════════════════════

import type { DocumentFamily } from './families';
import { defaultLaneFor } from './families';
import { unknownDecision, type RouteDecision, ROUTER_VERSION } from './route-decision';
import { extractFoundationEvidence, type FoundationEvidence } from './evidence-extractor';

interface Signal {
  family: DocumentFamily;
  score: number;
  source: 'mrz' | 'content_keywords' | 'filename' | 'declared_slot';
  matched: string[];
}

const FILENAME_HINT_CAP = 0.55;
const DECLARED_SLOT_SCORE = 0.50;

const TOKENS: Record<Exclude<DocumentFamily, 'unknown_document' | 'composite_document'>, RegExp[]> = {
  passport_id: [
    /\bpassport\b/i, /\bjawaz\b/i, /\bpasaporte\b/i, /\bid[-_ ]?card\b/i,
    /جواز/, /هوية/, /بطاقة/,
  ],
  graduation_certificate: [
    /\bgraduation\b/i, /\bdiploma\b/i, /\bcertificate\b/i, /\bdegree\b/i,
    /\bbachelor\b/i, /\bmaster\b/i, /\bdoctorate\b/i, /\bphd\b/i,
    /شهادة/, /تخرج/, /دبلوم/, /بكالوريوس/, /ماجستير/, /ثانوية/,
  ],
  language_certificate: [
    /\bielts\b/i, /\btoefl\b/i, /\bduolingo\b/i, /\bpte\b/i, /\bdelf\b/i,
    /\bdalf\b/i, /\bgoethe\b/i, /\btestdaf\b/i, /\bhsk\b/i, /\btopik\b/i,
    /\blanguage\b.*\b(certificate|test|score)\b/i,
  ],
  academic_transcript: [
    /\btranscript\b/i, /\bmarks\b/i, /\bgrades\b/i, /\bgpa\b/i,
    /كشف/, /درجات/, /سجل[_ ]?أكاديمي/,
  ],
};

function normalizeName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}

function scoreText(text: string, capRaw: number): Signal[] {
  const out: Signal[] = [];
  for (const [family, patterns] of Object.entries(TOKENS) as [DocumentFamily, RegExp[]][]) {
    const matched: string[] = [];
    for (const re of patterns) {
      if (re.test(text)) matched.push(re.source);
    }
    if (matched.length) {
      // 1 hit → 0.55, 2 hits → 0.70, 3+ hits → 0.85, 4+ → 0.90 (capped at capRaw)
      const raw = Math.min(0.90, 0.40 + matched.length * 0.15);
      const score = Math.min(capRaw, raw);
      out.push({ family, score, source: 'content_keywords', matched });
    }
  }
  return out;
}

function scoreFilename(name: string): Signal[] {
  const normalized = normalizeName(name);
  const signals = scoreText(normalized, FILENAME_HINT_CAP);
  return signals.map(s => ({ ...s, source: 'filename' as const }));
}

function scoreContent(text: string): Signal[] {
  return scoreText(text, 0.90);
}

function mimeAllowed(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/');
}

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

export interface ClassifyInput {
  document_id: string;
  file: File;
  declared_slot?: string | null;
}

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

  // ── 1. Content evidence (the only authoritative source) ─────
  const evidence: FoundationEvidence = await extractFoundationEvidence(file);
  reasons.push(`content_kind=${evidence.content_kind}`);
  for (const n of evidence.notes) reasons.push(`evidence:${n}`);

  const allSignals: Signal[] = [];

  // 1a. MRZ — strongest content signal
  if (evidence.mrz?.found) {
    allSignals.push({
      family: 'passport_id',
      score: 0.95,
      source: 'mrz',
      matched: [`mrz:${evidence.mrz.format ?? 'unknown'}`],
    });
    reasons.push('content_signal:mrz_present');
  }

  // 1b. Content keywords on extracted PDF text
  if (evidence.pdf_text) {
    const contentSignals = scoreContent(evidence.pdf_text.toLowerCase());
    if (contentSignals.length) {
      reasons.push(`content_signal:keywords=[${contentSignals.map(s => `${s.family}@${s.score.toFixed(2)}`).join(',')}]`);
    }
    allSignals.push(...contentSignals);
  }

  // ── 2. Filename + declared_slot — HINTS ONLY (capped 0.55 / 0.50) ──
  const filenameSignals = scoreFilename(name);
  allSignals.push(...filenameSignals);
  if (filenameSignals.length) {
    reasons.push(`filename_hint=[${filenameSignals.map(s => `${s.family}@${s.score.toFixed(2)}`).join(',')}]`);
  }

  const declaredFamily = declaredSlotToFamily(declared_slot);
  if (declaredFamily) {
    allSignals.push({
      family: declaredFamily,
      score: DECLARED_SLOT_SCORE,
      source: 'declared_slot',
      matched: [`declared_slot:${declared_slot}`],
    });
    reasons.push(`declared_slot_hint=${declaredFamily}@${DECLARED_SLOT_SCORE}`);
  }

  // ── 3. Aggregate per-family (max score wins) ───────────────
  const perFamily = new Map<DocumentFamily, Signal>();
  for (const s of allSignals) {
    const cur = perFamily.get(s.family);
    if (!cur || s.score > cur.score) perFamily.set(s.family, s);
  }
  const ranked = [...perFamily.values()].sort((a, b) => b.score - a.score);
  const top = ranked[0];

  if (!top || top.score < 0.50) {
    reasons.push(`top_signal_too_weak(score=${top?.score ?? 0})`);
    return unknownDecision(document_id, reasons);
  }

  // ── 4. Content vs filename mismatch detection ───────────────
  const contentTop = ranked.find(s => s.source === 'mrz' || s.source === 'content_keywords');
  const hintTop = ranked.find(s => s.source === 'filename' || s.source === 'declared_slot');
  if (contentTop && hintTop && contentTop.family !== hintTop.family) {
    reasons.push(`filename_content_mismatch:filename=${hintTop.family},content=${contentTop.family} → content wins`);
  }

  const family = top.family;
  let confidence = Math.min(0.99, top.score);

  reasons.push(`top_family=${family}`);
  reasons.push(`top_source=${top.source}`);
  reasons.push(`top_matches=[${top.matched.join('|')}]`);

  // ── 5. HONESTY GATES ──
  // Gate A: any decision NOT backed by content evidence → requires_review,
  //         and confidence is clamped to FILENAME_HINT_CAP.
  const hasContentEvidence = top.source === 'mrz' || top.source === 'content_keywords';
  if (!hasContentEvidence) {
    confidence = Math.min(confidence, FILENAME_HINT_CAP);
    reasons.push('no_content_evidence → confidence_capped_at_filename_hint');
  }

  // Gate B: image files (no OCR in Door 1) → content deferred, always review.
  if (evidence.content_kind === 'image') {
    reasons.push('image_content_pending_door3 → requires_review');
  }

  // Gate C: graduation/transcript always review (existing rule preserved).
  const familyForcesReview = family === 'graduation_certificate' || family === 'academic_transcript';

  const requiresReview =
    !hasContentEvidence ||
    evidence.content_kind === 'image' ||
    confidence < 0.70 ||
    familyForcesReview;

  if (requiresReview) reasons.push(`requires_review (confidence=${confidence.toFixed(2)})`);

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
    router_version: 'foundation-v2-content-first',
  };
}
