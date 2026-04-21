import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertTriangle, Camera, Video, Upload, RotateCcw, CheckCircle2, X, User, Globe2, Calendar, FileBadge, MapPin, CalendarX2, Check, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  uploadIdentityFile,
  runIdentityReader,
  submitIdentityActivation,
  type IdentityDocKind,
  type ReaderVerdict,
  type ExtractedFieldRead,
} from "@/api/identitySupportInvoke";
import { useIdentityStatus } from "@/hooks/useIdentityStatus";
import { saveExtractedIdentity } from "@/hooks/useExtractedIdentity";

type Step =
  | "doc_select"
  | "reader_running"
  | "blocked_weak"
  | "blocked_unsupported"
  | "accepted_summary"
  | "selfie_capture"
  | "video_capture"
  | "submitting"
  | "submit_error"
  | "awaiting_decision"
  | "approved"
  | "rejected"
  | "reupload_required";

interface IdentityActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved?: () => void;
}

const VIDEO_MAX_MS = 5_000;
// Aligned with CRM `student-docs` bucket file_size_limit (20 MB).
// Do NOT raise above 20 MB without first raising the CRM bucket limit.
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;

// Maps an internal Step to the visible 3-stage stepper position.
// 0 = doc, 1 = selfie, 2 = video. Returns -1 to hide the stepper.
function stepperIndexFor(step: Step): number {
  switch (step) {
    case "doc_select":
    case "reader_running":
    case "blocked_weak":
    case "blocked_unsupported":
    case "accepted_summary":
      return 0;
    case "selfie_capture":
      return 1;
    case "video_capture":
    case "submitting":
    case "submit_error":
      return 2;
    default:
      return -1;
  }
}

