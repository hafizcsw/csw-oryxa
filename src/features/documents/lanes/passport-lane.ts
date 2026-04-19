// ═══════════════════════════════════════════════════════════════
// Door 2 — Passport Lane (Architecture-Compliant, no external OCR)
// ═══════════════════════════════════════════════════════════════
// Reading strategy (Door 2, post-correction):
//   • PDF born-digital  → pdf.js text layer (client, free)
//   • Image / scanned PDF → NOT extracted in Door 2.
//     Returns truth_state='needs_review' with
//     review_reason='image_ocr_deferred_to_door_3'.
//
// No external raw-file path. No edge function. No Tesseract.
// MRZ parsing remains client-side (parseMrz).
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

const PASSPORT_LANE_VERSION = 'passport-lane-v3-local-only';
const REASON_IMAGE_DEFERRED = 'image_ocr_deferred_to_door_3';

interface ReadResult {
  text: string;
  pdf_text_used: boolean;
  /** True when the file was an image or scanned PDF without text layer.
   *  Door 2 does NOT attempt to read these — they are deferred. */
  deferred_image: boolean;
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

async function readForPassport(file: File): Promise<ReadResult> {
  const notes: string[] = [];
  const mime = file.type || '';

  if (mime === 'application/pdf') {
    const text = await readPdfText(file);
    if (text && text.length > 80) {
      notes.push('pdf_text_layer_used');
      return { text, pdf_text_used: true, deferred_image: false, notes };
    }
    notes.push('pdf_no_text_layer → image_ocr_deferred_to_door_3');
    return { text: '', pdf_text_used: false, deferred_image: true, notes };
  }

  if (mime.startsWith('image/')) {
    notes.push('image → image_ocr_deferred_to_door_3');
    return { text: '', pdf_text_used: false, deferred_image: true, notes };
  }

  notes.push(`unsupported_mime=${mime || 'unknown'}`);
  return { text: '', pdf_text_used: false, deferred_image: false, notes };
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

  // ── Early exit: deferred (image / scanned PDF) ──
  if (read.deferred_image) {
    return {
      document_id,
      lane: 'passport_lane',
      truth_state: 'needs_review',
      lane_confidence: 0,
      requires_review: true,
      review_reason: REASON_IMAGE_DEFERRED,
      facts,
      engine_metadata: {
        producer: PASSPORT_LANE_VERSION,
        processing_ms: Math.round(performance.now() - start),
        ocr_used: false,
        pdf_text_used: false,
        schema_version: 'lane-facts-v1',
      },
      notes,
    };
  }

  if (read.text && read.text.length > 30) {
    const mrz = parseMrz(read.text);
    notes.push(`mrz_found=${mrz.found}`);
    notes.push(`mrz_format=${mrz.format ?? 'none'}`);
    notes.push(`mrz_checksum_verified=${mrz.checksum_verified}`);

    if (mrz.found) {
      facts.mrz_present = { value: 'true', confidence: 1, source: 'mrz', status: 'extracted' };
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
    review_reason: agg.requires_review ? null : null,
    facts,
    engine_metadata: {
      producer: PASSPORT_LANE_VERSION,
      processing_ms: Math.round(elapsed),
      ocr_used: false,
      pdf_text_used: read.pdf_text_used,
      schema_version: 'lane-facts-v1',
    },
    notes,
  };
}
