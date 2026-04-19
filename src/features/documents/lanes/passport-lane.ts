// ═══════════════════════════════════════════════════════════════
// Door 2 — Passport Lane (Hybrid as decided)
// ═══════════════════════════════════════════════════════════════
// Reading strategy:
//   • PDF born-digital  → pdf.js text layer (client, free)
//   • Image / scanned PDF → rasterize on client → POST base64 to
//     `passport-ocr` edge function (Lovable AI Vision). NO Tesseract.
// MRZ parsing remains client-side (parseMrz).
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
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

const PASSPORT_LANE_VERSION = 'passport-lane-v2-edge';

interface ReadResult {
  text: string;
  pdf_text_used: boolean;
  ocr_used: boolean;
  ocr_engine: string | null;
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

async function rasterizePdfFirstPage(file: File): Promise<{ blob: Blob; mime: string } | null> {
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
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
    );
    if (!blob) return null;
    return { blob, mime: 'image/jpeg' };
  } catch {
    return null;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  // base64 encode without exceeding stack
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function callPassportOcrEdge(
  blob: Blob,
  mime: string,
  document_id: string,
): Promise<{ text: string; engine: string | null; error: string | null }> {
  const image_base64 = await blobToBase64(blob);
  const { data, error } = await supabase.functions.invoke('passport-ocr', {
    body: { image_base64, mime_type: mime, document_id },
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[PassportLane] edge invoke error', error);
    return { text: '', engine: null, error: error.message ?? 'invoke_failed' };
  }
  if (!data?.ok) {
    return { text: '', engine: null, error: data?.error ?? 'edge_failed' };
  }
  return { text: data.mrz_text ?? '', engine: data.engine ?? 'lovable-ai', error: null };
}

async function readForPassport(file: File, document_id: string): Promise<ReadResult> {
  const notes: string[] = [];
  const mime = file.type || '';

  if (mime === 'application/pdf') {
    const text = await readPdfText(file);
    if (text && text.length > 80) {
      notes.push('pdf_text_layer_used');
      return { text, pdf_text_used: true, ocr_used: false, ocr_engine: null, notes };
    }
    notes.push('pdf_no_text_layer → raster+edge_ocr');
    const raster = await rasterizePdfFirstPage(file);
    if (!raster) {
      notes.push('rasterize_failed');
      return { text: '', pdf_text_used: false, ocr_used: false, ocr_engine: null, notes };
    }
    const { text: ocrText, engine, error } = await callPassportOcrEdge(raster.blob, raster.mime, document_id);
    if (error) notes.push(`edge_error=${error}`);
    notes.push(`edge_chars=${ocrText.length}`);
    return { text: ocrText, pdf_text_used: false, ocr_used: true, ocr_engine: engine, notes };
  }

  if (mime.startsWith('image/')) {
    notes.push('image → edge_ocr');
    const { text: ocrText, engine, error } = await callPassportOcrEdge(file, mime, document_id);
    if (error) notes.push(`edge_error=${error}`);
    notes.push(`edge_chars=${ocrText.length}`);
    return { text: ocrText, pdf_text_used: false, ocr_used: true, ocr_engine: engine, notes };
  }

  notes.push(`unsupported_mime=${mime || 'unknown'}`);
  return { text: '', pdf_text_used: false, ocr_used: false, ocr_engine: null, notes };
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

  const read = await readForPassport(file, document_id);
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
    facts,
    engine_metadata: {
      producer: PASSPORT_LANE_VERSION,
      processing_ms: Math.round(elapsed),
      ocr_used: read.ocr_used,
      pdf_text_used: read.pdf_text_used,
      schema_version: 'lane-facts-v1',
      ocr_engine: read.ocr_engine,
    } as any,
    notes,
  };
}
