// ═══════════════════════════════════════════════════════════════
// Door 2 — Passport Lane
// ═══════════════════════════════════════════════════════════════
// Narrow, local-only passport extraction.
// Inputs:  File + foundation hints (already routed to passport_id)
// Reading strategy (hybrid):
//   • PDF: try pdf.js text layer first (born-digital fast path)
//   • Image: client-side Tesseract.js (no external upload)
//   • PDF without text: rasterize first page, then Tesseract
// Then run MRZ parser ONLY. No general doc parser. No transcript logic.
// Honest: if MRZ not found → all fields missing/needs_review.
// ═══════════════════════════════════════════════════════════════

import { parseMrz } from '../parsers/mrz-parser';
import { lookupCountry } from '../parsers/iso-country-codes';
import {
  type LaneFactsOutput,
  type CanonicalField,
  missingField,
  aggregateLaneTruth,
} from './lane-fact-model';

const REQUIRED_PASSPORT_FIELDS = [
  'full_name',
  'passport_number',
  'nationality',
  'date_of_birth',
  'expiry_date',
  'issuing_country',
];

const PASSPORT_LANE_VERSION = 'passport-lane-v1';

interface ReadResult {
  text: string;
  pdf_text_used: boolean;
  ocr_used: boolean;
  notes: string[];
}

async function readPdfText(file: File): Promise<string> {
  try {
    const pdfjsLib: any = await import('pdfjs-dist');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf, disableWorker: true }).promise;
    const pagesToScan = Math.min(pdf.numPages, 3);
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

async function rasterizePdfFirstPage(file: File): Promise<HTMLCanvasElement | null> {
  try {
    const pdfjsLib: any = await import('pdfjs-dist');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf, disableWorker: true }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  } catch {
    return null;
  }
}

async function ocrSource(source: HTMLCanvasElement | File): Promise<string> {
  try {
    const Tesseract: any = await import('tesseract.js');
    const result = await Tesseract.recognize(source as any, 'eng', {
      // tessedit_pageseg_mode 6 = uniform block of text → good for MRZ band
    });
    return (result?.data?.text as string) || '';
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[PassportLane] tesseract failed', e);
    return '';
  }
}

async function readForPassport(file: File): Promise<ReadResult> {
  const notes: string[] = [];
  const mime = file.type || '';

  if (mime === 'application/pdf') {
    const text = await readPdfText(file);
    if (text && text.length > 80) {
      notes.push('pdf_text_layer_used');
      return { text, pdf_text_used: true, ocr_used: false, notes };
    }
    notes.push('pdf_no_text_layer → raster+ocr');
    const canvas = await rasterizePdfFirstPage(file);
    if (canvas) {
      const ocrText = await ocrSource(canvas);
      return {
        text: ocrText,
        pdf_text_used: false,
        ocr_used: true,
        notes: [...notes, `tesseract_chars=${ocrText.length}`],
      };
    }
    notes.push('rasterize_failed');
    return { text: '', pdf_text_used: false, ocr_used: false, notes };
  }

  if (mime.startsWith('image/')) {
    notes.push('image_ocr_local_tesseract');
    const ocrText = await ocrSource(file);
    return {
      text: ocrText,
      pdf_text_used: false,
      ocr_used: true,
      notes: [...notes, `tesseract_chars=${ocrText.length}`],
    };
  }

  notes.push(`unsupported_mime=${mime || 'unknown'}`);
  return { text: '', pdf_text_used: false, ocr_used: false, notes };
}

function field(value: string | null, confidence: number, source: string, raw?: string): CanonicalField {
  if (!value) return missingField(source);
  const status =
    confidence >= 0.85 ? 'extracted' : confidence >= 0.6 ? 'proposed' : 'needs_review';
  return { value, confidence: Number(confidence.toFixed(3)), source, status, raw: raw ?? null };
}

export interface PassportLaneInput {
  document_id: string;
  file: File;
}

export async function runPassportLane(input: PassportLaneInput): Promise<LaneFactsOutput> {
  const start = performance.now();
  const { document_id, file } = input;
  const notes: string[] = [`file=${file.name}`, `mime=${file.type || 'unknown'}`];

  const read = await readForPassport(file);
  notes.push(...read.notes);

  const facts: Record<string, CanonicalField> = {
    full_name: missingField('mrz'),
    passport_number: missingField('mrz'),
    nationality: missingField('mrz'),
    date_of_birth: missingField('mrz'),
    expiry_date: missingField('mrz'),
    issuing_country: missingField('mrz'),
    sex: missingField('mrz'),
    mrz_present: { value: 'false', confidence: 1, source: 'mrz', status: 'extracted' },
  };

  if (read.text && read.text.length > 30) {
    const mrz = parseMrz(read.text);
    notes.push(`mrz_found=${mrz.found}`);
    notes.push(`mrz_format=${mrz.format ?? 'none'}`);
    notes.push(`mrz_checksum_verified=${mrz.checksum_verified}`);

    if (mrz.found) {
      facts.mrz_present = { value: 'true', confidence: 1, source: 'mrz', status: 'extracted' };

      // Confidence per field follows MRZ overall confidence + checksum results.
      const baseConf = Math.max(0.55, Math.min(0.99, mrz.confidence));
      const cb = mrz.checksum_breakdown;

      const fullName =
        mrz.surname && mrz.given_names
          ? `${mrz.given_names} ${mrz.surname}`.replace(/\s+/g, ' ').trim()
          : mrz.surname || mrz.given_names || null;

      facts.full_name = field(fullName, baseConf, 'mrz');
      facts.passport_number = field(
        mrz.passport_number,
        cb.passport_number === true ? Math.min(0.99, baseConf + 0.05) : baseConf,
        'mrz',
        mrz.passport_number ?? undefined,
      );
      facts.date_of_birth = field(
        mrz.date_of_birth,
        cb.date_of_birth === true ? Math.min(0.99, baseConf + 0.05) : baseConf,
        'mrz',
      );
      facts.expiry_date = field(
        mrz.expiry_date,
        cb.expiry_date === true ? Math.min(0.99, baseConf + 0.05) : baseConf,
        'mrz',
      );

      // Country codes
      const nat = lookupCountry(mrz.nationality_alpha3);
      facts.nationality = field(nat?.name_en ?? mrz.nationality, baseConf, 'mrz');

      const iss = lookupCountry(mrz.issuing_country_alpha3);
      facts.issuing_country = field(iss?.name_en ?? mrz.issuing_country, baseConf, 'mrz');

      facts.sex = mrz.gender
        ? { value: mrz.gender, confidence: baseConf, source: 'mrz', status: baseConf >= 0.85 ? 'extracted' : 'proposed' }
        : missingField('mrz');
    } else {
      notes.push('mrz_not_detected_in_extracted_text');
    }
  } else {
    notes.push('no_text_extracted');
  }

  const agg = aggregateLaneTruth(facts, REQUIRED_PASSPORT_FIELDS);
  const elapsed = performance.now() - start;

  return {
    document_id,
    lane: 'passport_lane',
    truth_state: agg.truth_state,
    lane_confidence: agg.lane_confidence,
    requires_review: agg.requires_review,
    facts,
    engine_metadata: {
      producer: PASSPORT_LANE_VERSION,
      processing_ms: Math.round(elapsed),
      ocr_used: read.ocr_used,
      pdf_text_used: read.pdf_text_used,
      schema_version: 'lane-facts-v1',
    },
    notes,
  };
}
