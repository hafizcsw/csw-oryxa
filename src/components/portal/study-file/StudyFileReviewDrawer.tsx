// ═══════════════════════════════════════════════════════════════
// StudyFileReviewDrawer — Order 3R.2
// ───────────────────────────────────────────────────────────────
// Read-only drawer that lets the student inspect what was extracted
// from a successful Study File draft. Shows extracted facts with
// evidence quotes, missing fields, OCR engine, and trace_id.
//
// No editing. No CRM contact. No re-extraction.
// ═══════════════════════════════════════════════════════════════

import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle, ShieldCheck, FileText } from "lucide-react";
import type { DraftExtractionRow } from "@/hooks/useDraftExtractions";

interface StudyFileReviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string | null;
  extraction: DraftExtractionRow | null;
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function StudyFileReviewDrawer({
  open,
  onOpenChange,
  fileName,
  extraction,
}: StudyFileReviewDrawerProps) {
  const { t } = useTranslation();

  const factEntries = extraction
    ? Object.entries(extraction.facts ?? {})
    : [];

  const hasExternalOcr =
    !!extraction &&
    extraction.ocr_quality_flags.some(
      (f) => f === "external_ocr_provider" || f === "mistral_ocr_transitional",
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-hidden flex flex-col"
      >
        <SheetHeader className="text-start">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {fileName ?? t("portal.studyFile.review.title", "Review extracted information")}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {t(
              "portal.studyFile.review.subline",
              "Read-only review. Nothing has been sent to CSW.",
            )}
          </SheetDescription>
        </SheetHeader>

        {!extraction ? (
          <div className="py-8 text-sm text-muted-foreground">
            {t("portal.studyFile.review.empty", "No extraction available yet.")}
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-5 py-4">
              {/* Family + confidence */}
              <div className="flex flex-wrap items-center gap-2">
                {extraction.family && (
                  <Badge variant="secondary" className="font-medium">
                    {extraction.family}
                  </Badge>
                )}
                {typeof extraction.lane_confidence === "number" && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {t("portal.studyFile.review.confidence", "Confidence")}:{" "}
                    {(extraction.lane_confidence * 100).toFixed(0)}%
                  </Badge>
                )}
                {extraction.truth_state && (
                  <Badge variant="outline" className="text-xs">
                    {extraction.truth_state}
                  </Badge>
                )}
              </div>

              {/* External-OCR transparency */}
              {hasExternalOcr && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-xs">
                  <ShieldCheck className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-200">
                      {t(
                        "portal.studyFile.review.externalOcrTitle",
                        "External OCR used for text extraction",
                      )}
                    </p>
                    <p className="text-amber-800/80 dark:text-amber-200/80">
                      {t(
                        "portal.studyFile.review.externalOcrBody",
                        "Only the recognised text was sent to the analyser. The original file stays in your private storage.",
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Facts */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {t("portal.studyFile.review.factsHeading", "Extracted information")}
                </h3>
                {factEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("portal.studyFile.review.noFacts", "No fields were extracted.")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {factEntries.map(([key, fact]) => {
                      const hasEvidence = !!(fact?.evidence_id && fact?.evidence_quote);
                      return (
                        <li key={key} className="p-3 space-y-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                {key}
                              </p>
                              <p className="text-sm font-medium break-words">
                                {formatValue(fact?.value)}
                              </p>
                            </div>
                            {hasEvidence ? (
                              <Badge
                                variant="outline"
                                className="shrink-0 gap-1 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-900"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {t("portal.studyFile.review.evidenceOk", "Evidence")}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="shrink-0 gap-1 text-amber-700 border-amber-200"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {t("portal.studyFile.review.evidenceMissing", "Unverified")}
                              </Badge>
                            )}
                          </div>
                          {hasEvidence && (
                            <blockquote className="text-xs text-muted-foreground border-s-2 border-border ps-2 break-words">
                              “{fact.evidence_quote}”
                            </blockquote>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Missing fields */}
              {extraction.missing_fields.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {t("portal.studyFile.review.missingHeading", "Not found in this document")}
                  </h3>
                  <ul className="rounded-md border border-border divide-y divide-border">
                    {extraction.missing_fields.map((m) => (
                      <li key={m.key} className="p-3 text-sm">
                        <span className="font-medium">{m.key}</span>
                        {m.reason && (
                          <span className="block text-xs text-muted-foreground">
                            {m.reason}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <Separator />

              {/* Engine details */}
              <section className="space-y-1.5 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">
                    {t("portal.studyFile.review.ocrEngine", "OCR engine")}:
                  </span>{" "}
                  {extraction.ocr_engine_path ?? "—"}
                  {typeof extraction.ocr_chars === "number" && (
                    <> · {extraction.ocr_chars} chars</>
                  )}
                  {typeof extraction.ocr_pages === "number" && (
                    <> · {extraction.ocr_pages} pages</>
                  )}
                </p>
                {extraction.ocr_quality_flags.length > 0 && (
                  <p className="break-words">
                    <span className="font-medium text-foreground">
                      {t("portal.studyFile.review.qualityFlags", "Quality flags")}:
                    </span>{" "}
                    {extraction.ocr_quality_flags.join(", ")}
                  </p>
                )}
                {extraction.trace_id && (
                  <p className="font-mono break-all">
                    trace: {extraction.trace_id}
                  </p>
                )}
              </section>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
