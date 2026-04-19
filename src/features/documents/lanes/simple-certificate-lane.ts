// ═══════════════════════════════════════════════════════════════
// Door 2 — Simple Certificate Lane (Architecture-Compliant)
// ═══════════════════════════════════════════════════════════════
// Narrow extraction for ONLY:
//   • graduation_certificate
//   • language_certificate (IELTS / TOEFL / Duolingo / PTE / etc.)
//
// Strategy: heading-aware + key-value regex over text.
// Reading: PDF text layer ONLY (born-digital). NO OCR in this lane.
// If the file is an image OR a scanned PDF without a text layer →
// honestly return needs_review. (Tesseract was removed per the
// "Tesseract passport-only" architecture decision; certificate OCR
// is deferred to Door 3.)
// ═══════════════════════════════════════════════════════════════

import {
  type LaneFactsOutput,
  type CanonicalField,
  type LaneKind,
  missingField,
  aggregateLaneTruth,
} from './lane-fact-model';

const CERT_LANE_VERSION = 'simple-certificate-lane-v3-no-ocr';
const REASON_IMAGE_DEFERRED = 'image_ocr_deferred_to_door_3';

const REQUIRED_GRADUATION = ['student_name', 'institution_name', 'certificate_title'];
const REQUIRED_LANGUAGE = ['student_name', 'language_test_name', 'score'];

async function readPdfText(file: File): Promise<string> {
  try {
    const pdfjsLib: any = await import('pdfjs-dist');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf, disableWorker: true }).promise;
    const pagesToScan = Math.min(pdf.numPages, 4);
    let text = '';
    for (let p = 1; p <= pagesToScan; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += '\n' + content.items.map((it: any) => it.str).join(' ');
    }
    return text;
  } catch {
    return '';
  }
}

interface CertReadResult {
  text: string;
  pdf_text_used: boolean;
  ocr_used: boolean;
  /** True iff input is image or scanned PDF — Door 2 defers OCR to Door 3. */
  deferred_image: boolean;
  notes: string[];
}

async function readForCertificate(file: File): Promise<CertReadResult> {
  const notes: string[] = [];
  const mime = file.type || '';
  if (mime === 'application/pdf') {
    const text = await readPdfText(file);
    if (text && text.length > 80) {
      notes.push('pdf_text_layer_used');
      return { text, pdf_text_used: true, ocr_used: false, deferred_image: false, notes };
    }
    notes.push('pdf_no_text_layer → image_ocr_deferred_to_door_3');
    return { text: '', pdf_text_used: false, ocr_used: false, deferred_image: true, notes };
  }
  if (mime.startsWith('image/')) {
    notes.push('image → image_ocr_deferred_to_door_3');
    return { text: '', pdf_text_used: false, ocr_used: false, deferred_image: true, notes };
  }
  return { text: '', pdf_text_used: false, ocr_used: false, deferred_image: false, notes: [`unsupported_mime=${mime}`] };
}

// ── Field extractors ─────────────────────────────────────────
function field(value: string | null, confidence: number, source: string, raw?: string): CanonicalField {
  if (!value || !value.trim()) return missingField(source);
  const trimmed = value.trim().replace(/\s+/g, ' ');
  const status =
    confidence >= 0.85 ? 'extracted' : confidence >= 0.6 ? 'proposed' : 'needs_review';
  return { value: trimmed, confidence: Number(confidence.toFixed(3)), source, status, raw: raw ?? null };
}

function captureAfter(text: string, labels: RegExp[]): { value: string | null; raw: string | null } {
  for (const re of labels) {
    const m = text.match(re);
    if (m && m[1]) {
      return { value: m[1], raw: m[0] };
    }
  }
  return { value: null, raw: null };
}

function detectLanguageTestName(text: string): { name: string | null; conf: number } {
  const tests: Array<{ pat: RegExp; name: string }> = [
    { pat: /\bIELTS\b/i, name: 'IELTS' },
    { pat: /\bTOEFL(?:\s*iBT)?\b/i, name: 'TOEFL' },
    { pat: /\bDuolingo\b/i, name: 'Duolingo English Test' },
    { pat: /\bPTE\b/i, name: 'PTE Academic' },
    { pat: /\bDELF\b/i, name: 'DELF' },
    { pat: /\bDALF\b/i, name: 'DALF' },
    { pat: /\bGoethe\b/i, name: 'Goethe-Zertifikat' },
    { pat: /\bTestDaF\b/i, name: 'TestDaF' },
    { pat: /\bHSK\b/i, name: 'HSK' },
    { pat: /\bTOPIK\b/i, name: 'TOPIK' },
  ];
  for (const t of tests) {
    if (t.pat.test(text)) return { name: t.name, conf: 0.92 };
  }
  return { name: null, conf: 0 };
}

