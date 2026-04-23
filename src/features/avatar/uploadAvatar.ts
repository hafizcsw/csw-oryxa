/**
 * ✅ Upload Avatar - Unified Avatar Upload
 * 
 * Protocol: prepare → fetch(PUT signed_url) → set_avatar
 * Uses signed URL directly - no SDK or CRM keys needed.
 */
import { prepareUpload, setAvatar } from "@/api/crmStorage";
import { uploadToCrmStorage } from "@/lib/crmStorageClient";
import { portalInvoke } from "@/api/portalInvoke";

export interface AvatarUploadResult {
  success: boolean;
  stage?: 'prepare' | 'put' | 'set_avatar';
  file_url?: string;
  file_id?: string;
  error?: string;
  details?: string;
  http_status?: number;
}

// 🔬 PROBE: bundle marker so we can confirm the browser is NOT running stale JS
const PROBE_BUNDLE_TAG = 'avatar-probe-2025-04-23-A';

export async function uploadAvatar(
  file: File,
  onProgress?: (stage: 'prepare' | 'upload' | 'confirm' | 'done' | 'error', percent: number) => void
): Promise<AvatarUploadResult> {

  // 🔬 PROBE START
  const traceId = `avatar_probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const probe: Record<string, unknown> = {
    trace_id: traceId,
    bundle_tag: PROBE_BUNDLE_TAG,
    file_name_in: file.name,
    file_size: file.size,
    file_type: file.type,
    started_at: new Date().toISOString(),
  };
  console.log('🔬 [AVATAR_PROBE] START', probe);

  // 🔬 PROBE: get_profile BEFORE
  try {
    const beforeRes = await portalInvoke<any>('get_profile', {});
    probe.before_get_profile = {
      ok: beforeRes.ok,
      avatar_url: (beforeRes.data as any)?.avatar_url ?? (beforeRes.data as any)?.profile?.avatar_url,
      avatar_updated_at: (beforeRes.data as any)?.avatar_updated_at ?? (beforeRes.data as any)?.profile?.avatar_updated_at,
    };
    console.log('🔬 [AVATAR_PROBE] BEFORE get_profile', probe.before_get_profile);
  } catch (e) {
    probe.before_get_profile_error = String(e);
  }

  // ========== STAGE 1: PREPARE ==========
  onProgress?.('prepare', 10);
  
  const prepareRes = await prepareUpload({
    bucket: 'avatars',
    file_kind: 'avatar',
    file_name: file.name,
  });

  probe.prepare_response = {
    ok: prepareRes.ok,
    error: prepareRes.error,
    details: prepareRes.details,
    path: prepareRes.data?.path,
    has_signed_url: !!prepareRes.data?.signed_url,
    signed_url_preview: prepareRes.data?.signed_url?.slice(0, 120),
    expires_in: prepareRes.data?.expires_in,
  };
  console.log('🔬 [AVATAR_PROBE] STAGE 1 prepare_upload', probe.prepare_response);

  if (!prepareRes.ok || !prepareRes.data?.signed_url || !prepareRes.data?.path) {
    onProgress?.('error', 0);
    console.log('🔬 [AVATAR_PROBE] FINAL', probe);
    return { 
      success: false, 
      stage: 'prepare', 
      error: prepareRes.error || 'prepare_failed',
      details: prepareRes.details,
    };
  }

  const { path, signed_url } = prepareRes.data;
  probe.storage_path_final = path;

  // ========== STAGE 2: UPLOAD (using fetch PUT to signed_url) ==========
  onProgress?.('upload', 50);
  
  const putStarted = performance.now();
  const uploadRes = await uploadToCrmStorage({
    signed_url,
    file,
  });
  probe.put_response = {
    ok: uploadRes.ok,
    error: uploadRes.error,
    details: uploadRes.details,
    duration_ms: Math.round(performance.now() - putStarted),
  };
  console.log('🔬 [AVATAR_PROBE] STAGE 2 PUT signed_url', probe.put_response);

  if (!uploadRes.ok) {
    onProgress?.('error', 0);
    console.log('🔬 [AVATAR_PROBE] FINAL', probe);
    return {
      success: false,
      stage: 'put',
      error: uploadRes.error || 'upload_failed',
      details: uploadRes.details,
    };
  }

  // ========== STAGE 3: SET AVATAR ==========
  onProgress?.('confirm', 80);
  
  const setRes = await setAvatar({ path });
  probe.set_avatar_request = { path };
  probe.set_avatar_response = {
    ok: setRes.ok,
    error: setRes.error,
    file_url: setRes.file_url,
  };
  console.log('🔬 [AVATAR_PROBE] STAGE 3 set_avatar', {
    request: probe.set_avatar_request,
    response: probe.set_avatar_response,
  });

  if (!setRes.ok) {
    onProgress?.('error', 0);
    console.log('🔬 [AVATAR_PROBE] FINAL', probe);
    return { 
      success: false, 
      stage: 'set_avatar', 
      error: setRes.error || 'set_avatar_failed',
    };
  }

  // 🔬 PROBE: get_profile IMMEDIATELY AFTER
  try {
    const afterRes = await portalInvoke<any>('get_profile', {});
    probe.after_get_profile_immediate = {
      ok: afterRes.ok,
      avatar_url: (afterRes.data as any)?.avatar_url ?? (afterRes.data as any)?.profile?.avatar_url,
      avatar_updated_at: (afterRes.data as any)?.avatar_updated_at ?? (afterRes.data as any)?.profile?.avatar_updated_at,
    };
    console.log('🔬 [AVATAR_PROBE] AFTER (immediate) get_profile', probe.after_get_profile_immediate);
  } catch (e) {
    probe.after_get_profile_immediate_error = String(e);
  }

  // ========== DONE ==========
  onProgress?.('done', 100);

  // 🔬 PROBE: get_profile after 10s (fire-and-log, do not block)
  setTimeout(async () => {
    try {
      const lateRes = await portalInvoke<any>('get_profile', {});
      const late = {
        trace_id: traceId,
        ok: lateRes.ok,
        avatar_url: (lateRes.data as any)?.avatar_url ?? (lateRes.data as any)?.profile?.avatar_url,
        avatar_updated_at: (lateRes.data as any)?.avatar_updated_at ?? (lateRes.data as any)?.profile?.avatar_updated_at,
      };
      console.log('🔬 [AVATAR_PROBE] AFTER (10s) get_profile', late);
    } catch (e) {
      console.log('🔬 [AVATAR_PROBE] AFTER (10s) get_profile error', { trace_id: traceId, error: String(e) });
    }
  }, 10000);

  console.log('🔬 [AVATAR_PROBE] FINAL', probe);
  
  return {
    success: true,
    file_url: setRes.file_url,
    file_id: path,
  };
}
