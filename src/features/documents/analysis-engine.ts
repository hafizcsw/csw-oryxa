// ═══════════════════════════════════════════════════════════════
// Document Analysis Engine — Door 1+: Orchestrator
// ═══════════════════════════════════════════════════════════════
// Reads via the DocumentReader contract (no direct parser
// imports), then runs classification → extraction → proposals.
//
// The reading stage is now FULLY isolated. Swapping the legacy
// browser reader for a server-side worker requires zero changes
// in this file.
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
import type { ReadingArtifact } from './reading-artifact-model';
import { readDocumentArtifact } from './document-reader-contract';
import { parseMrz } from './parsers/mrz-parser';
import { classifyDocument } from './parsers/content-classifier';
import {
  extractPassportFields,
  extractPassportTextFallback,
  extractGraduationFields,
  extractLanguageCertFields,
} from './parsers/field-extractors';
import { parseTranscript } from './parsers/transcript-parser';
import type { TranscriptIntermediate } from './parsers/transcript-structure';
import type { CanonicalStudentFile } from '../student-file/canonical-model';
import type { StructuredDocumentArtifact } from './structured-browser-artifact-model';
import { buildStructuredBrowserArtifact } from './parsers/structured-artifact-builder';
import { resolveStructuredArtifact } from './document-ai/resolver';
import type { DocumentAIMode } from './document-ai/document-ai-provider';
import { buildPassportOutput, type PassportOutput } from './passport-output-schema';

/** Live engine activity stage. Emitted via `onStage` callback so the UI
 *  can show students what the engine is actually doing right now. */
export type EngineStage =
  | 'reading'           // opening + extracting text from the file
  | 'ocr'               // running OCR (image/scan)
  | 'classifying'       // detecting document type
  | 'mrz'               // parsing the passport MRZ zone
  | 'extracting'        // pulling fields (name, dates, GPA, …)
  | 'transcript_rows'   // parsing transcript subject rows
  | 'building_proposals'// creating field proposals + promotion rules
  | 'completed'         // ✅ done
  | 'failed';           // ✗ failed

export interface EngineStageEvent {
  stage: EngineStage;
  /** Optional human detail (e.g. "page 2/4", "MRZ TD3 line 1"). Always
   *  parser-side English; the UI maps the stage to a translated label. */
  detail?: string | null;
  /** Monotonic ms since analyzeDocument() started. */
  elapsed_ms: number;
}

