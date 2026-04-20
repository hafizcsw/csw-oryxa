// ═══════════════════════════════════════════════════════════════
// portal-identity-support — Portal-side contract layer for:
//   • Identity Activation (submit + status)
//   • Website Support (create + list)
//   • Identity upload signed URLs (private bucket: identity-activation)
//
// Calls the existing reader (mistral-document-pipeline) — does NOT replace it.
// Maps reader truth_state → canonical portal verdict.
// Writes to portal Supabase tables; CRM Internal Ops syncs in via service role.
// ═══════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-trace-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Action =
  | "identity.upload.signUrl"
  | "identity.activation.submit"
  | "identity.status.get"
  | "support.ticket.create"
  | "support.ticket.list";

type DocKind = "passport" | "national_id" | "driver_license";
type ReaderVerdict = "accepted_preliminarily" | "weak" | "unsupported";

const BUCKET = "identity-activation";

function jres(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Map reader pipeline truth_state → portal canonical verdict
function mapReaderVerdict(
  truth_state: string | undefined,
  family: string | undefined,
  lane_confidence: number | undefined,
): ReaderVerdict {
  if (family && family !== "passport_id" && family !== "unknown_document") {
    // user uploaded a non-identity doc (e.g. transcript)
    return "unsupported";
  }
  if (!truth_state || truth_state === "needs_review") {
    if ((lane_confidence ?? 0) < 0.4) return "unsupported";
    return "weak";
  }
  if (truth_state === "extracted" || truth_state === "proposed") {
    return "accepted_preliminarily";
  }
  return "weak";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let payload: { action?: Action; [k: string]: unknown };
  try {
    payload = await req.json();
  } catch {
    return jres({ ok: false, error: "invalid_json" }, 400);
  }

  const action = payload.action;
  if (!action) return jres({ ok: false, error: "missing_action" }, 400);

  // Auth: every action here requires a signed-in user
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return jres({ ok: false, error: "auth_required" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return jres({ ok: false, error: "invalid_token" }, 401);
  }
  const userId = claimsData.claims.sub as string;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    switch (action) {
      // ─── Sign upload URL for identity-activation bucket ──────
      case "identity.upload.signUrl": {
        const slot = String(payload.slot ?? ""); // 'doc' | 'selfie' | 'video'
        const ext = String(payload.ext ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8);
        if (!["doc", "selfie", "video"].includes(slot)) {
          return jres({ ok: false, error: "bad_slot" }, 400);
        }
        const path = `${userId}/${Date.now()}_${slot}.${ext}`;
        const { data, error } = await admin.storage
          .from(BUCKET)
          .createSignedUploadUrl(path);
        if (error) return jres({ ok: false, error: "sign_failed", details: error.message }, 500);
        return jres({
          ok: true,
          data: { bucket: BUCKET, path, signed_url: data.signedUrl, token: data.token },
        });
      }

      // ─── Submit identity activation ──────────────────────────
      case "identity.activation.submit": {
        const docKind = payload.doc_kind as DocKind;
        const docPath = String(payload.doc_storage_path ?? "");
        const selfiePath = String(payload.selfie_storage_path ?? "");
        const videoPath = String(payload.video_storage_path ?? "");
        const clientTrace = String(payload.client_trace_id ?? "");
        const docMime = String(payload.doc_mime ?? "application/octet-stream");
        const fileKind = docKind === "passport" ? "passport_id" : docKind;

        if (!["passport", "national_id", "driver_license"].includes(docKind)) {
          return jres({ ok: false, error: "bad_doc_kind" }, 400);
        }
        if (!docPath || !selfiePath || !videoPath) {
          return jres({ ok: false, error: "missing_paths" }, 400);
        }

        // 1. Make sure all three files exist for this user
        for (const p of [docPath, selfiePath, videoPath]) {
          if (!p.startsWith(`${userId}/`)) {
            return jres({ ok: false, error: "path_ownership_violation" }, 403);
          }
        }

        // 2. Sign URL for reader pipeline
        const { data: signed, error: signErr } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(docPath, 600);
        if (signErr || !signed?.signedUrl) {
          return jres({ ok: false, error: "sign_failed_for_reader" }, 500);
        }

        // 3. Call existing reader (do NOT replace) - mistral-document-pipeline
        let readerVerdict: ReaderVerdict = "weak";
        let readerPayload: Record<string, unknown> = {};
        try {
          const pipelineRes = await fetch(`${SUPABASE_URL}/functions/v1/mistral-document-pipeline`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
              apikey: ANON_KEY,
            },
            body: JSON.stringify({
              document_id: crypto.randomUUID(),
              bucket: BUCKET,
              path: docPath,
              file_kind: fileKind,
              declared_family: "passport_id",
              signed_url: signed.signedUrl,
            }),
          });
          const pipelineJson = await pipelineRes.json().catch(() => ({}));
          readerPayload = pipelineJson;
          readerVerdict = mapReaderVerdict(
            pipelineJson?.truth_state,
            pipelineJson?.family,
            pipelineJson?.lane_confidence,
          );
        } catch (e) {
          readerPayload = { error: String(e) };
          readerVerdict = "weak";
        }

        // Only persist activation if reader said the doc is acceptable.
        // For weak/unsupported we return verdict so UI can stop the flow.
        if (readerVerdict !== "accepted_preliminarily") {
          return jres({
            ok: true,
            data: {
              activation_id: null,
              identity_status: "none",
              reader_verdict: readerVerdict,
            },
          });
        }

        // 4. Persist activation as pending
        const { data: row, error: insErr } = await admin
          .from("identity_activations")
          .insert({
            user_id: userId,
            doc_kind: docKind,
            doc_storage_path: docPath,
            selfie_storage_path: selfiePath,
            video_storage_path: videoPath,
            reader_verdict: readerVerdict,
            reader_payload: readerPayload,
            status: "pending",
            client_trace_id: clientTrace || null,
          })
          .select("id, status, created_at")
          .single();

        if (insErr) {
          return jres({ ok: false, error: "persist_failed", details: insErr.message }, 500);
        }

        return jres({
          ok: true,
          data: {
            activation_id: row.id,
            identity_status: row.status,
            reader_verdict: readerVerdict,
            submitted_at: row.created_at,
          },
        });
      }

      // ─── Read identity status ────────────────────────────────
      case "identity.status.get": {
        const { data, error } = await admin
          .from("identity_status_mirror")
          .select(
            "status, last_activation_id, decision_reason_code, reupload_required_fields, blocks_academic_file, decided_at",
          )
          .eq("user_id", userId)
          .maybeSingle();
        if (error) return jres({ ok: false, error: "read_failed", details: error.message }, 500);
        if (!data) {
          return jres({
            ok: true,
            data: {
              identity_status: "none",
              blocks_academic_file: true,
              last_activation_id: null,
              decision_reason_code: null,
              reupload_required_fields: null,
              decided_at: null,
            },
          });
        }
        return jres({
          ok: true,
          data: {
            identity_status: data.status,
            blocks_academic_file: data.blocks_academic_file,
            last_activation_id: data.last_activation_id,
            decision_reason_code: data.decision_reason_code,
            reupload_required_fields: data.reupload_required_fields,
            decided_at: data.decided_at,
          },
        });
      }

      // ─── Support: create ticket ──────────────────────────────
      case "support.ticket.create": {
        const body = String(payload.body ?? "").trim();
        const subjectKey = payload.subject_key ? String(payload.subject_key) : null;
        const attachment = payload.attachment_storage_path
          ? String(payload.attachment_storage_path)
          : null;
        const clientTrace = String(payload.client_trace_id ?? "");
        if (!body || body.length < 4) {
          return jres({ ok: false, error: "body_too_short" }, 400);
        }
        if (body.length > 5000) {
          return jres({ ok: false, error: "body_too_long" }, 400);
        }
        const { data, error } = await admin
          .from("support_tickets")
          .insert({
            user_id: userId,
            subject_key: subjectKey,
            body,
            attachment_storage_path: attachment,
            origin: "portal_account",
            client_trace_id: clientTrace || null,
          })
          .select("id, status, created_at")
          .single();
        if (error) return jres({ ok: false, error: "create_failed", details: error.message }, 500);
        return jres({
          ok: true,
          data: { ticket_id: data.id, status: data.status, created_at: data.created_at },
        });
      }

      // ─── Support: list user tickets ──────────────────────────
      case "support.ticket.list": {
        const { data, error } = await admin
          .from("support_tickets")
          .select("id, subject_key, status, created_at, updated_at, last_reply_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return jres({ ok: false, error: "list_failed", details: error.message }, 500);

        const mapUiState = (s: string) =>
          s === "open" ? "submitted"
          : s === "in_progress" ? "under_review"
          : "resolved"; // resolved | closed

        return jres({
          ok: true,
          data: {
            tickets: (data ?? []).map((t) => ({
              ticket_id: t.id,
              subject_key: t.subject_key,
              status: t.status,
              ui_state: mapUiState(t.status),
              created_at: t.created_at,
              updated_at: t.updated_at,
              last_reply_at: t.last_reply_at,
            })),
          },
        });
      }

      default:
        return jres({ ok: false, error: "unknown_action" }, 400);
    }
  } catch (e) {
    console.error("[portal-identity-support] error", e);
    return jres({ ok: false, error: "internal_error", details: String(e) }, 500);
  }
});
