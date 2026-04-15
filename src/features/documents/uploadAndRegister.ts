/**
 * ✅ Upload and Register File - Unified Document Upload
 * 
 * Protocol: prepare → fetch(PUT signed_url) → confirm
 * Uses signed URL directly - no SDK or CRM keys needed.
 */
import { prepareUpload, confirmUpload } from "@/api/crmStorage";
import { uploadToCrmStorage } from "@/lib/crmStorageClient";

export interface UploadResult {
  success: boolean;
  stage?: 'prepare' | 'put' | 'confirm';
  file_id?: string;
  file_url?: string;
  path?: string;
  bucket?: string;
  error?: string;
  details?: string;
  http_status?: number;
  request_id?: string;
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
  
  return {
    success: true,
    file_id: confirmRes.data?.file_id,
    file_url: confirmRes.data?.file_url,
    path,
    bucket,
  };
}
