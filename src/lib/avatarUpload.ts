/**
 * ✅ Avatar Upload - Uses unified CRM Storage protocol
 * 
 * This is a wrapper around src/features/avatar/uploadAvatar.ts
 * Kept for backwards compatibility
 */
import { uploadAvatar as uploadAvatarCore } from "@/features/avatar/uploadAvatar";

export type UploadStage = 'prepare' | 'upload' | 'confirm' | 'done' | 'error';

/**
 * Upload avatar using prepare → PUT → set_avatar protocol
 * @returns { ok: boolean; avatar_url?: string; error?: string }
 */
export async function uploadAndSetAvatar(
  file: File,
  onProgress?: (stage: UploadStage, percent: number) => void
): Promise<{ ok: boolean; avatar_url?: string; error?: string }> {
  
  const result = await uploadAvatarCore(file, onProgress);
  
  if (result.success) {
    return {
      ok: true,
      avatar_url: result.file_url,
    };
  }
  
  return {
    ok: false,
    error: `${result.stage || 'unknown'}: ${result.error}${result.details ? ` - ${result.details}` : ''}`,
  };
}
