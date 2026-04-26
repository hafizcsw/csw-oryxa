// ═══════════════════════════════════════════════════════════════
// PortalDraftsList — Order 3R.2
// ───────────────────────────────────────────────────────────────
// Student-friendly list of Study File drafts.
//
// • Active drafts (running / pending / ready / recent failure) appear
//   in the main list with a friendly status label.
// • Legacy / superseded drafts are tucked into a collapsed section.
// • Successful drafts open a read-only Review drawer.
// • An "External OCR used" badge is shown on image drafts whose
//   extraction relied on the transitional Mistral OCR provider.
//
// No CRM contact. No re-extraction wired (Retry is a placeholder).
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Trash2,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronDown,
  RotateCw,
  Eye,
  ShieldCheck,
} from "lucide-react";
import type { PortalDraft } from "@/features/documents/portalDrafts";
import type { PortalDraftPending } from "@/hooks/usePortalDrafts";
import { useTranslation } from "react-i18next";
import {
  classifyStudyFileDraft,
  isLegacyState,
  isMainListState,
  type StudyFileDisplayState,
} from "@/features/student-file/classifyStudyFileDraft";
import { useDraftExtractions } from "@/hooks/useDraftExtractions";
import { StudyFileReviewDrawer } from "./StudyFileReviewDrawer";

interface PortalDraftsListProps {
  drafts: PortalDraft[];
  pending: PortalDraftPending[];
  onDelete: (draftId: string) => void;
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isImageDraft(d: PortalDraft): boolean {
  const m = (d.mime_type ?? "").toLowerCase();
  return m.startsWith("image/");
}

interface StateMeta {
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  spin?: boolean;
}

function getStateMeta(
  state: StudyFileDisplayState,
  t: (k: string, d?: string) => any,
): StateMeta {
  switch (state) {
    case "uploaded_pending":
      return {
        label: t("portal.studyFile.drafts.stateUploadedPending", "Uploaded — awaiting extraction"),
        icon: Sparkles,
        color: "text-muted-foreground",
      };
    case "reading_document":
      return {
        label: t("portal.studyFile.drafts.stateReading", "Reading document"),
        icon: Loader2,
        color: "text-muted-foreground",
        spin: true,
      };
    case "extracting_information":
      return {
        label: t("portal.studyFile.drafts.stateExtracting", "Extracting information"),
        icon: Loader2,
        color: "text-muted-foreground",
        spin: true,
      };
    case "ready_for_review":
      return {
        label: t("portal.studyFile.drafts.stateReady", "Ready for review"),
        icon: CheckCircle2,
        color: "text-emerald-600",
      };
    case "failed_retryable":
      return {
        label: t("portal.studyFile.drafts.stateFailedRetryable", "Needs retry"),
        icon: XCircle,
        color: "text-destructive",
      };
    case "failed_legacy":
      return {
        label: t("portal.studyFile.drafts.stateFailedLegacy", "Older failed draft"),
        icon: XCircle,
        color: "text-muted-foreground",
      };
    case "superseded":
      return {
        label: t("portal.studyFile.drafts.stateSuperseded", "Replaced by a newer upload"),
        icon: XCircle,
        color: "text-muted-foreground",
      };
    case "submitted_to_csw":
      return {
        label: t("portal.studyFile.drafts.stateSubmitted", "Sent to CSW"),
        icon: CheckCircle2,
        color: "text-emerald-600",
      };
  }
}

export function PortalDraftsList({ drafts, pending, onDelete }: PortalDraftsListProps) {
  const { t } = useTranslation();
  const [reviewDraftId, setReviewDraftId] = useState<string | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);