function extractScore(text: string, testName: string | null): { value: string | null; conf: number; raw: string | null } {
  // IELTS / TOEFL / Duolingo / PTE specific patterns first
  if (testName === 'IELTS') {
    const m = text.match(/\bOverall(?:\s*Band)?\s*[:\-]?\s*(\d(?:\.\d)?)\b/i)
      || text.match(/\bBand(?:\s*Score)?\s*[:\-]?\s*(\d(?:\.\d)?)\b/i);
    if (m) return { value: m[1], conf: 0.9, raw: m[0] };
  }
  if (testName === 'TOEFL') {
    const m = text.match(/\b(?:Total|Overall)\s*Score\s*[:\-]?\s*(\d{2,3})\b/i)
      || text.match(/\bTOEFL\b[^\d]{0,20}(\d{2,3})\b/i);
    if (m) return { value: m[1], conf: 0.85, raw: m[0] };
  }
  if (testName === 'Duolingo English Test') {
    const m = text.match(/\b(?:Overall|Total)\s*[:\-]?\s*(\d{2,3})\b/i);
    if (m) return { value: m[1], conf: 0.8, raw: m[0] };
  }
  // generic fallback
  const m = text.match(/\b(?:Score|Total)\s*[:\-]?\s*(\d+(?:\.\d)?)\b/i);
  if (m) return { value: m[1], conf: 0.6, raw: m[0] };
  return { value: null, conf: 0, raw: null };
}

function extractDate(text: string, labels: RegExp[]): { value: string | null; conf: number; raw: string | null } {
  for (const re of labels) {
    const m = text.match(re);
    if (m && m[1]) {
      // Best-effort normalize to YYYY-MM-DD if simple ISO; otherwise keep raw value
      const v = m[1].trim();
      const iso = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (iso) {
        return {
          value: `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`,
          conf: 0.9,
          raw: m[0],
        };
      }
      return { value: v, conf: 0.7, raw: m[0] };
    }
  }
  return { value: null, conf: 0, raw: null };
}

export interface SimpleCertificateLaneInput {
  document_id: string;
  file: File;
  /** Foundation already classified the family — we trust it for routing only. */
  family: 'graduation_certificate' | 'language_certificate';
}

