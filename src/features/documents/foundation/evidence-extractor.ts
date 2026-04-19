// ═══════════════════════════════════════════════════════════════
// Foundation — Content Evidence Extractor (local, no external IO)
// ═══════════════════════════════════════════════════════════════
// Pulls the MINIMUM content evidence Foundation needs to make a
// content-first routing decision:
//   • PDF text layer (first 2 pages) via pdfjs-dist
//   • MRZ detection on that text
//   • Content kind classification (pdf_text | pdf_no_text | image | unsupported)
//
// NO image OCR (deferred to Door 3).
// NO external service. NO raw-file path.
// ═══════════════════════════════════════════════════════════════

import { parseMrz, type MrzResult } from '../parsers/mrz-parser';

export type ContentKind = 'pdf_text' | 'pdf_no_text' | 'image' | 'unsupported';

export interface FoundationEvidence {
  pdf_text: string | null;
  mrz: MrzResult | null;
  content_kind: ContentKind;
  notes: string[];
}

async function readPdfTextLayer(file: File): Promise<string> {
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
    return text;
  } catch {
    return '';
  }
}

export async function extractFoundationEvidence(file: File): Promise<FoundationEvidence> {
  const notes: string[] = [];
  const mime = file.type || '';

  if (mime === 'application/pdf') {
    const text = await readPdfTextLayer(file);
    if (text && text.length >= 30) {
      const mrz = parseMrz(text);
      notes.push(`pdf_text_chars=${text.length}`);
      notes.push(`mrz_found=${mrz.found}`);
      return {
        pdf_text: text,
        mrz: mrz.found ? mrz : null,
        content_kind: 'pdf_text',
        notes,
      };
    }
    notes.push('pdf_no_text_layer');
    return { pdf_text: null, mrz: null, content_kind: 'pdf_no_text', notes };
  }

  if (mime.startsWith('image/')) {
    notes.push('image_content_pending_door3');
    return { pdf_text: null, mrz: null, content_kind: 'image', notes };
  }

  notes.push(`unsupported_mime=${mime || 'unknown'}`);
  return { pdf_text: null, mrz: null, content_kind: 'unsupported', notes };
}
