/**
 * Simple document upload API for logged-in users.
 * Usage: const result = await uploadDoc(file, 'passport');
 * file_kind: 'passport' | 'certificate' | 'personal_photo' | 'transcript' | 'ielts' | 'cv' | 'other'
 */
import { supabase } from "@/integrations/supabase/client";

export async function uploadDoc(file: File, file_kind: string, description?: string) {
  // Step 1 — get signed URL
  const { data: prep, error: e1 } = await supabase.functions.invoke("student-portal-api", {
    body: { action: "prepare_upload", bucket: "student-docs", file_kind, file_name: file.name },
  });
  if (e1 || !prep?.ok) throw new Error(prep?.error || e1?.message || "prepare_failed");

  // Step 2 — PUT file to signed URL
  const put = await fetch(prep.data.signed_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error(`upload_failed_${put.status}`);

  // Step 3 — confirm & register
  const { data: conf, error: e2 } = await supabase.functions.invoke("student-portal-api", {
    body: {
      action: "confirm_upload",
      bucket: prep.data.bucket,
      path: prep.data.path,
      file_kind,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      description: description || null,
    },
  });
  if (e2 || !conf?.ok) throw new Error(conf?.error || e2?.message || "confirm_failed");

  return { file_id: conf.data.file_id, file_url: conf.data.file_url, path: prep.data.path };
}
