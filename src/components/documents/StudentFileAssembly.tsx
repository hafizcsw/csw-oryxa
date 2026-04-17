// ═══════════════════════════════════════════════════════════════
// StudentFileAssembly — pipeline-honest assembly experience
// ═══════════════════════════════════════════════════════════════
// Layout:
//   ┌──────────────────────────────────────────────────────────┐
//   │  Queue (left)   │  Central Intake Core  │  Sections (right) │
//   │  - waiting      │  - active file scene  │  - identity       │
//   │  - active       │  - discovery title    │  - academic       │
//   │  - completed    │  - field emergence    │  - language       │
//   └──────────────────────────────────────────────────────────┘
//   Final: Assembled summary
// ═══════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ScanSearch,
  IdCard,
  GraduationCap,
  Languages,
  Sparkles,
  Inbox,
} from "lucide-react";
import {
  useStudentFileAssembly,
  type AssemblyFile,
  type AssemblyStage,
  type DocCategory,
  type ExtractedField,
  type FieldStatus,
  type FailureReason,
} from "@/features/documents/useStudentFileAssembly";

interface Props {
  studentId: string | null;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";

// ── Stage labels (English fallbacks; translation keys preferred) ──
const STAGE_LABEL: Record<AssemblyStage, { key: string; fallback: string }> = {
  queued:       { key: "portal.assembly.stage.queued",       fallback: "Waiting in queue" },
  intake:       { key: "portal.assembly.stage.intake",       fallback: "Receiving file" },
  reading:      { key: "portal.assembly.stage.reading",      fallback: "Reading document" },
  classifying:  { key: "portal.assembly.stage.classifying",  fallback: "Identifying document type" },
  extracting:   { key: "portal.assembly.stage.extracting",   fallback: "Extracting fields" },
  placing:      { key: "portal.assembly.stage.placing",      fallback: "Placing into your file" },
  done:         { key: "portal.assembly.stage.done",         fallback: "Done" },
  failed:       { key: "portal.assembly.stage.failed",       fallback: "Could not process" },
};

const FAILURE_LABEL: Record<FailureReason, { key: string; fallback: string }> = {
  unsupported_file_type:      { key: "portal.assembly.fail.unsupported_file_type",      fallback: "Unsupported file type" },
  unsupported_in_v1:          { key: "portal.assembly.fail.unsupported_in_v1",          fallback: "Not part of this step (passport / transcript / graduation / language only)" },
  unreadable_scan:            { key: "portal.assembly.fail.unreadable_scan",            fallback: "Scan is unreadable — please re-upload a clearer copy" },
  low_ocr_quality:            { key: "portal.assembly.fail.low_ocr_quality",            fallback: "Quality is too low to extract fields" },
  classification_uncertain:   { key: "portal.assembly.fail.classification_uncertain",   fallback: "Could not confidently identify the document type" },
  extraction_partial:         { key: "portal.assembly.fail.extraction_partial",         fallback: "Some fields were extracted; others need review" },
  extraction_failed:          { key: "portal.assembly.fail.extraction_failed",          fallback: "Extraction failed" },
  conflict_with_existing_truth:{key: "portal.assembly.fail.conflict_with_existing_truth",fallback: "Conflicts with previously accepted information" },
  review_required:            { key: "portal.assembly.fail.review_required",            fallback: "Manual review required" },
  file_too_large:             { key: "portal.assembly.fail.file_too_large",             fallback: "File is too large" },
  rate_limited:               { key: "portal.assembly.fail.rate_limited",               fallback: "Too many requests — try again in a moment" },
  ai_gateway_error:           { key: "portal.assembly.fail.ai_gateway_error",           fallback: "AI service unavailable" },
};

function useT() {
  const { t } = useLanguage();
  return useCallback(
    (key: string, fallback: string) => {
      const v = t(key);
      return v && v !== key ? v : fallback;
    },
    [t],
  );
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ImageIcon;
  return FileText;
}

// ───────────────────────────────────────────────────────────────
// Queue rail (left)
// ───────────────────────────────────────────────────────────────
function QueueRail({
  files,
  activeId,
  tt,
}: {
  files: AssemblyFile[];
  activeId: string | null;
  tt: ReturnType<typeof useT>;
}) {
  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-background/40 p-4 h-full flex flex-col items-center justify-center text-center">
        <Inbox className="w-6 h-6 text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">
          {tt("portal.assembly.queue.empty", "Drop files into the core →")}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/40 bg-background/40 p-3 h-full">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {tt("portal.assembly.queue.title", "Queue")} · {files.length}
      </h4>
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {files.map((f) => {
          const Icon = fileIcon(f.file_name);
          const isActive = f.id === activeId;
          const isDone = f.stage === "done";
          const isFailed = f.stage === "failed";
          const isWaiting = f.stage === "queued";
          return (
            <div
              key={f.id}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all text-xs",
                isActive && "border-primary/60 bg-primary/5 shadow-sm ring-1 ring-primary/20",
                isDone && !isActive && "border-emerald-500/30 bg-emerald-500/5",
                isFailed && "border-destructive/40 bg-destructive/5",
                isWaiting && "border-border/40 bg-muted/20 opacity-70",
                !isActive && !isDone && !isFailed && !isWaiting && "border-border/40 bg-background/60",
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 shrink-0", {
                "text-primary": isActive,
                "text-emerald-600 dark:text-emerald-400": isDone,
                "text-destructive": isFailed,
                "text-muted-foreground": !isActive && !isDone && !isFailed,
              })} />
              <span className="flex-1 truncate font-medium">{f.file_name}</span>
              {isActive && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
              {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
              {isFailed && <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Central intake core (drop zone + active file scene)
// ───────────────────────────────────────────────────────────────
function CentralCore({
  active,
  onFiles,
  disabled,
  tt,
}: {
  active: AssemblyFile | null;
  onFiles: (f: File[]) => void;
  disabled?: boolean;
  tt: ReturnType<typeof useT>;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) onFiles(files);
  };

  const stage = active?.stage;
  const isReading = stage === "reading";
  const isClassifying = stage === "classifying";
  const isExtracting = stage === "extracting";
  const isPlacing = stage === "placing";
  const isWorking = isReading || isClassifying || isExtracting || isPlacing;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => !active && inputRef.current?.click()}
      className={cn(
        "relative rounded-3xl border-2 border-dashed transition-all overflow-hidden",
        "min-h-[320px] flex flex-col items-center justify-center cursor-pointer",
        "bg-gradient-to-br from-background via-background to-muted/30",
        drag && "border-primary bg-primary/5 scale-[1.01]",
        !drag && "border-border/60 hover:border-primary/40",
        disabled && "opacity-50 cursor-not-allowed",
        isWorking && "cursor-default",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => {
          const fs = Array.from(e.target.files || []);
          if (fs.length) onFiles(fs);
          e.target.value = "";
        }}
      />

      {/* Pulsing core ring (only when actively working — bound to real state) */}
      {isWorking && (
        <>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 rounded-full border border-primary/30 animate-ping opacity-30" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-32 rounded-full bg-primary/10 blur-2xl animate-pulse" />
          </div>
        </>
      )}

      {/* IDLE STATE */}
      {!active && (
        <div className="relative z-10 flex flex-col items-center text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Upload className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {tt("portal.assembly.core.dropTitle", "Drop your documents here")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            {tt(
              "portal.assembly.core.dropHint",
              "Passport · Transcript · Graduation · Language certificate",
            )}
          </p>
        </div>
      )}

      {/* ACTIVE FILE SCENE */}
      {active && (
        <div className="relative z-10 flex flex-col items-center text-center px-6 py-8 w-full">
          {/* File name */}
          <p className="text-[11px] font-mono text-muted-foreground mb-3 truncate max-w-full">
            {active.file_name}
          </p>

          {/* Discovery title */}
          {(isClassifying || stage === "intake" || isReading) && (
            <div className="flex items-center gap-2 mb-2 text-primary">
              <ScanSearch className="w-5 h-5 animate-pulse" />
              <span className="text-sm font-semibold">
                {isReading
                  ? tt("portal.assembly.core.reading", "Reading document…")
                  : isClassifying
                  ? tt("portal.assembly.core.classifying", "Identifying document type…")
                  : tt("portal.assembly.core.intake", "Receiving file…")}
              </span>
            </div>
          )}

          {/* Document type discovered */}
          {(isExtracting || isPlacing || stage === "done") && active.document_type !== "unknown" && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {tt("portal.assembly.core.discovered", "Detected")}
              </p>
              <h2 className="text-xl font-bold text-foreground">
                {active.document_type_label || active.document_type}
              </h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {tt("portal.assembly.core.confidence", "Confidence")}{" "}
                {Math.round(active.classification_confidence * 100)}%
              </p>
            </div>
          )}

          {/* Quality strip */}
          {active.quality && (isExtracting || isPlacing || stage === "done") && (
            <div className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border mb-3",
              active.quality === "excellent" || active.quality === "good"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : active.quality === "acceptable"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-destructive/50 bg-destructive/10 text-destructive",
            )}>
              {tt(`portal.assembly.quality.${active.quality}`, active.quality)} · {active.quality_score}/100
            </div>
          )}

          {/* Stage indicator */}
          {stage !== "failed" && (
            <p className="text-xs text-muted-foreground italic">
              {tt(STAGE_LABEL[stage!].key, STAGE_LABEL[stage!].fallback)}
            </p>
          )}

          {/* Failure surface */}
          {stage === "failed" && active.failure_reason && (
            <div className="mt-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/40 text-destructive max-w-md">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-semibold">
                  {tt("portal.assembly.core.failTitle", "Could not assemble this document")}
                </span>
              </div>
              <p className="text-xs">
                {tt(
                  FAILURE_LABEL[active.failure_reason].key,
                  FAILURE_LABEL[active.failure_reason].fallback,
                )}
              </p>
            </div>
          )}

          {/* Placement burst */}
          {isPlacing && (
            <div className="mt-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="text-xs font-medium">
                {tt("portal.assembly.core.placing", "Placing into your file…")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Live extraction reveal (under core, bound to active file)
// ───────────────────────────────────────────────────────────────
function LiveExtractionFields({
  active,
  tt,
}: {
  active: AssemblyFile | null;
  tt: ReturnType<typeof useT>;
}) {
  if (!active || (active.stage !== "extracting" && active.stage !== "placing" && active.stage !== "done")) {
    return null;
  }
  const visible = active.fields.slice(0, active.revealed_field_count);
  if (visible.length === 0 && active.stage === "extracting") {
    return (
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground italic">
          {tt("portal.assembly.fields.preparing", "Preparing fields…")}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
      {visible.map((f, i) => (
        <FieldRow key={f.path} field={f} index={i} tt={tt} />
      ))}
    </div>
  );
}

function FieldRow({
  field,
  index,
  tt,
}: {
  field: ExtractedField;
  index: number;
  tt: ReturnType<typeof useT>;
}) {
  const sevStyles: Record<FieldStatus, string> = {
    accepted: "border-emerald-500/40 bg-emerald-500/5",
    pending_review: "border-amber-500/40 bg-amber-500/5",
    unresolved: "border-destructive/40 bg-destructive/5",
  };
  const sevTone: Record<FieldStatus, string> = {
    accepted: "text-emerald-700 dark:text-emerald-300",
    pending_review: "text-amber-700 dark:text-amber-300",
    unresolved: "text-destructive",
  };
  return (
    <div
      className={cn(
        "px-3 py-2 rounded-xl border text-xs animate-in fade-in slide-in-from-bottom-1 duration-300",
        sevStyles[field.status],
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {field.label || field.path}
        </span>
        <span className={cn("text-[10px] font-semibold", sevTone[field.status])}>
          {field.status === "accepted"
            ? tt("portal.assembly.fields.accepted", "✓ accepted")
            : field.status === "pending_review"
            ? tt("portal.assembly.fields.pending", "review")
            : tt("portal.assembly.fields.unresolved", "unresolved")}
        </span>
      </div>
      <div className="font-medium text-foreground truncate">
        {field.value || (
          <span className="italic text-muted-foreground">
            {tt("portal.assembly.fields.notFound", "(not found)")}
          </span>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Destination sections (right) — Identity / Academic / Language
// ───────────────────────────────────────────────────────────────
const SECTION_META: Record<Exclude<DocCategory, "unknown">, {
  Icon: typeof IdCard;
  key: string;
  fallback: string;
  tone: string;
}> = {
  passport:  { Icon: IdCard,        key: "portal.assembly.section.identity", fallback: "Identity", tone: "from-blue-500/10 to-blue-500/0" },
  academic:  { Icon: GraduationCap, key: "portal.assembly.section.academic", fallback: "Academic", tone: "from-purple-500/10 to-purple-500/0" },
  language:  { Icon: Languages,     key: "portal.assembly.section.language", fallback: "Language", tone: "from-emerald-500/10 to-emerald-500/0" },
};

function DestinationSection({
  cat,
  files,
  active,
  tt,
}: {
  cat: Exclude<DocCategory, "unknown">;
  files: AssemblyFile[];
  active: AssemblyFile | null;
  tt: ReturnType<typeof useT>;
}) {
  const meta = SECTION_META[cat];
  const Icon = meta.Icon;
  const incoming =
    active && active.category === cat && active.stage === "placing";

  const accepted = files.flatMap((f) => f.fields.filter((x) => x.status === "accepted"));
  const pending = files.flatMap((f) => f.fields.filter((x) => x.status === "pending_review"));
  const unresolved = files.flatMap((f) => f.fields.filter((x) => x.status === "unresolved"));

  const hasContent = files.length > 0 || incoming;

  return (
    <div className={cn(
      "relative rounded-2xl border p-3 transition-all overflow-hidden",
      "bg-gradient-to-br",
      meta.tone,
      incoming ? "border-primary/60 ring-2 ring-primary/30 scale-[1.02]" : "border-border/40",
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-foreground" />
        <h4 className="text-sm font-semibold">{tt(meta.key, meta.fallback)}</h4>
        {incoming && (
          <span className="ml-auto text-[10px] font-medium text-primary animate-pulse">
            {tt("portal.assembly.section.incoming", "incoming…")}
          </span>
        )}
      </div>

      {!hasContent && (
        <p className="text-[11px] text-muted-foreground italic">
          {tt("portal.assembly.section.empty", "Nothing here yet")}
        </p>
      )}

      {hasContent && (
        <>
          <div className="flex items-center gap-2 text-[10px] mb-2">
            {accepted.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono">
                {accepted.length} {tt("portal.assembly.section.accepted", "accepted")}
              </span>
            )}
            {pending.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono">
                {pending.length} {tt("portal.assembly.section.pending", "pending")}
              </span>
            )}
            {unresolved.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-mono">
                {unresolved.length} {tt("portal.assembly.section.unresolved", "unresolved")}
              </span>
            )}
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {files.flatMap((f) =>
              f.fields.map((field) => (
                <div
                  key={`${f.id}::${field.path}`}
                  className="flex items-center gap-1.5 text-[11px]"
                >
                  {field.status === "accepted" && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  {field.status === "pending_review" && (
                    <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  {field.status === "unresolved" && (
                    <XCircle className="w-3 h-3 text-destructive shrink-0" />
                  )}
                  <span className="text-muted-foreground shrink-0">
                    {field.label || field.path}:
                  </span>
                  <span className="font-medium truncate">
                    {field.value || "—"}
                  </span>
                </div>
              )),
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Final assembled summary
// ───────────────────────────────────────────────────────────────
function AssembledSummary({
  counts,
  totalFiles,
  failedFiles,
  tt,
}: {
  counts: { accepted: number; pending: number; unresolved: number; failed: number };
  totalFiles: number;
  failedFiles: number;
  tt: ReturnType<typeof useT>;
}) {
  if (totalFiles === 0) return null;
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-background p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">
          {tt("portal.assembly.summary.title", "Student File Assembled")}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryStat n={counts.accepted}   label={tt("portal.assembly.summary.acceptedFacts", "Accepted facts")} tone="emerald" />
        <SummaryStat n={counts.pending}    label={tt("portal.assembly.summary.pendingReview",  "Pending review")} tone="amber" />
        <SummaryStat n={counts.unresolved} label={tt("portal.assembly.summary.unresolved",     "Unresolved")} tone="destructive" />
        <SummaryStat n={failedFiles}       label={tt("portal.assembly.summary.failedFiles",    "Failed files")} tone="destructive" />
      </div>
    </div>
  );
}

function SummaryStat({ n, label, tone }: { n: number; label: string; tone: "emerald" | "amber" | "destructive" }) {
  const styles = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    destructive: "border-destructive/30 bg-destructive/5 text-destructive",
  }[tone];
  return (
    <div className={cn("rounded-lg border p-2.5", styles)}>
      <div className="text-2xl font-bold leading-none">{n}</div>
      <div className="text-[10px] mt-1 opacity-80">{label}</div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────
export function StudentFileAssembly({ studentId, disabled }: Props) {
  const tt = useT();
  const { files, activeFile, enqueueFiles, assembled } = useStudentFileAssembly({
    studentId,
  });

  const passportFiles = useMemo(() => assembled.byCat.passport, [assembled]);
  const academicFiles = useMemo(() => assembled.byCat.academic, [assembled]);
  const languageFiles = useMemo(() => assembled.byCat.language, [assembled]);

  return (
    <div className="space-y-4">
      {/* Top: queue + core + sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Queue (left) */}
        <div className="lg:col-span-3">
          <QueueRail files={files} activeId={activeFile?.id ?? null} tt={tt} />
        </div>

        {/* Core (center) */}
        <div className="lg:col-span-6 space-y-3">
          <CentralCore
            active={activeFile}
            onFiles={enqueueFiles}
            disabled={disabled}
            tt={tt}
          />
          <LiveExtractionFields active={activeFile} tt={tt} />
        </div>

        {/* Destination sections (right) */}
        <div className="lg:col-span-3 space-y-2.5">
          <DestinationSection cat="passport" files={passportFiles} active={activeFile} tt={tt} />
          <DestinationSection cat="academic" files={academicFiles} active={activeFile} tt={tt} />
          <DestinationSection cat="language" files={languageFiles} active={activeFile} tt={tt} />
        </div>
      </div>

      {/* Final assembled summary */}
      <AssembledSummary
        counts={assembled.counts}
        totalFiles={files.length}
        failedFiles={assembled.counts.failed}
        tt={tt}
      />
    </div>
  );
}