export function IdentityActivationDialog({
  open,
  onOpenChange,
  onApproved,
}: IdentityActivationDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { status, refetch } = useIdentityStatus();

  const [step, setStep] = useState<Step>("doc_select");
  const [docKind, setDocKind] = useState<IdentityDocKind>("passport");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docFileId, setDocFileId] = useState<string>("");
  const [readerVerdict, setReaderVerdict] = useState<ReaderVerdict | null>(null);
  const [readerPayload, setReaderPayload] = useState<Record<string, unknown>>({});
  const [extractedFields, setExtractedFields] = useState<Record<string, ExtractedFieldRead>>({});
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfieFileId, setSelfieFileId] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFileId, setVideoFileId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (status.identity_status === "approved") setStep("approved");
    else if (status.identity_status === "rejected") setStep("rejected");
    else if (status.identity_status === "reupload_required") setStep("reupload_required");
    else if (status.identity_status === "pending") setStep("awaiting_decision");
    else setStep("doc_select");
  }, [open, status.identity_status]);

  const reset = useCallback(() => {
    setStep("doc_select");
    setDocFile(null);
    setDocFileId("");
    setReaderVerdict(null);
    setReaderPayload({});
    setExtractedFields({});
    setSelfieFile(null);
    setSelfieFileId("");
    setVideoFile(null);
    setVideoFileId("");
    setErrorMsg("");
  }, []);

  const handleDocChosen = useCallback(
    async (file: File) => {
      setDocFile(file);
      setStep("reader_running");
      setErrorMsg("");
      const up = await uploadIdentityFile("doc", file);
      if (!up.ok) {
        setErrorMsg(up.error || "upload_failed");
        setStep("submit_error");
        return;
      }
      setDocFileId(up.file_id);
      const r = await runIdentityReader({ doc_kind: docKind, id_doc_file_id: up.file_id });
      if (!r.ok || !r.data) {
        setErrorMsg(r.error || "reader_failed");
        setStep("submit_error");
        return;
      }
      setReaderVerdict(r.data.reader_verdict);
      setReaderPayload(r.data.reader_payload || {});
      setExtractedFields(r.data.extracted_fields || {});
      saveExtractedIdentity(r.data.extracted_fields || {});
      if (r.data.reader_verdict === "weak") return setStep("blocked_weak");
      if (r.data.reader_verdict === "unsupported") return setStep("blocked_unsupported");
      setStep("accepted_summary");
    },
    [docKind],
  );

  const handleSelfieCaptured = useCallback(async (file: File) => {
    setSelfieFile(file);
    const up = await uploadIdentityFile("selfie", file);
    if (!up.ok) {
      toast({ title: t("portal.identity.errors.uploadFailed"), variant: "destructive" });
      return;
    }
    setSelfieFileId(up.file_id);
    setStep("video_capture");
  }, [toast, t]);

  const handleVideoCaptured = useCallback(async (file: File) => {
    if (file.size > VIDEO_MAX_BYTES) {
      toast({ title: t("portal.identity.errors.videoTooLarge"), variant: "destructive" });
      return;
    }
    setErrorMsg("");
    setVideoFile(file);
    const up = await uploadIdentityFile("video", file);
    if (!up.ok) {
      const message = up.error || t("portal.identity.errors.uploadFailed");
      setErrorMsg(message);
      toast({
        title: t("portal.identity.errors.uploadFailed"),
        description: message,
        variant: "destructive",
      });
      return;
    }
    setVideoFileId(up.file_id);
    setStep("submitting");
    if (!readerVerdict || readerVerdict !== "accepted_preliminarily") {
      setErrorMsg("reader_not_passed");
      setStep("submit_error");
      return;
    }
    if (!docFileId || !selfieFileId) {
      setErrorMsg("missing_file_ids");
      setStep("submit_error");
      return;
    }
    const res = await submitIdentityActivation({
      id_doc_type: docKind,
      id_doc_file_id: docFileId,
      selfie_file_id: selfieFileId,
      video_file_id: up.file_id,
      reader_verdict: readerVerdict,
      reader_payload: readerPayload,
      client_trace_id: crypto.randomUUID(),
    });
    if (!res.ok || !res.data) {
      setErrorMsg(res.error || "submit_failed");
      setStep("submit_error");
      return;
    }
    setStep("awaiting_decision");
    refetch();
  }, [docKind, docFileId, selfieFileId, readerVerdict, readerPayload, toast, t, refetch]);

  const stepperIdx = stepperIndexFor(step);
  const showStepper = stepperIdx >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "!max-w-[min(1400px,96vw)] w-[96vw]",
          "p-0 overflow-hidden gap-0",
          "bg-gradient-to-br from-background via-background to-muted/30",
          "border-border/60 shadow-2xl rounded-2xl",
          "max-h-[92vh]",
          "[&>button]:hidden",
        )}
      >
        {/* Header */}
        <DialogHeader className="px-5 sm:px-8 pt-6 pb-4 border-b border-border/50 bg-card/40 backdrop-blur-sm space-y-2">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="flex items-center gap-2.5 text-lg sm:text-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-md">
                <ShieldCheck className="w-5 h-5" />
              </div>
              {t("portal.identity.title")}
            </DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <DialogDescription className="text-sm">
            {t("portal.identity.subtitle")}
          </DialogDescription>

          {showStepper && (
            <div className="pt-3">
              <Stepper currentIndex={stepperIdx} />
            </div>
          )}
        </DialogHeader>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 sm:px-8 py-6 sm:py-8" style={{ maxHeight: "calc(92vh - 220px)" }}>
          <div key={step} className="animate-fade-in">
            {step === "doc_select" && (
              <DocSelectStep
                docKind={docKind}
                onKindChange={setDocKind}
                onFileChosen={handleDocChosen}
              />
            )}
            {step === "reader_running" && <RunningStep label={t("portal.identity.reader.running")} />}
            {step === "blocked_weak" && (
              <ResultStep
                tone="warning"
                icon={<AlertTriangle className="w-14 h-14 text-warning" />}
                title={t("portal.identity.result.weak.title")}
                body={t("portal.identity.result.weak.body")}
                ctaLabel={t("portal.identity.cta.retry")}
                onCta={reset}
              />
            )}
            {step === "blocked_unsupported" && (
              <ResultStep
                tone="destructive"
                icon={<X className="w-14 h-14 text-destructive" />}
                title={t("portal.identity.result.unsupported.title")}
                body={t("portal.identity.result.unsupported.body")}
                ctaLabel={t("portal.identity.cta.retry")}
                onCta={reset}
              />
            )}
            {step === "accepted_summary" && (
              <SummaryStep
                fields={extractedFields}
                docKind={docKind}
                onConfirm={() => setStep("selfie_capture")}
                onRetry={reset}
              />
            )}
            {step === "selfie_capture" && (
              <SelfieStep onCaptured={handleSelfieCaptured} />
            )}
            {step === "video_capture" && (
              <VideoStep onCaptured={handleVideoCaptured} errorMessage={errorMsg} />
            )}
            {step === "submitting" && <RunningStep label={t("portal.identity.submit.running")} />}
            {step === "submit_error" && (
              <ResultStep
                tone="destructive"
                icon={<X className="w-14 h-14 text-destructive" />}
                title={t("portal.identity.result.submitError.title")}
                body={errorMsg || t("portal.identity.result.submitError.body")}
                ctaLabel={t("portal.identity.cta.retry")}
                onCta={reset}
              />
            )}
            {step === "awaiting_decision" && (
              <ResultStep
                tone="info"
                icon={<Loader2 className="w-14 h-14 text-primary animate-spin" />}
                title={t("portal.identity.result.pending.title")}
                body={t("portal.identity.result.pending.body")}
                ctaLabel={t("portal.identity.cta.close")}
                onCta={() => onOpenChange(false)}
              />
            )}
            {step === "approved" && (
              <ResultStep
                tone="success"
                icon={<CheckCircle2 className="w-14 h-14 text-success" />}
                title={t("portal.identity.result.approved.title")}
                body={t("portal.identity.result.approved.body")}
                ctaLabel={t("portal.identity.cta.continue")}
                onCta={() => {
                  onOpenChange(false);
                  onApproved?.();
                }}
              />
            )}
            {step === "rejected" && (
              <ResultStep
                tone="destructive"
                icon={<X className="w-14 h-14 text-destructive" />}
                title={t("portal.identity.result.rejected.title")}
                body={status.decision_reason_code
                  ? t(`portal.identity.reason.${status.decision_reason_code}`)
                  : t("portal.identity.result.rejected.body")}
                ctaLabel={t("portal.identity.cta.retry")}
                onCta={reset}
              />
            )}
            {step === "reupload_required" && (
              <ResultStep
                tone="warning"
                icon={<RotateCcw className="w-14 h-14 text-warning" />}
                title={t("portal.identity.result.reupload.title")}
                body={status.decision_reason_code
                  ? t(`portal.identity.reason.${status.decision_reason_code}`)
                  : t("portal.identity.result.reupload.body")}
                ctaLabel={t("portal.identity.cta.retry")}
                onCta={reset}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stepper
// ─────────────────────────────────────────────────────────────────────

function Stepper({ currentIndex }: { currentIndex: number }) {
  const { t } = useLanguage();
  const steps = useMemo(
    () => [
      { key: "doc", label: t("portal.identity.stepper.document"), Icon: FileText },
      { key: "selfie", label: t("portal.identity.stepper.selfie"), Icon: Camera },
      { key: "video", label: t("portal.identity.stepper.video"), Icon: Video },
    ],
    [t],
  );

  return (
    <div className="flex items-center w-full max-w-3xl mx-auto px-1">
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const Icon = s.Icon;
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                  done && "bg-success border-success text-success-foreground shadow-md",
                  active && "bg-gradient-to-br from-primary to-primary-glow border-primary text-primary-foreground scale-110 shadow-lg shadow-primary/30",
                  !done && !active && "bg-muted border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="w-5 h-5" /> : <Icon className="w-4.5 h-4.5" />}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap transition-colors",
                  active && "text-primary",
                  done && "text-success",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-5 bg-border rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full bg-gradient-to-r from-primary to-success transition-all duration-500 ease-out",
                    i < currentIndex ? "w-full" : "w-0",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Document selection
// ─────────────────────────────────────────────────────────────────────

function DocSelectStep({
  docKind,
  onKindChange,
  onFileChosen,
}: {
  docKind: IdentityDocKind;
  onKindChange: (k: IdentityDocKind) => void;
  onFileChosen: (file: File) => void;
}) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const kinds: { key: IdentityDocKind; Icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "passport", Icon: FileBadge },
    { key: "national_id", Icon: ShieldCheck },
    { key: "driver_license", Icon: Camera },
  ];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileChosen(f);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
      {/* Left: doc kind + instructions */}
      <div className="lg:col-span-2 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1.5">
            {t("portal.identity.doc.chooseTitle")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("portal.identity.doc.instruction")}
          </p>
        </div>

        <div className="space-y-2">
          {kinds.map(({ key, Icon }) => {
            const active = docKind === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onKindChange(key)}
                className={cn(
                  "group w-full flex items-center gap-3 rounded-xl border-2 p-3.5 text-start transition-all duration-200",
                  active
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border hover:border-primary/40 hover:bg-muted/40",
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors shrink-0",
                    active
                      ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-foreground flex-1">
                  {t(`portal.identity.docKind.${key}`)}
                </span>
                {active && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: drop zone */}
      <div className="lg:col-span-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileChosen(f);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "w-full min-h-[280px] lg:min-h-[420px] flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed transition-all duration-300 p-8 text-center",
            dragOver
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40",
          )}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
            <Upload className="w-10 h-10" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-foreground">
              {t("portal.identity.doc.dropTitle")}
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t("portal.identity.doc.dropHint")}
            </p>
          </div>
          <Button size="lg" type="button" className="mt-2 pointer-events-none">
            <Upload className="w-4 h-4 me-2" />
            {t("portal.identity.doc.upload")}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {t("portal.identity.doc.formats")}
          </p>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Selfie
// ─────────────────────────────────────────────────────────────────────

function SelfieStep({ onCaptured }: { onCaptured: (file: File) => void }) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setReady(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current) return;
    setBusy(true);
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) { setBusy(false); return; }
      const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
      onCaptured(file);
    }, "image/jpeg", 0.92);
  }, [onCaptured]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 items-start">
      {/* Camera (large) */}
      <div className="lg:col-span-3">
        {err ? (
          <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-8 text-center">
            <X className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="text-sm font-medium text-destructive">{t("portal.identity.errors.cameraDenied")}</p>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black shadow-xl ring-1 ring-border/60">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-[4/3] object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {/* Face guide overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[55%] aspect-[3/4] rounded-[50%] border-2 border-dashed border-primary-foreground/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions + action */}
      <div className="lg:col-span-2 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1.5 flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {t("portal.identity.selfie.title")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("portal.identity.selfie.instruction")}
          </p>
        </div>

        <ul className="space-y-2.5">
          {["lighting", "frame", "noAccessories"].map((tip) => (
            <li key={tip} className="flex items-start gap-2.5 text-sm text-foreground">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <span className="leading-relaxed">{t(`portal.identity.selfie.tip.${tip}`)}</span>
            </li>
          ))}
        </ul>

        <Button
          size="lg"
          className="w-full h-12 text-base"
          onClick={capture}
          disabled={!ready || busy || !!err}
        >
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Camera className="w-5 h-5 me-2" />
              {t("portal.identity.selfie.capture")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Video
// ─────────────────────────────────────────────────────────────────────

function getPreferredVideoRecordingMime() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
}

function VideoStep({ onCaptured, errorMessage }: { onCaptured: (file: File) => void; errorMessage?: string }) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setReady(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recorderRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const requestedMime = getPreferredVideoRecordingMime();
    const mr = requestedMime
      ? new MediaRecorder(streamRef.current, { mimeType: requestedMime })
      : new MediaRecorder(streamRef.current);
    recorderRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const actualMime = (mr.mimeType || requestedMime || "video/webm").split(";")[0] || "video/webm";
      const extension = actualMime.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type: actualMime });
      const file = new File([blob], `liveness.${extension}`, { type: actualMime });
      onCaptured(file);
    };
    mr.start();
    setRecording(true);
    setProcessing(false);
    setSecondsLeft(5);
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(tick);
          recorderRef.current?.stop();
          setRecording(false);
          setProcessing(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
        setRecording(false);
        setProcessing(true);
      }
    }, VIDEO_MAX_MS + 200);
  }, [onCaptured]);

  // Circular timer math
  const circumference = 2 * Math.PI * 28;
  const progress = recording ? ((5 - secondsLeft) / 5) * circumference : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 items-start">
      {/* Camera (large) */}
      <div className="lg:col-span-3">
        {err ? (
          <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-8 text-center">
            <X className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="text-sm font-medium text-destructive">{t("portal.identity.errors.cameraDenied")}</p>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black shadow-xl ring-1 ring-border/60">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-[4/3] object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {/* Face guide */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className={cn(
                  "w-[55%] aspect-[3/4] rounded-[50%] border-2 border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-colors",
                  recording ? "border-destructive animate-pulse" : "border-primary-foreground/70",
                )}
              />
            </div>

            {/* Recording badge */}
            {recording && (
              <div className="absolute top-4 start-4 flex items-center gap-2 rounded-full bg-destructive/90 backdrop-blur px-3 py-1.5 text-xs font-bold text-destructive-foreground shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive-foreground opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive-foreground" />
                </span>
                REC
              </div>
            )}

            {/* Circular timer */}
            {recording && (
              <div className="absolute bottom-4 end-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - progress}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-primary-foreground">
                    {secondsLeft}
                  </div>
                </div>
              </div>
            )}

            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions + action */}
      <div className="lg:col-span-2 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1.5 flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            {t("portal.identity.video.title")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("portal.identity.video.instruction")}
          </p>
        </div>

        <ul className="space-y-2.5">
          {["lookCamera", "turnHead", "smile"].map((tip) => (
            <li key={tip} className="flex items-start gap-2.5 text-sm text-foreground">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <span className="leading-relaxed">{t(`portal.identity.video.tip.${tip}`)}</span>
            </li>
          ))}
        </ul>

        {processing ? (
          <div className="w-full h-12 flex items-center justify-center gap-2 rounded-md bg-muted/50 text-sm font-medium text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t("portal.identity.submit.running")}
          </div>
        ) : (
          <Button
            size="lg"
            className="w-full h-12 text-base"
            variant={recording ? "destructive" : "default"}
            onClick={start}
            disabled={!ready || recording || !!err}
          >
            {recording ? (
              <>
                <Loader2 className="w-5 h-5 me-2 animate-spin" />
                {t("portal.identity.video.recording")} {secondsLeft}s
              </>
            ) : (
              <>
                <Video className="w-5 h-5 me-2" />
                {t("portal.identity.video.start")}
              </>
            )}
          </Button>
        )}

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive mb-1">
              {t("portal.identity.errors.uploadFailed")}
            </p>
            <p className="text-[11px] text-destructive/80 break-words font-mono leading-relaxed" dir="ltr">
              {errorMessage}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Running / Result
