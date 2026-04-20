/**
 * ✅ Upload and Register File - Unified Document Upload
 * 
 * Protocol: prepare → fetch(PUT signed_url) → confirm
 * Uses signed URL directly - no SDK or CRM keys needed.
 */
import { prepareUpload, confirmUpload } from "@/api/crmStorage";
import { uploadToCrmStorage } from "@/lib/crmStorageClient";
import { runFoundation, type FoundationOutput } from "./foundation";
import { dispatchLane, persistLaneFacts, type LaneFactsOutput } from "./lanes";

export interface UploadResult {
  success: boolean;
  stage?: 'prepare' | 'put' | 'confirm' | 'foundation';
  file_id?: string;
  file_url?: string;
  path?: string;
  bucket?: string;
  error?: string;
  details?: string;
  http_status?: number;
  request_id?: string;
  /** Foundation Gate output — present whenever upload succeeded.
   *  If foundation_failed=true, success is FALSE and stage='foundation'. */
  foundation?: FoundationOutput;
  foundation_failed?: boolean;
  foundation_persisted?: boolean;
  /** Door 2 — lane facts (passport / graduation / language) when applicable. */
  lane_facts?: LaneFactsOutput;
  lane_facts_persisted?: boolean;
  lane_skipped_reason?: string;
}

export async function uploadAndRegisterFile(params: {
  file: File;
  file_kind: string;
  description?: string | null;
  onProgress?: (stage: 'prepare' | 'upload' | 'confirm' | 'done' | 'error', percent: number) => void;
}): Promise<UploadResult> {
  const { file, file_kind, description, onProgress } = params;

  // ========== STAGE 1: PREPARE ==========
  onProgress?.('prepare', 10);
  
  const prepareRes = await prepareUpload({
    bucket: 'student-docs',
    file_kind,
    file_name: file.name,
  });

  if (!prepareRes.ok || !prepareRes.data?.signed_url || !prepareRes.data?.path) {
    onProgress?.('error', 0);
    return { 
      success: false, 
      stage: 'prepare', 
      error: prepareRes.error || 'prepare_failed',
      details: prepareRes.details,
    };
  }

  const { bucket, path, signed_url } = prepareRes.data;

  // ========== STAGE 2: UPLOAD (using fetch PUT to signed_url) ==========
  onProgress?.('upload', 40);
  
  const uploadRes = await uploadToCrmStorage({
    signed_url,
    file,
  });

  if (!uploadRes.ok) {
    onProgress?.('error', 0);
    return {
      success: false,
      stage: 'put',
      error: uploadRes.error || 'upload_failed',
      details: uploadRes.details,
    };
  }

  // ========== STAGE 3: CONFIRM ==========
  onProgress?.('confirm', 75);
  
  const confirmRes = await confirmUpload({
    bucket,
    path,
    file_kind,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    description: description || null,
  });

  if (!confirmRes.ok) {
    onProgress?.('error', 0);
    return { 
      success: false, 
      stage: 'confirm', 
      error: confirmRes.error || 'confirm_failed',
      details: confirmRes.details,
    };
  }

  // ========== STAGE 4: FOUNDATION GATE (mandatory) ==========
  // Every successfully registered file MUST receive a route_decision,
  // a normalized_document, and a review_state. If foundation fails,
  // we DO NOT report success — caller must surface the failure.
  const documentId = confirmRes.data?.file_id;
  if (!documentId) {
    onProgress?.('error', 0);
    return {
      success: false,
      stage: 'foundation',
      error: 'foundation_no_document_id',
      details: 'confirmUpload returned no file_id; cannot run foundation gate',
    };
  }

  let foundation: FoundationOutput;
  try {
    foundation = await runFoundation({ document_id: documentId, file, declared_slot: file_kind });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error('[FoundationGate] FAILED — upload reported as failed', { documentId, error: msg });
    onProgress?.('error', 0);
    return {
      success: false,
      stage: 'foundation',
      error: 'foundation_failed',
      details: msg,
      file_id: documentId,
      path,
      bucket,
      foundation_failed: true,
    };
  }

  // eslint-disable-next-line no-console
  console.log('[FoundationGate] decision', {
    document_id: foundation.document_id,
    route_family: foundation.route.route_family,
    route_confidence: foundation.route.route_confidence,
    selected_lane: foundation.route.selected_lane,
    requires_review: foundation.route.requires_review,
    processing_state: foundation.processing_state,
    privacy_blocked: foundation.privacy_blocked,
    route_reasons: foundation.route.route_reasons,
  });

  // ── STAGE 5: PERSIST foundation output (best-effort, but reported) ──
  let foundation_persisted = false;
  try {
    const { persistFoundationOutput } = await import('./foundation/persistence');
    foundation_persisted = await persistFoundationOutput(foundation);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[FoundationGate] persistence threw', e);
  }

  // ========== STAGE 6: MISTRAL PIPELINE (single engine, no fallbacks) ==========
  // Calls the unified mistral-document-pipeline edge function.
  // It writes truth rows to document_lane_facts and document_review_queue.
  // Lane failure does NOT fail the upload — it is recorded as needs_review.
  let lane_facts: LaneFactsOutput | undefined;
  let lane_facts_persisted = false;
  let lane_skipped_reason: string | undefined;
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: pipeRes, error: pipeErr } = await supabase.functions.invoke(
      'mistral-document-pipeline',
      {
        body: {
          document_id: documentId,
          bucket,
          path,
          file_kind,
          declared_family: foundation.route.route_family,
        },
      },
    );
    if (pipeErr) {
      // eslint-disable-next-line no-console
      console.warn('[MistralPipeline] invoke error', pipeErr);
      lane_skipped_reason = `mistral_invoke_error:${pipeErr.message ?? 'unknown'}`;
    } else if (pipeRes?.ok) {
      // eslint-disable-next-line no-console
      console.log('[MistralPipeline] ✅ ran', {
        document_id: documentId,
        family: pipeRes.family,
        lane: pipeRes.lane,
        truth_state: pipeRes.truth_state,
        confidence: pipeRes.lane_confidence,
        requires_review: pipeRes.requires_review,
        review_reason: pipeRes.review_reason,
        ms: pipeRes.processing_ms,
      });
      lane_facts_persisted = true;
    } else {
      // eslint-disable-next-line no-console
      console.warn('[MistralPipeline] pipeline reported failure', pipeRes);
      lane_skipped_reason = `mistral_failed:${pipeRes?.error ?? 'unknown'}`;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[MistralPipeline] threw — non-fatal', e);
    lane_skipped_reason = e instanceof Error ? `mistral_threw:${e.message}` : 'mistral_threw';
  }

  // ========== DONE ==========
  onProgress?.('done', 100);

  return {
    success: true,
    file_id: documentId,
    file_url: confirmRes.data?.file_url,
    path,
    bucket,
    foundation,
    foundation_persisted,
    lane_facts,
    lane_facts_persisted,
    lane_skipped_reason,
  };
}