export interface AnalysisResult {
  analysis: DocumentAnalysis;
  proposals: ExtractionProposal[];
  /** Door 1: the structured reading artifact */
  artifact: ReadingArtifact;
  /** Document Intelligence: structured artifact (browser_heuristic OR paddle) */
  structured_artifact: StructuredDocumentArtifact;
  /** Which provider produced structured_artifact at runtime. */
  document_ai_mode: DocumentAIMode;
  /** Diagnostic surface: what we tried with paddle (if anything). */
  document_ai_diag: {
    paddle_attempted: boolean;
    paddle_status: string | null;
    paddle_reason: string | null;
    paddle_latency_ms: number | null;
    paddle_error_message: string | null;
  };
  /** Unified passport output (only present for passport lane with viable MRZ). */
  passport_output: PassportOutput | null;
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
 * Door 1: read (via contract) → Door 2 classify → Door 2 extract → proposals.
 */
export async function analyzeDocument(params: {
  file: File;
  documentId: string;
  studentId: string;
  slotHint: DocumentSlotType | null;
  canonicalFile: CanonicalStudentFile | null;
  /** Storage path inside `documents` bucket. Required to attempt the
   *  paddle_self_hosted provider; null/undefined disables it cleanly. */
  storagePath?: string | null;
}): Promise<AnalysisResult> {
  const { file, documentId, studentId, slotHint, canonicalFile, storagePath } = params;
  const analysis = createPendingAnalysis(documentId, slotHint);
  const proposals: ExtractionProposal[] = [];
  const startTime = performance.now();
  let passport_output: PassportOutput | null = null;

  // Default diagnostic envelope (mutated when paddle is attempted)
  let document_ai_mode: DocumentAIMode = 'browser_heuristic';
  let document_ai_diag = {
    paddle_attempted: false,
    paddle_status: null as string | null,
    paddle_reason: null as string | null,
    paddle_latency_ms: null as number | null,
    paddle_error_message: null as string | null,
  };

  // ── Step 1: Read the document via the reading contract ───
  analysis.analysis_status = 'analyzing';
  const artifact = await readDocumentArtifact(file);

  // Mirror reading verdict onto analysis surface
  if (artifact.parser_used === 'pdfjs_text') {
    analysis.parser_type = 'pdf_text';
  } else if (artifact.parser_used === 'tesseract_ocr' || artifact.parser_used === 'pdfjs_render_ocr') {
    analysis.parser_type = 'image_ocr';
  } else {
    analysis.parser_type = 'none';
  }

  // ── Honesty gate ─────────────────────────────────────────
  // unreadable artifacts MUST NOT flow downstream as a normal success.
  if (artifact.readability === 'unreadable') {
    analysis.readability_status = 'unreadable';
    analysis.usefulness_status = 'not_useful';
    analysis.rejection_reason = artifact.failure_reason ?? 'unreadable_scan';
    analysis.analysis_status = artifact.failure_reason === 'unsupported_file_type' ? 'skipped' : 'failed';
    analysis.summary_message_internal = [
      `Route: ${artifact.chosen_route}`,
      `Parser: ${artifact.parser_used}`,
      `Reader: ${artifact.reader_implementation}`,
      `Failure: ${artifact.failure_reason}`,
      artifact.failure_detail ? `Detail: ${artifact.failure_detail}` : null,
    ].filter(Boolean).join(' | ');
    analysis.updated_at = new Date().toISOString();
    logArtifact(artifact, analysis);
    const fallbackArtifact = buildStructuredBrowserArtifact(artifact);
    return {
      analysis,
      proposals,
      artifact,
      structured_artifact: fallbackArtifact,
      document_ai_mode: fallbackArtifact.builder === 'none' ? 'none' : 'browser_heuristic',
      document_ai_diag,
      passport_output,
    };
  }

  // ── Document AI Resolver: paddle (if available) → browser fallback ──
  // Fail-closed: missing PADDLE_STRUCTURE_ENDPOINT secret returns
  // status='unavailable' reason='no_endpoint_configured'; engine then
  // uses the browser_heuristic artifact and tags document_ai_mode
  // accordingly. No crash. No fake success. No hidden fallback.
  const resolved = await resolveStructuredArtifact({
    reading_artifact: artifact,
    ai_request: {
      document_id: documentId,
      storage_path: storagePath ?? null,
      mime_type: file.type || 'application/octet-stream',
      file_name: file.name,
    },
  });
  const structured_artifact = resolved.artifact;
  document_ai_mode = resolved.mode_used;
  document_ai_diag = {
    paddle_attempted: resolved.paddle_attempted,
    paddle_status: resolved.paddle_status,
    paddle_reason: resolved.paddle_reason,
    paddle_latency_ms: resolved.paddle_latency_ms,
    paddle_error_message: resolved.paddle_error_message,
  };

  console.log('[DocumentAI:Resolved]', JSON.stringify({
    file: file.name,
    mode_used: document_ai_mode,
    builder: structured_artifact.builder,
    pages: structured_artifact.summary.pages_analyzed,
    rows_total: structured_artifact.summary.total_row_candidates,
    rows_tabular: structured_artifact.summary.tabular_row_candidates,
    table_regions: structured_artifact.summary.table_like_region_count,
    headers: structured_artifact.summary.header_groups,
    footers: structured_artifact.summary.footer_groups,
    avg_quality: Number(structured_artifact.summary.avg_quality_score.toFixed(3)),
    build_ms: Math.round(structured_artifact.build_time_ms),
    paddle: document_ai_diag,
  }, null, 2));


  // readable | degraded → continue, but mark surface honestly.
  // Honesty: a 'degraded' artifact MUST surface as 'degraded', never 'readable'.
  analysis.readability_status = artifact.readability === 'degraded' ? 'degraded' : 'readable';
  if (artifact.full_text.trim().length > 0) {
    analysis.text_content = artifact.full_text;
  }

  try {
    // ── Step 2: Classify ─────────────────────────────────────
    const textContent = artifact.full_text;
    const classification = classifyDocument({
      fileName: file.name,
      textContent,
      mimeType: file.type,
    });

    analysis.classification_result = classification.best;
    analysis.classification_confidence = classification.confidence;

    // ── Step 3: Extract fields based on classification ─────
    let extractedFields: Record<string, ExtractedField> = {};
    let mrzFound = false;
    let transcriptIntermediate: TranscriptIntermediate | null = null;
    const laneStrength: 'passport_strong' | 'passport_weak' | null =
      classification.passport_strength ?? null;

    if (classification.best === 'passport') {
      // [DIAG-MRZ] log the raw text the parser is about to chew on
      console.log('[DIAG-MRZ] textContent length:', textContent?.length, 'first 800 chars:\n' + (textContent || '').slice(0, 800));
      const mrzResult = parseMrz(textContent);
      mrzFound = mrzResult.found;
      console.log('[DIAG-MRZ] parseMrz result:', {
        found: mrzResult.found,
        format: mrzResult.format,
        passport_number: mrzResult.passport_number,
        date_of_birth: mrzResult.date_of_birth,
        expiry_date: mrzResult.expiry_date,
        checksum_verified: mrzResult.checksum_verified,
        checksum_breakdown: mrzResult.checksum_breakdown,
        confidence: mrzResult.confidence,
      });
      if (mrzResult.found) {
        // Strong evidence path: MRZ is the primary truth source.
        extractedFields = extractPassportFields(mrzResult);
        analysis.parser_type = 'mrz';

        // Build unified PassportOutput payload (university-ready JSON).
        const derivedIssue =
          (extractedFields['identity.passport_issue_date']?.value as string | null) ?? null;
        passport_output = buildPassportOutput({
          mrz: mrzResult,
          derived_issue_date: derivedIssue,
          processing_time_ms: performance.now() - startTime,
          parser_chain: [
            artifact.parser_used,
            `mrz_${(mrzResult.format ?? 'unknown').toLowerCase()}`,
          ],
          ocr_used:
            artifact.parser_used === 'tesseract_ocr' ||
            artifact.parser_used === 'pdfjs_render_ocr',
        });

        // MRZ trust boost: a verified-checksum MRZ raises classification
        // confidence to at least 0.95 — the document is mathematically a
        // valid passport, no matter how weak the surrounding keywords.
        if (mrzResult.checksum_verified) {
          analysis.classification_confidence = Math.max(
            analysis.classification_confidence,
            0.95,
          );
        }
      } else if (laneStrength === 'passport_strong') {
        // No MRZ but classifier saw strong passport text evidence.
        // Allow weak text fallback — these fields are tagged
        // 'regex_heuristic' and the promotion layer will refuse auto-accept.
        extractedFields = extractPassportTextFallback(textContent);
      } else {
        // PASSPORT LANE GATE: weak classification + no MRZ ⇒ no fake success.
        // Do not extract identity fields from weak/ambiguous text.
        extractedFields = {};
      }
    } else if (classification.best === 'graduation_certificate') {
      extractedFields = extractGraduationFields(textContent);
    } else if (classification.best === 'transcript') {
      // Order 2: structured parser + truthful partial intermediate.
      // BrowserDocAI: pass structured artifact so transcript lane can recover
      // tabular row_candidates the line-by-line regex pass missed.
      const result = parseTranscript(textContent, structured_artifact);
      transcriptIntermediate = result.intermediate;
      extractedFields = result.header_fields;
      console.log('[BrowserDocAI:TranscriptLaneConsumed]', JSON.stringify({
        file: file.name,
        used: result.structured_artifact_used?.used ?? false,
        extra_rows_added: result.structured_artifact_used?.extra_rows_added ?? 0,
        tabular_candidates_seen: result.structured_artifact_used?.tabular_candidates_seen ?? 0,
        final_rows: transcriptIntermediate.rows.length,
      }, null, 2));
    } else if (classification.best === 'language_certificate') {
      extractedFields = extractLanguageCertFields(textContent);
    }

    analysis.extracted_fields = extractedFields;
    analysis.field_confidence_map = Object.fromEntries(
      Object.entries(extractedFields).map(([k, v]) => [k, v.confidence])
    );

    // ── Step 4: Assess usefulness ────────────────────────────
    // Honesty: a 'degraded' artifact never gets clean 'useful' status.
    // Honesty: a weak passport classification with no MRZ never gets 'useful'.
    const fieldCount = Object.keys(extractedFields).length;
    const passportWeakNoMrz =
      classification.best === 'passport' && laneStrength === 'passport_weak' && !mrzFound;

    if (classification.best === 'unsupported') {
      analysis.usefulness_status = 'not_useful';
      analysis.rejection_reason = 'Unsupported file type';
    } else if (classification.best === 'unknown' && fieldCount === 0) {
      analysis.usefulness_status = 'unknown';
    } else if (passportWeakNoMrz) {
      // Weak passport classification without MRZ is never a clean success.
      analysis.usefulness_status = 'unknown';
    } else if (fieldCount > 0) {
      analysis.usefulness_status = artifact.readability === 'degraded' ? 'unknown' : 'useful';
    } else {
      analysis.usefulness_status = 'unknown';
    }

    // ── Step 5: Build proposals ──────────────────────────────
    const sourceLane:
      | 'passport' | 'transcript' | 'graduation' | 'language' | 'unknown' =
        classification.best === 'passport' ? 'passport'
        : classification.best === 'transcript' ? 'transcript'
        : classification.best === 'graduation_certificate' ? 'graduation'
        : classification.best === 'language_certificate' ? 'language'
        : 'unknown';

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

      proposal = applyPromotionRules(proposal, {
        readability: artifact.readability,
        parser_source: extracted.parser_source,
        lane_strength: classification.best === 'passport' ? laneStrength : null,
        source_lane: sourceLane,
      });
      proposals.push(proposal);
    }

    // ── Step 6: Internal summary ─────────────────────────────
    const accepted = proposals.filter(p => p.proposal_status === 'auto_accepted').length;
    const pending = proposals.filter(p => p.proposal_status === 'pending_review').length;
    const rejected = proposals.filter(p => p.proposal_status === 'rejected').length;

    analysis.summary_message_internal = [
      `Route: ${artifact.chosen_route}`,
      `Parser: ${artifact.parser_used}`,
      `Reader: ${artifact.reader_implementation}`,
      `Readability: ${artifact.readability}`,
      `Classification: ${classification.best} (${(classification.confidence * 100).toFixed(0)}%)`,
      `Fields: ${fieldCount}`,
      `Proposals: ${accepted} auto, ${pending} pending, ${rejected} rejected`,
      `Pages: ${artifact.pages_processed}/${artifact.total_page_count}`,
      transcriptIntermediate ? `Transcript: ${transcriptIntermediate.evidence_summary}` : null,
    ].filter(Boolean).join(' | ');

    // ── PassportLane proof log (Order 1) ─────────────────────
    // Always emit when classification.best === 'passport' so live runtime
    // proof can be grepped from the console.
    if (classification.best === 'passport') {
      console.log('[Order1:PassportLane]', JSON.stringify({
        file: file.name,
        classification: classification.best,
        classification_confidence: Number(classification.confidence.toFixed(3)),
        lane_strength: laneStrength,
        mrz_found: mrzFound,
        mrz_pattern_in_text: classification.passport_mrz_pattern_in_text,
        passport_text_evidence: classification.passport_text_evidence,
        readability: artifact.readability,
        usefulness: analysis.usefulness_status,
        extracted_fields: Object.entries(extractedFields).map(([k, v]) => ({
          field: k,
          parser_source: v.parser_source,
          confidence: Number(v.confidence.toFixed(3)),
        })),
        proposals: proposals.map(p => ({
          field: p.field_key,
          status: p.proposal_status,
          auto_apply_candidate: p.auto_apply_candidate,
          confidence: Number(p.confidence.toFixed(3)),
        })),
      }, null, 2));
    }

    // ── TranscriptLane proof log (Order 2) ───────────────────
    // Emit when classifier landed on transcript OR when grad-preferred
    // disambiguation flipped a near-miss transcript away. Both are
    // observable proof events for Order 2 closure.
    if (
      classification.best === 'transcript' ||
      classification.transcript_lane_strength === 'graduation_preferred'
    ) {
      console.log('[Order2:TranscriptLane]', JSON.stringify({
        file: file.name,
        classification: classification.best,
        classification_confidence: Number(classification.confidence.toFixed(3)),
        transcript_lane_strength: classification.transcript_lane_strength,
        disambiguation_reason: classification.transcript_disambiguation_reason,
        readability: artifact.readability,
        usefulness: analysis.usefulness_status,
        intermediate: transcriptIntermediate ? {
          partial: transcriptIntermediate.partial,
          coverage: transcriptIntermediate.coverage,
          signals: transcriptIntermediate.signals,
          header: {
            institution_name: transcriptIntermediate.header.institution_name?.value ?? null,
            degree_program: transcriptIntermediate.header.degree_program?.value ?? null,
            gpa_raw: transcriptIntermediate.header.gpa_raw?.value ?? null,
            gpa_scale: transcriptIntermediate.header.gpa_scale?.value ?? null,
            grading_system_hint: transcriptIntermediate.header.grading_system_hint?.value ?? null,
          },
          rows_count: transcriptIntermediate.rows.length,
          sample_rows: transcriptIntermediate.rows.slice(0, 3).map(r => ({
            subject: r.subject_raw,
            code: r.course_code,
            grade: r.grade_raw,
            credits: r.credits_raw,
            missing: r.missing_columns,
            confidence: Number(r.confidence.toFixed(2)),
          })),
          evidence_summary: transcriptIntermediate.evidence_summary,
        } : null,
        extracted_fields: Object.entries(extractedFields).map(([k, v]) => ({
          field: k,
          parser_source: v.parser_source,
          confidence: Number(v.confidence.toFixed(3)),
        })),
        proposals: proposals.map(p => ({
          field: p.field_key,
          status: p.proposal_status,
          auto_apply_candidate: p.auto_apply_candidate,
          confidence: Number(p.confidence.toFixed(3)),
        })),
      }, null, 2));
    }

    analysis.analysis_status = 'completed';
    analysis.updated_at = new Date().toISOString();
  } catch (err) {
    analysis.analysis_status = 'failed';
    analysis.rejection_reason = err instanceof Error ? err.message : 'Analysis failed';
    analysis.updated_at = new Date().toISOString();
  }