// ─────────────────────────────────────────────────────────────────────

function RunningStep({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
        <Loader2 className="relative w-14 h-14 text-primary animate-spin" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function ResultStep({
  tone,
  icon,
  title,
  body,
  ctaLabel,
  onCta,
}: {
  tone: "success" | "warning" | "destructive" | "info";
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  const ringTone = {
    success: "ring-success/20 bg-success/5",
    warning: "ring-warning/20 bg-warning/5",
    destructive: "ring-destructive/20 bg-destructive/5",
    info: "ring-primary/20 bg-primary/5",
  }[tone];
  return (
    <div className="flex flex-col items-center text-center gap-4 py-10 max-w-lg mx-auto">
      <div className={cn("flex items-center justify-center w-24 h-24 rounded-full ring-8 ring-offset-2 ring-offset-background", ringTone)}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      <Button size="lg" onClick={onCta} className="mt-3 min-w-[200px]">
        {ctaLabel}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────

function SummaryStep({
  fields,
  docKind,
  onConfirm,
  onRetry,
}: {
  fields: Record<string, ExtractedFieldRead>;
  docKind: IdentityDocKind;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  const { t, language } = useLanguage();
  const ORDER: string[] = [
    "full_name",
    "nationality",
    "date_of_birth",
    "document_number",
    "issuing_country",
    "expiry_date",
  ];
  const rows = ORDER
    .map((k) => ({ key: k, field: fields[k] }))
    .filter((r) => r.field && r.field.value && (r.field.status === "extracted" || r.field.status === "proposed"));

  const labelFor = (key: string) => {
    if (key === "document_number") {
      return t(`portal.identity.summary.field.document_number.${docKind}`);
    }
    return t(`portal.identity.summary.field.${key}`);
  };

  const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    full_name: User,
    nationality: Globe2,
    date_of_birth: Calendar,
    document_number: FileBadge,
    issuing_country: MapPin,
    expiry_date: CalendarX2,
  };

  const GRID_SPANS: Record<string, string> = {
    full_name: "sm:col-span-6",
    nationality: "sm:col-span-3",
    document_number: "sm:col-span-3",
    date_of_birth: "sm:col-span-2",
    issuing_country: "sm:col-span-2",
    expiry_date: "sm:col-span-2",
  };

  const formatValue = (key: string, raw: string) => {
    if (key === "date_of_birth" || key === "expiry_date") {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        try {
          return new Intl.DateTimeFormat(language || undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          }).format(d);
        } catch {
          /* fall through */
        }
      }
    }
    if (key === "issuing_country" || key === "nationality") {
      if (!/[A-Za-z]/.test(raw)) return raw.trim();
      return raw
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\s+/g, " ")
        .trim();
    }
    return raw.trim();
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Banner */}
      <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-success/10 via-success/5 to-transparent border border-success/30 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 shrink-0">
          <Sparkles className="w-4 h-4 text-success" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            {t("portal.identity.summary.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {t("portal.identity.summary.subtitle")}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-10">
          {t("portal.identity.summary.noFields")}
        </p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
          {rows.map(({ key, field }) => {
            const Icon = ICONS[key] ?? FileBadge;
            return (
              <div
                key={key}
                className={cn(
                  "rounded-2xl border border-border/60 bg-card p-3 transition-all hover:border-primary/40 hover:shadow-md",
                  "flex min-h-[88px] flex-col justify-between gap-2",
                  GRID_SPANS[key] ?? "sm:col-span-3",
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <dt className="text-xs font-medium leading-none text-muted-foreground">
                    {labelFor(key)}
                  </dt>
                </div>
                <dd
                  dir={key === "document_number" ? "ltr" : "auto"}
                  className={cn(
                    "break-words text-[13px] font-semibold leading-5 text-foreground",
                    key === "full_name" && "text-sm leading-6",
                  )}
                >
                  {formatValue(key, field!.value as string)}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      <p className="text-[11px] text-muted-foreground/80 text-center px-2 leading-relaxed">
        {t("portal.identity.summary.disclaimer")}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button variant="outline" size="lg" onClick={onRetry} className="flex-1 h-12">
          <RotateCcw className="w-4 h-4 me-2" />
          {t("portal.identity.summary.retake")}
        </Button>
        <Button size="lg" onClick={onConfirm} className="flex-1 h-12">
          <CheckCircle2 className="w-4 h-4 me-2" />
          {t("portal.identity.summary.confirm")}
        </Button>
      </div>
    </div>
  );
}