  // Latest success per filename (used to mark older failures as superseded).
  // PortalDraft type doesn't expose extraction_completed_at — fall back to created_at.
  const latestSuccessByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of drafts as Array<PortalDraft & { extraction_completed_at?: string | null }>) {
      const completedAt = d.extraction_completed_at ?? d.created_at;
      if (
        d.extraction_status === "extraction_completed" &&
        completedAt &&
        d.original_file_name
      ) {
        const cur = map[d.original_file_name];
        if (!cur || Date.parse(completedAt) > Date.parse(cur)) {
          map[d.original_file_name] = completedAt;
        }
      }
    }
    return map;
  }, [drafts]);

  // Pull extraction rows for completed drafts (RLS-scoped)
  const completedDraftIds = useMemo(
    () =>
      drafts
        .filter((d) => d.extraction_status === "extraction_completed")
        .map((d) => d.id),
    [drafts],
  );
  const { byDraftId: extractionByDraftId } = useDraftExtractions(completedDraftIds);

  // Classify
  const classified = useMemo(() => {
    return (drafts as Array<PortalDraft & { extraction_completed_at?: string | null; extraction_error?: string | null }>).map((d) => {
      const hasExtractionRow = !!extractionByDraftId[d.id];
      const latestSuccessForName = d.original_file_name
        ? latestSuccessByName[d.original_file_name] ?? null
        : null;
      const completedAt = d.extraction_completed_at ?? null;
      const supersedingTime =
        latestSuccessForName && completedAt !== latestSuccessForName
          ? latestSuccessForName
          : null;
      const state = classifyStudyFileDraft(d, {
        hasExtractionRow,
        latestSuccessAtForFileName: supersedingTime,
      });
      return { draft: d, state };
    });
  }, [drafts, extractionByDraftId, latestSuccessByName]);

  const main = classified.filter(({ state }) => isMainListState(state));
  const legacy = classified.filter(({ state }) => isLegacyState(state));

  const total = drafts.length + pending.length;
  if (total === 0) return null;

  const headline = t(
    "portal.studyFile.drafts.headline",
    "Draft uploaded — not shared with CSW",
  );
  const subline = t(
    "portal.studyFile.drafts.subline",
    "Awaiting your review — not yet sent to CSW.",
  );

  const reviewDraft = reviewDraftId
    ? drafts.find((d) => d.id === reviewDraftId) ?? null
    : null;
  const reviewExtraction = reviewDraftId ? extractionByDraftId[reviewDraftId] ?? null : null;

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">{headline}</p>
            <p className="text-xs text-muted-foreground">{subline}</p>
          </div>
        </div>

        <ul className="divide-y divide-border rounded-md border border-border bg-background">
          {pending.map((p) => (
            <li key={p.tempId} className="flex items-center gap-3 p-3 text-sm">
              {p.status === "uploading" ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{p.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {p.mimeType || "file"} · {formatSize(p.fileSize)} ·{" "}
                  {p.status === "uploading"
                    ? t("portal.studyFile.drafts.statusUploading", "Uploading draft…")
                    : t("portal.studyFile.drafts.statusFailed", "Upload failed")}
                  {p.error ? ` — ${p.error}` : ""}
                </p>
              </div>
            </li>
          ))}

          {main.map(({ draft: d, state }) => {
            const meta = getStateMeta(state, t);
            const Icon = meta.icon;
            const showExternalOcrBadge =
              state === "ready_for_review" && isImageDraft(d);
            const canReview = state === "ready_for_review";
            const canRetry = state === "failed_retryable";
            return (
              <li key={d.id} className="flex items-center gap-3 p-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{d.original_file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.mime_type || "file"} · {formatSize(d.file_size)} ·{" "}
                    <span className="font-medium text-foreground">
                      {t("portal.studyFile.drafts.statusDraft", "Portal draft")}
                    </span>
                  </p>
                  <div className="mt-1 flex items-center flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs ${meta.color}`}>
                      <Icon className={`h-3 w-3 ${meta.spin ? "animate-spin" : ""}`} />
                      {meta.label}
                    </span>
                    {showExternalOcrBadge && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="gap-1 text-[10px] py-0 h-5 border-amber-200 text-amber-700"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {t(
                              "portal.studyFile.drafts.externalOcrBadge",
                              "External OCR used",
                            )}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          {t(
                            "portal.studyFile.drafts.externalOcrTooltip",
                            "Only the recognised text was sent to the analyser. Your file stays in private storage.",
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                {canReview && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setReviewDraftId(d.id)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t("portal.studyFile.drafts.review", "Review")}
                  </Button>
                )}
                {canRetry && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled
                          aria-disabled
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                          {t("portal.studyFile.drafts.retry", "Retry")}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      {t(
                        "portal.studyFile.drafts.retryComingSoon",
                        "Retry will be enabled once safe re-extraction is wired.",
                      )}
                    </TooltipContent>
                  </Tooltip>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(d.id)}
                  aria-label={t("portal.studyFile.drafts.delete", "Delete draft")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>

        {legacy.length > 0 && (
          <Collapsible open={legacyOpen} onOpenChange={setLegacyOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
                <span>
                  {t("portal.studyFile.drafts.legacyHeading", "Older failed drafts")} ·{" "}
                  {legacy.length}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    legacyOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-background/60">
                {legacy.map(({ draft: d, state }) => {
                  const meta = getStateMeta(state, t);
                  const Icon = meta.icon;
                  return (
                    <li key={d.id} className="flex items-center gap-3 p-3 text-xs">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-muted-foreground">
                          {d.original_file_name}
                        </p>
                        <p className={`inline-flex items-center gap-1 ${meta.color}`}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(d.id)}
                        aria-label={t("portal.studyFile.drafts.delete", "Delete draft")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <StudyFileReviewDrawer
        open={!!reviewDraftId}
        onOpenChange={(o) => !o && setReviewDraftId(null)}
        fileName={reviewDraft?.original_file_name ?? null}
        extraction={reviewExtraction}
      />
    </TooltipProvider>
  );
}