  logArtifact(artifact, analysis);
  console.info('[Door1:TotalMs]', Math.round(performance.now() - startTime));
  return { analysis, proposals, artifact, structured_artifact, document_ai_mode, document_ai_diag, passport_output };
}

function logArtifact(artifact: ReadingArtifact, analysis: DocumentAnalysis): void {
  const textPreview = artifact.full_text.substring(0, 200).replace(/\n/g, ' ');
  console.log('[Door1:ReadingArtifact]', JSON.stringify({
    file: artifact.input_filename,
    reader: artifact.reader_implementation,
    route: artifact.chosen_route,
    parser: artifact.parser_used,
    readability: artifact.readability,
    failure_reason: artifact.failure_reason,
    failure_detail: artifact.failure_detail,
    pages: `${artifact.pages_processed}/${artifact.total_page_count}`,
    chars: artifact.full_text.length,
    confidence: artifact.confidence,
    ms: Math.round(artifact.processing_time_ms),
    ocr_quality: artifact.ocr_quality ? {
      char_quality: `${(artifact.ocr_quality.char_quality * 100).toFixed(0)}%`,
      word_coherence: `${(artifact.ocr_quality.word_coherence * 100).toFixed(0)}%`,
      avg_token_len: artifact.ocr_quality.avg_token_length.toFixed(1),
      label: artifact.ocr_quality.quality_label,
    } : null,
    text_preview: textPreview || '(empty)',
  }, null, 2));
  console.log('[Door1:Classification]', JSON.stringify({
    best: analysis.classification_result,
    confidence: analysis.classification_confidence,
    fields: Object.keys(analysis.extracted_fields || {}),
    readability: analysis.readability_status,
    usefulness: analysis.usefulness_status,
  }, null, 2));
}
