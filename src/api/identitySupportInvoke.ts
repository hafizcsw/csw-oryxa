/**
 * Contract layer for Identity Activation + Website Support.
 * Talks to portal-identity-support edge fn only.
 */
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

export interface ActivationSubmitResult {
  activation_id: string | null;
  identity_status: IdentityStatus;
  reader_verdict: ReaderVerdict;
  submitted_at?: string;
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

interface InvokeResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  details?: string;
}

async function call<T>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<InvokeResult<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: "auth_required" };
  }
  try {
    const { data, error } = await supabase.functions.invoke(
      "portal-identity-support",
      { body: { action, ...body } },
    );
    if (error) {
      return { ok: false, error: "invoke_error", details: error.message };
    }
    const r = (data ?? {}) as { ok?: boolean; data?: T; error?: string; details?: string };
    if (r.ok === false) {
      return { ok: false, error: r.error, details: r.details };
    }
    return { ok: true, data: r.data as T };
  } catch (e) {
    return { ok: false, error: "network_error", details: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Identity ────────────────────────────────────────────────
export async function signIdentityUploadUrl(slot: "doc" | "selfie" | "video", ext: string) {
  return call<{ bucket: string; path: string; signed_url: string; token: string }>(
    "identity.upload.signUrl",
    { slot, ext },
  );
}

export async function uploadIdentityFile(slot: "doc" | "selfie" | "video", file: File) {
  const ext = (file.name.split(".").pop() || file.type.split("/")[1] || "bin").toLowerCase();
  const sign = await signIdentityUploadUrl(slot, ext);
  if (!sign.ok || !sign.data) return { ok: false, error: sign.error || "sign_failed" };
  const put = await fetch(sign.data.signed_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) return { ok: false, error: `put_failed_${put.status}` };
  return { ok: true, path: sign.data.path, bucket: sign.data.bucket };
}

export async function submitIdentityActivation(input: {
  doc_kind: IdentityDocKind;
  doc_storage_path: string;
  selfie_storage_path: string;
  video_storage_path: string;
  doc_mime?: string;
  client_trace_id?: string;
}) {
  return call<ActivationSubmitResult>("identity.activation.submit", input);
}

export async function getIdentityStatus() {
  return call<IdentityStatusReadback>("identity.status.get");
}

// ─── Support ─────────────────────────────────────────────────
export async function createSupportTicket(input: {
  body: string;
  subject_key?: string;
  attachment_storage_path?: string;
  client_trace_id?: string;
}) {
  return call<{ ticket_id: string; status: SupportStatus; created_at: string }>(
    "support.ticket.create",
    input,
  );
}

export async function listSupportTickets() {
  return call<{ tickets: SupportTicketRow[] }>("support.ticket.list");
}
