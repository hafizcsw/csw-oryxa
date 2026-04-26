// ═══════════════════════════════════════════════════════════════
// classifyStudyFileDraft — Order 3R.2
// ───────────────────────────────────────────────────────────────
// Pure helper that maps a portal_document_drafts row (+ optional
// extraction row) to a single, student-friendly display state.
//
// No DB writes. No CRM contact. No evaluation logic. Display only.
// ═══════════════════════════════════════════════════════════════

import type { PortalDraft } from "@/features/documents/portalDrafts";

export type StudyFileDisplayState =
  | "uploaded_pending"            // file uploaded, extraction not started yet
  | "reading_document"            // OCR running
  | "extracting_information"      // DeepSeek extraction running
  | "ready_for_review"            // extraction_completed AND extraction row exists
  | "failed_retryable"            // recent failure, may be retried (currently surfaced as informational)
  | "failed_legacy"               // old failure from a discontinued pipeline (e.g. deepseek_ocr_service_not_configured)
  | "superseded"                  // an older row for the same filename has been replaced by a newer success
  | "submitted_to_csw";           // shared_to_crm_at is set (not used yet, but reserved)

export interface ClassifyContext {
  /** True when there is an extraction row in portal_document_draft_extractions for this draft. */
  hasExtractionRow: boolean;
  /** Latest successful extraction_completed_at among siblings with the SAME original_file_name. */
  latestSuccessAtForFileName?: string | null;
}

/**
 * Errors that come from the deprecated self-hosted DeepSeek OCR service.
 * These rows are pre-Mistral-OCR (Order 3R.1). They will never auto-resolve
 * and must be classified as legacy so they don't pollute the main view.
 */
const LEGACY_OCR_ERRORS = new Set<string>([
  "deepseek_ocr_service_not_configured",
  "deepseek_ocr_service_unreachable",
  "deepseek_ocr_service_disabled",
]);

/**
 * Window after which a still-pending extraction is considered stuck/legacy.
 * Real extractions complete within ~60s; anything older than 24h with no row
 * is treated as legacy noise.
 */
const PENDING_LEGACY_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Window during which a recent failure is surfaced as "retryable" for UX
 * affordance only. Older recent failures are still surfaced in the main
 * list but their retry affordance is informational. Anything older than
 * 7 days is bucketed into legacy regardless of error code.
 */
const RECENT_FAILURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function ageMs(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Date.now() - t;
}

export function classifyStudyFileDraft(
  draft: Pick<
    PortalDraft,
    | "extraction_status"
    | "extraction_error" extends keyof PortalDraft ? "extraction_error" : never
    | "extraction_completed_at"
    | "created_at"
    | "shared_to_crm_at"
    | "original_file_name"
  > & {
    extraction_error?: string | null;
    extraction_completed_at?: string | null;
    shared_to_crm_at?: string | null;
  },
  ctx: ClassifyContext = { hasExtractionRow: false },
): StudyFileDisplayState {
  // Reserved for the future "Send to CSW" affordance.
  if (draft.shared_to_crm_at) return "submitted_to_csw";

  const status = (draft.extraction_status ?? "").toString();
  const err = (draft.extraction_error ?? "").toString();

  // Success path: only call it ready when the extraction row really exists.
  if (status === "extraction_completed") {
    return ctx.hasExtractionRow ? "ready_for_review" : "extracting_information";
  }

  // Running statuses
  if (status === "ocr_running") return "reading_document";
  if (status === "deepseek_extraction_running" || status === "extraction_running") {
    return "extracting_information";
  }
  if (status === "ocr_completed") return "extracting_information";

  // Failure paths
  if (status === "extraction_failed") {
    if (LEGACY_OCR_ERRORS.has(err)) return "failed_legacy";

    // If a newer successful sibling exists for the same file name → superseded
    if (
      ctx.latestSuccessAtForFileName &&
      Date.parse(ctx.latestSuccessAtForFileName) >
        Date.parse(draft.created_at ?? "") - 0
    ) {
      return "superseded";
    }

    // Old failures (>7d) → legacy regardless of error code
    if (ageMs(draft.created_at) > RECENT_FAILURE_WINDOW_MS) return "failed_legacy";

    return "failed_retryable";
  }

  // Pending/unknown
  if (ageMs(draft.created_at) > PENDING_LEGACY_AFTER_MS) return "failed_legacy";
  return "uploaded_pending";
}

/**
 * Returns true for states that should appear in the main Study File list.
 * Legacy/superseded rows are routed to a collapsed "Older failed drafts"
 * section instead of being deleted.
 */
export function isMainListState(state: StudyFileDisplayState): boolean {
  return (
    state === "uploaded_pending" ||
    state === "reading_document" ||
    state === "extracting_information" ||
    state === "ready_for_review" ||
    state === "failed_retryable" ||
    state === "submitted_to_csw"
  );
}

/**
 * Returns true for states that go into the collapsed "Older failed drafts"
 * section.
 */
export function isLegacyState(state: StudyFileDisplayState): boolean {
  return state === "failed_legacy" || state === "superseded";
}
