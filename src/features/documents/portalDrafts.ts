// ═══════════════════════════════════════════════════════════════
// Portal Draft Layer (Order 2)
// ───────────────────────────────────────────────────────────────
// Saves Study File uploads as DRAFTS inside the portal only.
// NO CRM mutation. NO student-docs bucket. NO customer_files.
// Storage path: study-file/{auth.uid}/{draft_id}/{safe_filename}
// ═══════════════════════════════════════════════════════════════

import { supabase } from "@/integrations/supabase/client";

export type PortalDraftStatus =
  | "selected_local"
  | "portal_draft_uploaded"
  | "awaiting_extraction"
  | "discarded_by_student"
  | "expired_draft"
  | "shared_to_crm";

export interface PortalDraft {
  id: string;
  student_user_id: string;
  document_type: string | null;
  original_file_name: string;
  mime_type: string | null;
  file_size: number | null;
  file_sha256: string | null;
  draft_storage_bucket: string;
  draft_storage_path: string;
  status: PortalDraftStatus;
  extraction_status: string;
  identity_match_status: string;
  evaluation_status: string;
  source_surface: string | null;
  trace_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  confirmed_at: string | null;
  discarded_at: string | null;
  shared_to_crm_at: string | null;
}

const BUCKET = "portal-drafts";

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 180);
}

async function sha256Hex(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

export interface UploadDraftInput {
  file: File;
  studentUserId: string;
  documentType?: string | null;
  sourceSurface?: string;
}

export interface UploadDraftResult {
  ok: boolean;
  draft?: PortalDraft;
  stage?: "insert" | "upload" | "finalize";
  error?: string;
  trace_id: string;
}

/**
 * Upload a file as a portal draft.
 * Flow: insert row (selected_local) → upload object → update row to portal_draft_uploaded.
 * No CRM contact at any stage.
 */
export async function uploadPortalDraft(
  input: UploadDraftInput,
): Promise<UploadDraftResult> {
  const { file, studentUserId, documentType = null, sourceSurface = "study_file_upload_hub" } = input;
  const trace_id = `pd_${crypto.randomUUID()}`;
  const draftId = crypto.randomUUID();
  const path = `study-file/${studentUserId}/${draftId}/${safeName(file.name)}`;
  const sha = await sha256Hex(file);

  // 1) Insert draft row in selected_local
  const { data: inserted, error: insertErr } = await supabase
    .from("portal_document_drafts")
    .insert({
      id: draftId,
      student_user_id: studentUserId,
      document_type: documentType,
      original_file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      file_sha256: sha,
      draft_storage_bucket: BUCKET,
      draft_storage_path: path,
      status: "selected_local",
      source_surface: sourceSurface,
      trace_id,
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    return { ok: false, stage: "insert", error: insertErr?.message ?? "insert_failed", trace_id };
  }

  // 2) Upload object to portal-drafts bucket
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadErr) {
    // Best-effort cleanup of the row so we don't leave orphan metadata.
    await supabase.from("portal_document_drafts").delete().eq("id", draftId);
    return { ok: false, stage: "upload", error: uploadErr.message, trace_id };
  }

  // 3) Mark row as portal_draft_uploaded
  const { data: updated, error: updateErr } = await supabase
    .from("portal_document_drafts")
    .update({ status: "portal_draft_uploaded" })
    .eq("id", draftId)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return {
      ok: false,
      stage: "finalize",
      error: updateErr?.message ?? "finalize_failed",
      trace_id,
    };
  }

  return { ok: true, draft: updated as PortalDraft, trace_id };
}

/**
 * List the current student's active drafts (not discarded, not shared to CRM).
 */
export async function listActivePortalDrafts(
  studentUserId: string,
): Promise<PortalDraft[]> {
  const { data, error } = await supabase
    .from("portal_document_drafts")
    .select("*")
    .eq("student_user_id", studentUserId)
    .is("discarded_at", null)
    .is("shared_to_crm_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as PortalDraft[];
}

/**
 * Delete a draft: remove storage object then mark row discarded.
 * Never touches CRM.
 */
export async function deletePortalDraft(draftId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: draft, error: fetchErr } = await supabase
    .from("portal_document_drafts")
    .select("id, draft_storage_bucket, draft_storage_path, student_user_id")
    .eq("id", draftId)
    .single();

  if (fetchErr || !draft) {
    return { ok: false, error: fetchErr?.message ?? "draft_not_found" };
  }

  // Remove object (RLS scoped to owner folder)
  const { error: removeErr } = await supabase.storage
    .from(draft.draft_storage_bucket)
    .remove([draft.draft_storage_path]);

  // Mark discarded regardless of remove result (object may already be gone)
  const { error: updateErr } = await supabase
    .from("portal_document_drafts")
    .update({
      status: "discarded_by_student",
      discarded_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  if (updateErr) return { ok: false, error: updateErr.message };
  if (removeErr) {
    // Non-fatal: row marked discarded; surface for visibility
    return { ok: true, error: `storage_remove_warning:${removeErr.message}` };
  }
  return { ok: true };
}
