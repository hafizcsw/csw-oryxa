/**
 * ✅ Upload Avatar - Unified Avatar Upload
 *
 * Protocol: prepare → fetch(PUT signed_url) → set_avatar
 * Uses signed URL directly - no SDK or CRM keys needed.
 *
 * SINGLE WRITE PATH: avatar must NEVER be sent via update_profile.
 * The CRM `set_avatar` handler is the only writer of customers.avatar_url.
 */
import { prepareUpload, setAvatar } from "@/api/crmStorage";
import { uploadToCrmStorage } from "@/lib/crmStorageClient";

// Bundle marker — bump on every change to detect stale browser caches.
export const AVATAR_BUNDLE_TAG = 'avatar-2026-04-23-clean';

export interface AvatarUploadResult {
  success: boolean;
  stage?: 'prepare' | 'put' | 'set_avatar';
  file_url?: string;
  file_id?: string;
  error?: string;
  details?: string;
  http_status?: number;
}

export async function uploadAvatar(
  file: File,
  onProgress?: (stage: 'prepare' | 'upload' | 'confirm' | 'done' | 'error', percent: number) => void
): Promise<AvatarUploadResult> {

  // ========== STAGE 1: PREPARE ==========
  onProgress?.('prepare', 10);

  const prepareRes = await prepareUpload({
    bucket: 'avatars',
    file_kind: 'avatar',
    file_name: file.name,
    // Avatar is an operational upload — exempt from Draft-first sensitive-context guard.
    ctx: {
      context: 'avatar',
      confirmationState: 'post_confirm',
      confirmationTraceId: 'avatar-operational',
      attemptedAction: 'uploadAvatar',
    },
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

  const { path, signed_url } = prepareRes.data;

  // ========== STAGE 2: UPLOAD (PUT to signed_url) ==========
  onProgress?.('upload', 50);

  const uploadRes = await uploadToCrmStorage({ signed_url, file });

  if (!uploadRes.ok) {
    onProgress?.('error', 0);
    return {
      success: false,
      stage: 'put',
      error: uploadRes.error || 'upload_failed',
      details: uploadRes.details,
    };
  }

  // ========== STAGE 3: SET AVATAR ==========
  onProgress?.('confirm', 80);

  // CRM Edge Function computes the public URL — no hard-coded URLs needed.
  const setRes = await setAvatar({ path });

  if (!setRes.ok) {
    onProgress?.('error', 0);
    return {
      success: false,
      stage: 'set_avatar',
      error: setRes.error || 'set_avatar_failed',
    };
  }

  // ========== DONE ==========
  onProgress?.('done', 100);

  return {
    success: true,
    file_url: setRes.file_url,
    file_id: path,
  };
}
