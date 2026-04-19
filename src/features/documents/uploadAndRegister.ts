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
    foundation = await runFoundation({ document_id: documentId, file });
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

  // ========== STAGE 6: LANE DISPATCH (Door 2 — Fast Value Gate) ==========
  // Best-effort: lane failure does NOT fail the upload, but is reported.
  // Lanes are only run for passport_id, graduation_certificate, language_certificate.
  let lane_facts: LaneFactsOutput | undefined;
  let lane_facts_persisted = false;
  let lane_skipped_reason: string | undefined;
  try {
    const dispatch = await dispatchLane({ foundation, file });
    if (dispatch.ran) {
      lane_facts = dispatch.output;
      // eslint-disable-next-line no-console
      console.log('[LaneDispatch] ✅ ran', {
        document_id: documentId,
        lane: dispatch.output.lane,
        truth_state: dispatch.output.truth_state,
        confidence: dispatch.output.lane_confidence,
        requires_review: dispatch.output.requires_review,
        ms: dispatch.output.engine_metadata.processing_ms,
      });
      lane_facts_persisted = await persistLaneFacts(dispatch.output);
    } else {
      lane_skipped_reason = dispatch.reason;
      // eslint-disable-next-line no-console
      console.log('[LaneDispatch] skipped', { document_id: documentId, reason: dispatch.reason });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[LaneDispatch] threw — non-fatal', e);
    lane_skipped_reason = e instanceof Error ? `lane_threw:${e.message}` : 'lane_threw';
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
