/**
 * ✅ Upload and Register File - Unified Document Upload
 * 
 * Protocol: prepare → fetch(PUT signed_url) → confirm
 * Uses signed URL directly - no SDK or CRM keys needed.
 */
import { prepareUpload, confirmUpload } from "@/api/crmStorage";
import { uploadToCrmStorage } from "@/lib/crmStorageClient";
import { runFoundation, type FoundationOutput } from "./foundation";

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

  // ========== DONE ==========
  onProgress?.('done', 100);

  // ── Foundation Gate ─────────────────────────────────────────
  // Every successfully registered file MUST receive a route_decision,
  // a normalized_document, and a review_state — even if it is unknown.
  let foundation: FoundationOutput | undefined;
  const documentId = confirmRes.data?.file_id;
  if (documentId) {
    try {
      foundation = await runFoundation({ document_id: documentId, file });
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
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[FoundationGate] failed', e);
    }
  }

  return {
    success: true,
    file_id: confirmRes.data?.file_id,
    file_url: confirmRes.data?.file_url,
    path,
    bucket,
    foundation,
  };
}
