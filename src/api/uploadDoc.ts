/**
 * Simple document upload API for logged-in users.
 *
 * ⚠️ Draft-first guard (Phase 1):
 *   This helper talks directly to student-portal-api (bypassing crmStorage.ts),
 *   so we apply the same guard here. Pass `ctx` to mark the upload context.
 *   Sensitive contexts are blocked pre-confirm.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  evaluateUploadGuard,
  type UploadGuardContext,
} from "@/lib/draftFirstGuard";

export async function uploadDoc(
  file: File,
  file_kind: string,
  description?: string,
  ctx?: UploadGuardContext,
) {
  // ── Draft-first guard — block sensitive pre-confirm uploads before any network call ──
  const prepDecision = evaluateUploadGuard('prepare_upload', ctx);
  if (!prepDecision.allowed) {
    const err: Error & { trace_id?: string; code?: string } = Object.assign(
      new Error(prepDecision.errorMessage ?? 'blocked_pre_confirm_crm_upload'),
      { trace_id: prepDecision.traceId, code: prepDecision.errorCode },
    );
    throw err;
  }

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

  // Re-check guard for confirm stage (same ctx).
  const confDecision = evaluateUploadGuard('confirm_upload', ctx);
  if (!confDecision.allowed) {
    const err: Error & { trace_id?: string; code?: string } = Object.assign(
      new Error(confDecision.errorMessage ?? 'blocked_pre_confirm_crm_upload'),
      { trace_id: confDecision.traceId, code: confDecision.errorCode },
    );
    throw err;
  }

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
