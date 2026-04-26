// ═══════════════════════════════════════════════════════════════
// StudyFileMissingSummary — Order 3R.2
// ───────────────────────────────────────────────────────────────
// Read-only summary card listing detected vs not-yet-uploaded
// document kinds for the student's Study File.
//
// • No eligibility logic.
// • No ORX / decision engine.
// • No CRM contact.
// • No reads from document_lane_facts.
// • Pure derivation from already-loaded drafts + extraction rows.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertCircle, FilePlus } from "lucide-react";
import type { PortalDraft } from "@/features/documents/portalDrafts";
import type { DraftExtractionRow } from "@/hooks/useDraftExtractions";

interface StudyFileMissingSummaryProps {
  drafts: PortalDraft[];
  extractionByDraftId: Record<string, DraftExtractionRow>;
}

type Kind = "passport" | "transcript" | "ielts" | "certificate" | "additional";

const ALL_KINDS: Kind[] = ["passport", "transcript", "ielts", "certificate"];

function classifyDraft(
  d: PortalDraft,
  ex: DraftExtractionRow | undefined,
): Kind | null {
  // Only count successful extractions toward "detected"
  if (d.extraction_status !== "extraction_completed") return null;

  const family = (ex?.family ?? "").toLowerCase();
  const name = (d.original_file_name ?? "").toLowerCase();

  if (family.includes("passport") || /passport|nat[_ ]?id|id[_ ]?card/.test(name)) {
    return "passport";
  }
  if (
    family.includes("transcript") ||
    family.includes("grades") ||
    /transcript|grade|marks|kashf/.test(name)
  ) {
    return "transcript";
  }
  if (family.includes("ielts") || family.includes("toefl") || /ielts|toefl|english/.test(name)) {
    return "ielts";
  }
  if (
    family.includes("certificate") ||
    family.includes("diploma") ||
    /certificate|diploma|graduation|secondary/.test(name)
  ) {
    return "certificate";
  }
  return "additional";
}

export function StudyFileMissingSummary({
  drafts,
  extractionByDraftId,
}: StudyFileMissingSummaryProps) {
  const { t } = useTranslation();

  const { detected, missing } = useMemo(() => {
    const found = new Set<Kind>();
    for (const d of drafts) {
      const kind = classifyDraft(d, extractionByDraftId[d.id]);
      if (kind) found.add(kind);
    }
    const det = Array.from(found);
    const miss = ALL_KINDS.filter((k) => !found.has(k));
    return { detected: det, missing: miss };
  }, [drafts, extractionByDraftId]);

  // Hide entirely if there's nothing to talk about
  if (drafts.length === 0) return null;

  const labelFor = (k: Kind) =>
    t(`portal.studyFile.missingSummary.kind.${k}`, k);

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {t("portal.studyFile.missingSummary.title", "Documents in your Study File")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(
            "portal.studyFile.missingSummary.subline",
            "Read-only summary based on what we've detected. Nothing has been sent to CSW.",
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="space-y-1.5">
          <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("portal.studyFile.missingSummary.detectedHeading", "Detected so far")}
          </h4>
          {detected.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "portal.studyFile.missingSummary.noneDetected",
                "No documents detected yet.",
              )}
            </p>
          ) : (
            <ul className="space-y-1">
              {detected.map((k) => (
                <li
                  key={k}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  {labelFor(k)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-1.5">
          <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {t("portal.studyFile.missingSummary.missingHeading", "Not yet uploaded")}
          </h4>
          {missing.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "portal.studyFile.missingSummary.noneMissing",
                "Nothing obvious is missing.",
              )}
            </p>
          ) : (
            <ul className="space-y-1">
              {missing.map((k) => (
                <li
                  key={k}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <FilePlus className="h-3.5 w-3.5 shrink-0" />
                  {labelFor(k)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
