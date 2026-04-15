// ═══════════════════════════════════════════════════════════════
// Document Analysis Engine — Door 3: Orchestrator
// ═══════════════════════════════════════════════════════════════
// Takes a file + document_id, runs classification + extraction,
// returns DocumentAnalysis + ExtractionProposal[].
// No external LLM. No OpenAI. No Oryxa.
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
import { extractPdfText } from './parsers/pdf-text-parser';
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
}

/**
 * Get current canonical value for a field path.
 * Returns null if not found or empty.
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
 * Returns analysis record + extraction proposals.
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

  try {
    analysis.analysis_status = 'analyzing';

    // ── Step 1: Extract text ──
    let textContent = '';
    
    if (file.type === 'application/pdf') {
      const pdfResult = await extractPdfText(file);
      if (pdfResult.ok) {
        textContent = pdfResult.text;
        analysis.parser_type = 'pdf_text';
        analysis.readability_status = textContent.trim().length > 20 ? 'readable' : 'unreadable';
      } else {
        analysis.readability_status = 'unreadable';
        analysis.parser_type = 'filename_only';
      }
    } else if (file.type.startsWith('image/')) {
      // HONEST GAP: No OCR in V1. Image documents yield filename-only classification.
      // MRZ/field extraction will NOT work on image uploads until Tesseract.js is added.
      analysis.parser_type = 'filename_only';
      analysis.readability_status = 'unknown';
    } else {
      analysis.parser_type = 'filename_only';
      analysis.readability_status = 'unknown';
    }

    // ── Step 2: Classify ──
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
      // Try MRZ first
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

      // Apply promotion rules
      proposal = applyPromotionRules(proposal);
      proposals.push(proposal);
    }

    // ── Step 6: Internal summary ──
    const accepted = proposals.filter(p => p.proposal_status === 'auto_accepted').length;
    const pending = proposals.filter(p => p.proposal_status === 'pending_review').length;
    const rejected = proposals.filter(p => p.proposal_status === 'rejected').length;
    
    analysis.summary_message_internal = [
      `Classification: ${classification.best} (${(classification.confidence * 100).toFixed(0)}%)`,
      `Fields extracted: ${fieldCount}`,
      `Proposals: ${accepted} auto-accepted, ${pending} pending, ${rejected} rejected`,
      `Evidence: ${classification.evidence.join(', ')}`,
    ].join(' | ');

    analysis.analysis_status = 'completed';
    analysis.updated_at = new Date().toISOString();

  } catch (err) {
    analysis.analysis_status = 'failed';
    analysis.rejection_reason = err instanceof Error ? err.message : 'Analysis failed';
    analysis.updated_at = new Date().toISOString();
  }

  return { analysis, proposals };
}