export async function runSimpleCertificateLane(
  input: SimpleCertificateLaneInput,
): Promise<LaneFactsOutput> {
  const start = performance.now();
  const { document_id, file, family } = input;
  const notes: string[] = [`file=${file.name}`, `family=${family}`, `mime=${file.type || 'unknown'}`];

  const read = await readForCertificate(file);
  notes.push(...read.notes);
  const text = read.text || '';

  const facts: Record<string, CanonicalField> = {
    student_name: missingField('text'),
    institution_name: missingField('text'),
    certificate_title: missingField('text'),
    issue_date: missingField('text'),
    graduation_year: missingField('text'),
    language_test_name: missingField('text'),
    score: missingField('text'),
    verification_ref: missingField('text'),
  };

  if (text.length < 40) {
    notes.push('insufficient_text_extracted');
    const agg = aggregateLaneTruth(
      facts,
      family === 'graduation_certificate' ? REQUIRED_GRADUATION : REQUIRED_LANGUAGE,
    );
    return {
      document_id,
      lane: family === 'graduation_certificate' ? 'graduation_lane' : 'language_lane',
      truth_state: 'needs_review',
      lane_confidence: 0,
      requires_review: true,
      facts,
      engine_metadata: {
        producer: CERT_LANE_VERSION,
        processing_ms: Math.round(performance.now() - start),
        ocr_used: read.ocr_used,
        pdf_text_used: read.pdf_text_used,
        schema_version: 'lane-facts-v1',
      },
      notes,
    };
  }

  // ── Student name (works for both families) ──
  const name = captureAfter(text, [
    /(?:This is to certify that|hereby certifies that|awarded to|conferred upon|presented to)\s+([A-Z][A-Za-z'.\- ]{3,80}?)(?=\s+(?:has|was|on|for|of|the)\b|[,\n])/,
    /(?:Name|Student Name|Candidate Name|Full Name)\s*[:\-]\s*([A-Z][A-Za-z'.\- ]{3,80})/i,
  ]);
  if (name.value) {
    facts.student_name = field(name.value, 0.78, 'text', name.raw ?? undefined);
  }

  // ── Verification ref / link ──
  const verif = captureAfter(text, [
    /(?:Verification\s*(?:Code|Number|Reference|Ref|ID))\s*[:\-]?\s*([A-Z0-9\-]{6,40})/i,
    /(?:Certificate\s*(?:Number|ID|No\.?))\s*[:\-]?\s*([A-Z0-9\-]{4,40})/i,
    /(https?:\/\/\S{8,200}verify\S*)/i,
  ]);
  if (verif.value) {
    facts.verification_ref = field(verif.value, 0.85, 'text', verif.raw ?? undefined);
  }

  if (family === 'graduation_certificate') {
    // Institution
    const inst = captureAfter(text, [
      /\b(?:University|College|Institute|School|Academy)\s+of\s+([A-Z][A-Za-z'.&\- ]{3,80})/,
      /\b([A-Z][A-Za-z'.&\- ]{3,60}\s+(?:University|College|Institute|School|Academy))\b/,
    ]);
    if (inst.value) {
      const fullMatch = inst.raw && /University|College|Institute|School|Academy/i.test(inst.raw)
        ? inst.raw.trim()
        : inst.value;
      facts.institution_name = field(fullMatch, 0.8, 'text', inst.raw ?? undefined);
    }

    // Certificate title
    const titleMatch = text.match(
      /\b(Bachelor(?:'s)?(?:\s+of\s+[A-Za-z ]+)?|Master(?:'s)?(?:\s+of\s+[A-Za-z ]+)?|Doctor(?:ate)?(?:\s+of\s+[A-Za-z ]+)?|Diploma(?:\s+of\s+[A-Za-z ]+)?|High School Diploma|Secondary School Certificate|Ph\.?D\.?)\b/i,
    );
    if (titleMatch) {
      facts.certificate_title = field(titleMatch[1], 0.85, 'text', titleMatch[0]);
    }

    // Issue date / graduation year
    const dt = extractDate(text, [
      /(?:Issued|Issue Date|Date of Issue|Awarded on|Conferred on|Date)\s*[:\-]?\s*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    ]);
    if (dt.value) facts.issue_date = field(dt.value, dt.conf, 'text', dt.raw ?? undefined);

    const yearMatch = text.match(/\b(?:Graduated|Class of|Year of Graduation)\s*[:\-]?\s*(19|20)\d{2}\b/i)
      || text.match(/\b(20\d{2}|19\d{2})\b/);
    if (yearMatch) {
      const yr = (yearMatch[0].match(/(19|20)\d{2}/) || [])[0];
      if (yr) facts.graduation_year = field(yr, 0.7, 'text', yearMatch[0]);
    }
  }

  if (family === 'language_certificate') {
    const t = detectLanguageTestName(text);
    if (t.name) {
      facts.language_test_name = field(t.name, t.conf, 'text');
      facts.certificate_title = field(`${t.name} Score Report`, 0.9, 'text');

      const sc = extractScore(text, t.name);
      if (sc.value) facts.score = field(sc.value, sc.conf, 'text', sc.raw ?? undefined);
    }

    // Issue / test date
    const dt = extractDate(text, [
      /(?:Test Date|Date of Test|Examination Date|Issue Date|Date)\s*[:\-]?\s*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    ]);
    if (dt.value) facts.issue_date = field(dt.value, dt.conf, 'text', dt.raw ?? undefined);

    // Test centre / institution
    const inst = captureAfter(text, [
      /(?:Test Centre|Test Center|Centre Name|Center Name|Centre)\s*[:\-]?\s*([A-Z][A-Za-z'.&\- ]{3,80})/i,
    ]);
    if (inst.value) facts.institution_name = field(inst.value, 0.7, 'text', inst.raw ?? undefined);
  }

  const required = family === 'graduation_certificate' ? REQUIRED_GRADUATION : REQUIRED_LANGUAGE;
  const agg = aggregateLaneTruth(facts, required);
  const elapsed = performance.now() - start;

  return {
    document_id,
    lane: family === 'graduation_certificate' ? 'graduation_lane' : 'language_lane',
    truth_state: agg.truth_state,
    lane_confidence: agg.lane_confidence,
    requires_review: agg.requires_review,
    facts,
    engine_metadata: {
      producer: CERT_LANE_VERSION,
      processing_ms: Math.round(elapsed),
      ocr_used: read.ocr_used,
      pdf_text_used: read.pdf_text_used,
      schema_version: 'lane-facts-v1',
    },
    notes,
  };
}
