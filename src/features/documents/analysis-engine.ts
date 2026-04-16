// ═══════════════════════════════════════════════════════════════
// Document Analysis Engine — Door 1+: Orchestrator
// ═══════════════════════════════════════════════════════════════
// Takes a file + document_id, runs reading → classification →
// extraction → proposals.
//
// Door 1 routing:
//   born_digital_pdf → pdfjs text extraction
//   scanned_pdf      → pdfjs render → Tesseract OCR
//   image            → Tesseract OCR
//   unsupported      → skip
// ═══════════════════════════════════════════════════════════════

import type { DocumentSlotType } from './document-registry-model';
import {
  type DocumentAnalysis,
  type ExtractedField,
  createPendingAnalysis,
} from './document-analysis-model';
import {
  type ExtractionProposal,
  createProposal,
  applyPromotionRules,
} from './extraction-proposal-model';
import {
  type ReadingArtifact,
  createEmptyArtifact,
  resolveReadingRoute,
  assembleFullText,
  calculateReadingConfidence,
} from './reading-artifact-model';
import { extractPdfText } from './parsers/pdf-text-parser';
import { ocrImageFile, ocrPdfPages } from './parsers/ocr-reader';
import { parseMrz } from './parsers/mrz-parser';
import { classifyDocument } from './parsers/content-classifier';
import {
  extractPassportFields,
  extractGraduationFields,
  extractTranscriptFields,
  extractLanguageCertFields,
} from './parsers/field-extractors';
import type { CanonicalStudentFile } from '../student-file/canonical-model';

export interface AnalysisResult {
  analysis: DocumentAnalysis;
  proposals: ExtractionProposal[];
  /** Door 1: the structured reading artifact */
  artifact: ReadingArtifact;
}

/**
 * Get current canonical value for a field path.
 */
function getCanonicalValue(file: CanonicalStudentFile | null, fieldKey: string): string | null {
  if (!file) return null;
  const [block, key] = fieldKey.split('.');
  const blockObj = (file as any)[block];
  if (!blockObj) return null;
  const val = blockObj[key];
  if (val == null || val === '') return null;
  return String(val);
}

/**
 * Run the full analysis pipeline on a file.
 * Door 1: read → Door 2 classify → Door 2 extract → proposals.
 */
