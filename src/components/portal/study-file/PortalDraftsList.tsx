// ═══════════════════════════════════════════════════════════════
// PortalDraftsList — Order 2 minimal UI
// ───────────────────────────────────────────────────────────────
// Shows Study File drafts uploaded to the portal-drafts bucket.
// Clearly states they are NOT shared with CSW.
// ═══════════════════════════════════════════════════════════════

import { Button } from "@/components/ui/button";
import { Trash2, FileText, Loader2, AlertTriangle } from "lucide-react";
import type { PortalDraft } from "@/features/documents/portalDrafts";
import type { PortalDraftPending } from "@/hooks/usePortalDrafts";
import { useTranslation } from "react-i18next";

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

export function PortalDraftsList({ drafts, pending, onDelete }: PortalDraftsListProps) {
  const { t } = useTranslation();
  const total = drafts.length + pending.length;
  if (total === 0) return null;

  const headline = t(
    "studyFile.drafts.headline",
    "Draft uploaded — not shared with CSW",
  );
  const subline = t(
    "studyFile.drafts.subline",
    "Awaiting your review — not yet sent to CSW.",
  );

  return (
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
          <li
            key={p.tempId}
            className="flex items-center gap-3 p-3 text-sm"
          >
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
                  ? t("studyFile.drafts.statusUploading", "Uploading draft…")
                  : t("studyFile.drafts.statusFailed", "Upload failed")}
                {p.error ? ` — ${p.error}` : ""}
              </p>
            </div>
          </li>
        ))}

        {drafts.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 p-3 text-sm"
          >
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{d.original_file_name}</p>
              <p className="text-xs text-muted-foreground">
                {d.mime_type || "file"} · {formatSize(d.file_size)} ·{" "}
                <span className="font-medium text-foreground">
                  {t("studyFile.drafts.statusDraft", "Portal draft")}
                </span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(d.id)}
              aria-label={t("studyFile.drafts.delete", "Delete draft")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
