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

function getRegistryMimeType(slot: "doc" | "selfie" | "video", file: File) {
  const fallback = file.type || "application/octet-stream";
  if (slot !== "video") return fallback;
  return fallback.split(";")[0]?.trim().toLowerCase() || "video/webm";
}

function getPutContentType(slot: "doc" | "selfie" | "video", file: File) {
  if (slot !== "video") return file.type || "application/octet-stream";
  return getRegistryMimeType(slot, file);
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
  const registryMimeType = getRegistryMimeType(slot, file);
  const putContentType = getPutContentType(slot, file);
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
        "content-type": putContentType,
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
    mime_type: registryMimeType,
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

// ============================================================================
// CRM Bridge v2 — case-based identity + support inbox/thread
// ----------------------------------------------------------------------------
// All 7 functions below are 1:1 wrappers over student-portal-api actions, which
// in turn proxy to CRM web-* endpoints. portalInvoke already converts both
// transport errors AND { ok:false } payloads into { ok:false, error } — callers
// MUST NOT assume HTTP success implies business success.
//
// Mapping (locked):
//   getIdentityCase()       → identity_case_get       → web-get-identity-case
//   listSupportCases()      → support_case_list       → web-list-support-cases
//   getSupportCase()        → support_case_get        → web-get-support-case
//   listSupportMessages()   → support_messages_list   → web-list-support-messages
//   sendSupportMessage()    → support_message_send    → web-send-support-message
//   markSupportRead()       → support_mark_read       → web-mark-support-read
//   closeSupportCase()      → support_case_close      → web-close-support-case
// ============================================================================

// ─── Shared enums (CRM contract) ─────────────────────────────────────────────
export type IdentityAttemptStatus =
  | "submitted"
  | "approved"
  | "rejected"
  | "reupload_required";

export type IdentityDocTypeV2 =
  | "national_id"
  | "passport"
  | "driver_license"
  | "residency"
  | "other";

export type SupportCaseStatus = "open" | "in_progress" | "resolved" | "closed";

export type SupportMessageSenderType = "customer" | "staff" | "system";

export type SupportMessageKind =
  | "text"
  | "system_event"
  | "file_ref"
  | "identity_decision"
  | "identity_revoked"
  | "case_resolved"
  | "case_closed";

// ─── Identity case ───────────────────────────────────────────────────────────
export interface IdentityCurrentAttempt {
  request_id: string;
  attempt_no: number;
  status: IdentityAttemptStatus;
  id_doc_type: IdentityDocTypeV2;
  decision_reason_codes: string[];
  student_visible_note: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
}

export interface IdentityPreviousAttempt {
  request_id: string;
  attempt_no: number;
  status: IdentityAttemptStatus;
  submitted_at: string;
  reviewed_at: string | null;
  student_visible_note: string | null;
}

export interface IdentityCase {
  case_id: string;
  current_attempt: IdentityCurrentAttempt;
  previous_attempts: IdentityPreviousAttempt[];
}

export interface IdentityCaseResponse {
  case: IdentityCase;
}

// ─── Support cases ───────────────────────────────────────────────────────────
export interface SupportCaseListItem {
  case_id: string;
  case_type: string | null;
  subject: string | null;
  status: SupportCaseStatus;
  unread_for_customer: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
  linked_identity_request_id: string | null;
  assignee_display: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportCaseListResponse {
  cases: SupportCaseListItem[];
}

export interface SupportCaseDetail {
  case_id: string;
  case_type: string | null;
  subject: string | null;
  body: string | null;
  status: SupportCaseStatus;
  category: string | null;
  priority: string | null;
  linked_identity_request_id: string | null;
  assignee_display: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface SupportCaseIdentityLink {
  request_id: string;
  status: IdentityAttemptStatus;
  attempt_no: number;
  student_visible_note: string | null;
}

export interface SupportCaseGetResponse {
  case: SupportCaseDetail;
  identity_link: SupportCaseIdentityLink | null;
}

// ─── Support messages ────────────────────────────────────────────────────────
export interface SupportMessage {
  id: string;
  sender_type: SupportMessageSenderType;
  author_display: string | null;
  body: string;
  message_kind: SupportMessageKind;
  visible_to_customer: boolean;
  created_at: string;
}

export interface SupportMessagesListResponse {
  messages: SupportMessage[];
}

export interface SupportMessageSendResponse {
  ok: true;
  message: {
    id: string;
    sender_type: "customer";
    created_at: string;
  };
}

export interface SupportMarkReadResponse {
  ok: true;
  case_id: string;
  read_at: string;
  unread_for_customer: false;
}

export interface SupportCaseCloseResponse {
  ok: true;
  case_id: string;
  status: "closed";
  closed_at: string;
}

// ─── Wrappers ────────────────────────────────────────────────────────────────
// Each wrapper forwards the documented input fields only — customer_id is
// resolved server-side inside student-portal-api from the auth session.

/** Fetch the current/latest identity case for the signed-in customer. */
export async function getIdentityCase() {
  return portalInvoke<IdentityCaseResponse>("identity_case_get");
}

export interface ListSupportCasesInput {
  status_in?: SupportCaseStatus[];
  limit?: number;
  offset?: number;
}

/** List support cases for the signed-in customer (optionally filtered). */
export async function listSupportCases(input: ListSupportCasesInput = {}) {
  const payload: Record<string, unknown> = {};
  if (input.status_in) payload.status_in = input.status_in;
  if (typeof input.limit === "number") payload.limit = input.limit;
  if (typeof input.offset === "number") payload.offset = input.offset;
  return portalInvoke<SupportCaseListResponse>("support_case_list", payload);
}

/** Get full detail of one support case (with optional identity link). */
export async function getSupportCase(input: { case_id: string }) {
  return portalInvoke<SupportCaseGetResponse>("support_case_get", {
    case_id: input.case_id,
  });
}

export interface ListSupportMessagesInput {
  case_id: string;
  after?: string | null;
  limit?: number;
}

/** List messages of one support case (paginated by `after`). */
export async function listSupportMessages(input: ListSupportMessagesInput) {
  const payload: Record<string, unknown> = { case_id: input.case_id };
  if (input.after !== undefined) payload.after = input.after;
  if (typeof input.limit === "number") payload.limit = input.limit;
  return portalInvoke<SupportMessagesListResponse>("support_messages_list", payload);
}

/** Append a customer-authored message to a support case. */
export async function sendSupportMessage(input: { case_id: string; body: string }) {
  return portalInvoke<SupportMessageSendResponse>("support_message_send", {
    case_id: input.case_id,
    body: input.body,
  });
}

/** Mark a support case as read by the customer. */
export async function markSupportRead(input: { case_id: string }) {
  return portalInvoke<SupportMarkReadResponse>("support_mark_read", {
    case_id: input.case_id,
  });
}

/** Customer-initiated close of a support case. */
export async function closeSupportCase(input: { case_id: string }) {
  return portalInvoke<SupportCaseCloseResponse>("support_case_close", {
    case_id: input.case_id,
  });
}