export async function analyzeDocument(params: {
  file: File;
  documentId: string;
  studentId: string;
  slotHint: DocumentSlotType | null;
  canonicalFile: CanonicalStudentFile | null;
}): Promise<AnalysisResult> {
  const { file, documentId, studentId, slotHint, canonicalFile } = params;
  const analysis = createPendingAnalysis(documentId, slotHint);
  const proposals: ExtractionProposal[] = [];
  const startTime = performance.now();

  // ── Step 0: Determine reading route ──
  const route = resolveReadingRoute(file.type);
  const artifact = createEmptyArtifact(file.name, file.type, route);

  try {
    analysis.analysis_status = 'analyzing';

    // ── Step 1: Read the document ──
    if (route === 'unsupported') {
      artifact.failure_reason = `Unsupported MIME type: ${file.type}`;
      analysis.analysis_status = 'skipped';
      analysis.parser_type = 'none';
      analysis.readability_status = 'unreadable';
      analysis.usefulness_status = 'not_useful';
      analysis.rejection_reason = 'Unsupported file type';
      artifact.processing_time_ms = performance.now() - startTime;
      return { analysis, proposals, artifact };
    }

    if (route === 'image') {
      // ── Image → OCR lane ──
      const ocrResult = await ocrImageFile(file);
      artifact.parser_used = 'tesseract_ocr';
      artifact.processing_time_ms = ocrResult.processing_time_ms;

      if (ocrResult.ok && ocrResult.pages.length > 0) {
        artifact.pages = ocrResult.pages;
        artifact.pages_processed = ocrResult.pages.length;
        artifact.total_page_count = 1;
        artifact.full_text = assembleFullText(ocrResult.pages);
        artifact.confidence = calculateReadingConfidence(ocrResult.pages);
        artifact.is_readable = artifact.full_text.trim().length > 20;
        analysis.parser_type = 'image_ocr';
        analysis.readability_status = artifact.is_readable ? 'readable' : 'unreadable';
      } else {
        artifact.failure_reason = ocrResult.error || 'OCR produced no text';
        artifact.is_readable = false;
        analysis.parser_type = 'image_ocr';
        analysis.readability_status = 'unreadable';
      }
    } else {
      // ── PDF lane: try text extraction first ──
      const pdfResult = await extractPdfText(file);

      // Log detection signals for born-digital heuristic transparency
      if (pdfResult.detection_signals) {
        console.info('[Door1:PdfDetection]', {
          file: file.name,
          is_born_digital: pdfResult.is_born_digital,
          ...pdfResult.detection_signals,
        });
      }

      if (pdfResult.ok && pdfResult.is_born_digital) {
        // Born-digital PDF — text extraction succeeded
        artifact.chosen_route = 'born_digital_pdf';
        artifact.parser_used = 'pdfjs_text';
        artifact.pages = pdfResult.pages;
        artifact.total_page_count = pdfResult.pageCount;
        artifact.pages_processed = pdfResult.pages.length;
        artifact.full_text = assembleFullText(pdfResult.pages);
        artifact.confidence = calculateReadingConfidence(pdfResult.pages);
        artifact.is_readable = true;
        artifact.processing_time_ms = pdfResult.processing_time_ms;
        analysis.parser_type = 'pdf_text';
        analysis.readability_status = 'readable';
      } else {
        // Scanned PDF — fall through to OCR
        artifact.chosen_route = 'scanned_pdf';
        const ocrResult = await ocrPdfPages(file);
        artifact.parser_used = 'pdfjs_render_ocr';
        artifact.processing_time_ms = (pdfResult.processing_time_ms || 0) + ocrResult.processing_time_ms;

        if (ocrResult.ok && ocrResult.pages.length > 0) {
          artifact.pages = ocrResult.pages;
          artifact.total_page_count = pdfResult.pageCount || ocrResult.pages.length;
          artifact.pages_processed = ocrResult.pages.length;
          artifact.full_text = assembleFullText(ocrResult.pages);
          artifact.confidence = calculateReadingConfidence(ocrResult.pages);
          artifact.is_readable = artifact.full_text.trim().length > 20;
          analysis.parser_type = 'image_ocr';
          analysis.readability_status = artifact.is_readable ? 'readable' : 'unreadable';
        } else {
          artifact.failure_reason = ocrResult.error || 'Scanned PDF OCR produced no text';
          artifact.is_readable = false;
          analysis.parser_type = 'image_ocr';
          analysis.readability_status = 'unreadable';
        }
      }
    }

    // ── Step 2: Classify ──
    const textContent = artifact.full_text;
    const classification = classifyDocument({
      fileName: file.name,
      textContent,
      mimeType: file.type,
    });

    analysis.classification_result = classification.best;
    analysis.classification_confidence = classification.confidence;

    // ── Step 3: Extract fields based on classification ──
    let extractedFields: Record<string, ExtractedField> = {};

    if (classification.best === 'passport') {
      const mrzResult = parseMrz(textContent);
      if (mrzResult.found) {
        extractedFields = extractPassportFields(mrzResult);
        analysis.parser_type = 'mrz';
      }
    } else if (classification.best === 'graduation_certificate') {
      extractedFields = extractGraduationFields(textContent);
    } else if (classification.best === 'transcript') {
      extractedFields = extractTranscriptFields(textContent);
    } else if (classification.best === 'language_certificate') {
      extractedFields = extractLanguageCertFields(textContent);
    }

    analysis.extracted_fields = extractedFields;
    analysis.field_confidence_map = Object.fromEntries(
      Object.entries(extractedFields).map(([k, v]) => [k, v.confidence])
    );

    // ── Step 4: Assess usefulness ──
    const fieldCount = Object.keys(extractedFields).length;
    if (classification.best === 'unsupported') {
      analysis.usefulness_status = 'not_useful';
      analysis.rejection_reason = 'Unsupported file type';
    } else if (classification.best === 'unknown' && fieldCount === 0) {
      analysis.usefulness_status = 'unknown';
    } else if (fieldCount > 0) {
      analysis.usefulness_status = 'useful';
    } else {
      analysis.usefulness_status = 'unknown';
    }

    // ── Step 5: Build proposals ──
    for (const [fieldKey, extracted] of Object.entries(extractedFields)) {
      if (extracted.value == null) continue;

      const currentValue = getCanonicalValue(canonicalFile, fieldKey);
      const proposedStr = String(extracted.value);
      const conflict = currentValue !== null && currentValue !== proposedStr;

      let proposal = createProposal({
        studentId,
        documentId,
        fieldKey,
        proposedValue: proposedStr,
        normalizedValue: proposedStr.toLowerCase().trim(),
        confidence: extracted.confidence,
        conflictWithCurrent: conflict,
      });

      proposal = applyPromotionRules(proposal);
      proposals.push(proposal);
    }

    // ── Step 6: Internal summary ──
    const accepted = proposals.filter(p => p.proposal_status === 'auto_accepted').length;
    const pending = proposals.filter(p => p.proposal_status === 'pending_review').length;
    const rejected = proposals.filter(p => p.proposal_status === 'rejected').length;

    analysis.summary_message_internal = [
      `Route: ${artifact.chosen_route}`,
      `Parser: ${artifact.parser_used}`,
      `Classification: ${classification.best} (${(classification.confidence * 100).toFixed(0)}%)`,
      `Fields: ${fieldCount}`,
      `Proposals: ${accepted} auto, ${pending} pending, ${rejected} rejected`,
      `Pages: ${artifact.pages_processed}/${artifact.total_page_count}`,
      `Evidence: ${classification.evidence.join(', ')}`,
    ].join(' | ');

    if (textContent.trim().length > 0) {
      analysis.text_content = textContent;
    }

    analysis.analysis_status = 'completed';
    analysis.updated_at = new Date().toISOString();

  } catch (err) {
    analysis.analysis_status = 'failed';
    analysis.rejection_reason = err instanceof Error ? err.message : 'Analysis failed';
    artifact.failure_reason = err instanceof Error ? err.message : 'Analysis failed';
    analysis.updated_at = new Date().toISOString();
  }

  artifact.processing_time_ms = performance.now() - startTime;

  // Door 1 runtime proof — always log the reading artifact
  const textPreview = artifact.full_text.substring(0, 200).replace(/\n/g, ' ');
  console.log('[Door1:ReadingArtifact]', JSON.stringify({
    file: artifact.input_filename,
    route: artifact.chosen_route,
    parser: artifact.parser_used,
    pages: `${artifact.pages_processed}/${artifact.total_page_count}`,
    chars: artifact.full_text.length,
    confidence: artifact.confidence,
    is_readable: artifact.is_readable,
    failure: artifact.failure_reason,
    ms: Math.round(artifact.processing_time_ms),
    text_preview: textPreview || '(empty)',
  }, null, 2));
  console.log('[Door1:Classification]', JSON.stringify({
    best: analysis.classification_result,
    confidence: analysis.classification_confidence,
    fields: Object.keys(analysis.extracted_fields || {}),
    readability: analysis.readability_status,
  }, null, 2));

  return { analysis, proposals, artifact };
}
