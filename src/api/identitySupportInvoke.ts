/**
 * Identity Activation + Website Support — canonical contract layer.
 * All calls go through `portalInvoke` → `student-portal-api`.
 * No separate edge function. No second wrapper.
 */
import { portalInvoke } from "@/api/portalInvoke";
import { supabase } from "@/integrations/supabase/client";

export type IdentityDocKind = "passport" | "national_id" | "driver_license";
export type ReaderVerdict = "accepted_preliminarily" | "weak" | "unsupported";
export type IdentityStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected"
  | "reupload_required";

export type SupportStatus = "open" | "in_progress" | "resolved" | "closed";
export type SupportUiState = "submitted" | "under_review" | "resolved";

export interface IdentityStatusReadback {
  identity_status: IdentityStatus;
  blocks_academic_file: boolean;
  last_activation_id: string | null;
  decision_reason_code: string | null;
  reupload_required_fields: string[] | null;
  decided_at: string | null;
}

export interface ExtractedFieldRead {
  value: string | null;
  confidence: number;
  status: string;
}

export interface ReaderRunResult {
  reader_document_id: string;
  reader_verdict: ReaderVerdict;
  truth_state: string | null;
  family: string | null;
  lane_confidence: number | null;
  reader_payload: Record<string, unknown>;
  extracted_fields: Record<string, ExtractedFieldRead>;
}

export interface ActivationSubmitResult {
  activation_id: string;
  identity_status: IdentityStatus;
  submitted_at: string;
}

export interface SupportTicketRow {
  ticket_id: string;
  subject_key: string | null;
  status: SupportStatus;
  ui_state: SupportUiState;
  created_at: string;
  updated_at: string;
  last_reply_at: string | null;
}

// ─── Identity ────────────────────────────────────────────────
async function signIdentityUploadUrl(slot: "doc" | "selfie" | "video", ext: string) {
  return portalInvoke<{ bucket: string; path: string; signed_url: string; token: string; file_kind: string }>(
    "identity_upload_sign_url",
    { slot, ext },
  );
}

async function confirmIdentityUpload(input: {
  slot: "doc" | "selfie" | "video";
  bucket: string;
  path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}) {
  return portalInvoke<{ file_id: string; bucket: string; path: string; file_kind: string }>(
    "identity_upload_confirm",
    input,
  );
}

/** Uploads identity bytes to CRM storage and registers them as a CRM
 *  customer_files row. Returns the canonical CRM file_id. */
export async function uploadIdentityFile(slot: "doc" | "selfie" | "video", file: File) {
  const ext = (file.name.split(".").pop() || file.type.split("/")[1] || "bin").toLowerCase();
  const sign = await signIdentityUploadUrl(slot, ext);
  if (!sign.ok || !sign.data) return { ok: false as const, error: sign.error || "sign_failed" };
  // PUT directly to the CRM-issued signed URL. Do NOT use the portal supabase
  // client here — it would attach the portal JWT and cause a signature
  // verification failure against the CRM storage endpoint.
  try {
    // Build absolute URL — sign.data.signed_url may be relative ("/storage/v1/...").
    const putUrl = sign.data.signed_url.startsWith("http")
      ? sign.data.signed_url
      : `${sign.data.signed_url}`;
    const putRes = await fetch(putUrl, {
      method: "PUT",
      headers: {
        "content-type": file.type || "application/octet-stream",
        "cache-control": "max-age=3600",
      },
      body: file,
    });
    if (!putRes.ok) {
      const txt = await putRes.text().catch(() => "");
      return { ok: false as const, error: `put_failed:http_${putRes.status}:${txt.slice(0, 120)}` };
    }
  } catch (e) {
    return { ok: false as const, error: `put_failed:${e instanceof Error ? e.message : String(e)}` };
  }
  const confirmPayload = {
    slot,
    bucket: sign.data.bucket,
    path: sign.data.path,
    file_name: file.name || `${slot}.${ext}`,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size || 0,
  };
  const retryDelays = slot === "video" ? [0, 1200, 2500, 5000] : [0, 700, 1500];
  let conf: Awaited<ReturnType<typeof confirmIdentityUpload>> | null = null;
  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, retryDelays[attempt]));
    }
    conf = await confirmIdentityUpload(confirmPayload);
    if (conf.ok && conf.data?.file_id) break;
    const retryable = conf.error === "OBJECT_NOT_FOUND";
    if (!retryable) break;
  }
  if (!conf?.ok || !conf.data?.file_id) {
    return {
      ok: false as const,
      error: [conf?.error || "register_failed", conf?.details].filter(Boolean).join(":"),
    };
  }
  return {
    ok: true as const,
    file_id: conf.data.file_id,
    bucket: sign.data.bucket,
    path: sign.data.path,
  };
}

/** Runs the existing mistral-document-pipeline on the CRM-registered identity doc.
 *  MUST be called BEFORE opening the camera flow. */
export async function runIdentityReader(input: {
  doc_kind: IdentityDocKind;
  id_doc_file_id: string;
}) {
  return portalInvoke<ReaderRunResult>("identity_reader_run", input);
}

export async function submitIdentityActivation(input: {
  id_doc_type: IdentityDocKind;
  id_doc_file_id: string;
  selfie_file_id: string;
  video_file_id: string;
  reader_verdict: ReaderVerdict;
  reader_payload: Record<string, unknown>;
  client_trace_id?: string;
}) {
  return portalInvoke<ActivationSubmitResult>("identity_activation_submit", input);
}

export async function getIdentityStatus() {
  return portalInvoke<IdentityStatusReadback>("identity_status_get");
}

// ─── Support ─────────────────────────────────────────────────
export async function createSupportTicket(input: {
  body: string;
  subject_key?: string;
  attachment_storage_path?: string;
  client_trace_id?: string;
}) {
  return portalInvoke<{ ticket_id: string; status: SupportStatus; created_at: string }>(
    "support_ticket_create",
    input,
  );
}

export async function listSupportTickets() {
  return portalInvoke<{ tickets: SupportTicketRow[] }>("support_ticket_list");
}
