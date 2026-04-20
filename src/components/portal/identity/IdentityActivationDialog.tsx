import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle, Camera, Video, Upload, RotateCcw, CheckCircle2, X, User, Globe2, Calendar, FileBadge, MapPin, CalendarX2 } from "lucide-react";
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
const VIDEO_MAX_BYTES = 15 * 1024 * 1024;

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
  const [docPath, setDocPath] = useState<string>("");
  const [readerVerdict, setReaderVerdict] = useState<ReaderVerdict | null>(null);
  const [readerPayload, setReaderPayload] = useState<Record<string, unknown>>({});
  const [extractedFields, setExtractedFields] = useState<Record<string, ExtractedFieldRead>>({});
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePath, setSelfiePath] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPath, setVideoPath] = useState<string>("");
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
    setDocPath("");
    setReaderVerdict(null);
    setReaderPayload({});
    setExtractedFields({});
    setSelfieFile(null);
    setSelfiePath("");
    setVideoFile(null);
    setVideoPath("");
    setErrorMsg("");
  }, []);

  // ✅ CANONICAL ORDER: upload doc → run reader → decide verdict → only then open camera.
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
      setDocPath(up.path);
      // Run the existing mistral-document-pipeline NOW, before camera.
      const r = await runIdentityReader({ doc_kind: docKind, doc_storage_path: up.path });
      if (!r.ok || !r.data) {
        setErrorMsg(r.error || "reader_failed");
        setStep("submit_error");
        return;
      }
      setReaderVerdict(r.data.reader_verdict);
      setReaderPayload(r.data.reader_payload || {});
      setExtractedFields(r.data.extracted_fields || {});
      if (r.data.reader_verdict === "weak") return setStep("blocked_weak");
      if (r.data.reader_verdict === "unsupported") return setStep("blocked_unsupported");
      // accepted_preliminarily → show summary BEFORE camera
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
    setSelfiePath(up.path);
    setStep("video_capture");
  }, [toast, t]);

  const handleVideoCaptured = useCallback(async (file: File) => {
    if (file.size > VIDEO_MAX_BYTES) {
      toast({ title: t("portal.identity.errors.videoTooLarge"), variant: "destructive" });
      return;
    }
    setVideoFile(file);
    const up = await uploadIdentityFile("video", file);
    if (!up.ok) {
      toast({ title: t("portal.identity.errors.uploadFailed"), variant: "destructive" });
      return;
    }
    setVideoPath(up.path);
    setStep("submitting");
    if (!readerVerdict || readerVerdict !== "accepted_preliminarily") {
      // Defensive — should never happen because camera only opens after verdict.
      setErrorMsg("reader_not_passed");
      setStep("submit_error");
      return;
    }
    const res = await submitIdentityActivation({
      doc_kind: docKind,
      doc_storage_path: docPath,
      selfie_storage_path: selfiePath,
      video_storage_path: up.path,
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
  }, [docKind, docPath, selfiePath, readerVerdict, readerPayload, toast, t, refetch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {t("portal.identity.title")}
          </DialogTitle>
          <DialogDescription>{t("portal.identity.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
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
              icon={<AlertTriangle className="w-12 h-12 text-warning" />}
              title={t("portal.identity.result.weak.title")}
              body={t("portal.identity.result.weak.body")}
              ctaLabel={t("portal.identity.cta.retry")}
              onCta={reset}
            />
          )}
          {step === "blocked_unsupported" && (
            <ResultStep
              tone="destructive"
              icon={<X className="w-12 h-12 text-destructive" />}
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
            <VideoStep onCaptured={handleVideoCaptured} />
          )}
          {step === "submitting" && <RunningStep label={t("portal.identity.submit.running")} />}
          {step === "submit_error" && (
            <ResultStep
              tone="destructive"
              icon={<X className="w-12 h-12 text-destructive" />}
              title={t("portal.identity.result.submitError.title")}
              body={errorMsg || t("portal.identity.result.submitError.body")}
              ctaLabel={t("portal.identity.cta.retry")}
              onCta={reset}
            />
          )}
          {step === "awaiting_decision" && (
            <ResultStep
              tone="info"
              icon={<Loader2 className="w-12 h-12 text-primary animate-spin" />}
              title={t("portal.identity.result.pending.title")}
              body={t("portal.identity.result.pending.body")}
              ctaLabel={t("portal.identity.cta.close")}
              onCta={() => onOpenChange(false)}
            />
          )}
          {step === "approved" && (
            <ResultStep
              tone="success"
              icon={<CheckCircle2 className="w-12 h-12 text-success" />}
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
              icon={<X className="w-12 h-12 text-destructive" />}
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
              icon={<RotateCcw className="w-12 h-12 text-warning" />}
              title={t("portal.identity.result.reupload.title")}
              body={status.decision_reason_code
                ? t(`portal.identity.reason.${status.decision_reason_code}`)
                : t("portal.identity.result.reupload.body")}
              ctaLabel={t("portal.identity.cta.retry")}
              onCta={reset}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const kinds: { key: IdentityDocKind; Icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "passport", Icon: FileBadge },
    { key: "national_id", Icon: ShieldCheck },
    { key: "driver_license", Icon: Camera },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t("portal.identity.doc.instruction")}
      </p>

      <div className="grid grid-cols-3 gap-2.5">
        {kinds.map(({ key, Icon }) => {
          const active = docKind === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onKindChange(key)}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-2 rounded-xl border p-3.5 text-center transition-all",
                "min-h-[92px]",
                active
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                )}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span className="text-[13px] font-medium leading-tight text-foreground">
                {t(`portal.identity.docKind.${key}`)}
              </span>
              {active && (
                <span className="absolute top-1.5 end-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle2 className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

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
      <Button size="lg" className="w-full h-11" onClick={() => inputRef.current?.click()}>
        <Upload className="w-4 h-4 me-2" />
        {t("portal.identity.doc.upload")}
      </Button>
    </div>
  );
}

function SelfieStep({ onCaptured }: { onCaptured: (file: File) => void }) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
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
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
      onCaptured(file);
    }, "image/jpeg", 0.92);
  }, [onCaptured]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("portal.identity.selfie.instruction")}</p>
      {err ? (
        <p className="text-sm text-destructive">{t("portal.identity.errors.cameraDenied")}</p>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-video rounded-lg bg-muted"
          />
          <Button className="w-full" onClick={capture} disabled={!ready}>
            <Camera className="w-4 h-4 me-2" />
            {t("portal.identity.selfie.capture")}
          </Button>
        </>
      )}
    </div>
  );
}

function VideoStep({ onCaptured }: { onCaptured: (file: File) => void }) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
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
    const mime = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const mr = new MediaRecorder(streamRef.current, { mimeType: mime });
    recorderRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `liveness.${ext}`, { type: mime });
      onCaptured(file);
    };
    mr.start();
    setRecording(true);
    setSecondsLeft(5);
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(tick);
          recorderRef.current?.stop();
          setRecording(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
        setRecording(false);
      }
    }, VIDEO_MAX_MS + 200);
  }, [onCaptured]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("portal.identity.video.instruction")}</p>
      {err ? (
        <p className="text-sm text-destructive">{t("portal.identity.errors.cameraDenied")}</p>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-video rounded-lg bg-muted"
          />
          <Button className="w-full" onClick={start} disabled={!ready || recording}>
            <Video className="w-4 h-4 me-2" />
            {recording
              ? `${t("portal.identity.video.recording")} ${secondsLeft}s`
              : t("portal.identity.video.start")}
          </Button>
        </>
      )}
    </div>
  );
}

function RunningStep({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground">{label}</p>
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
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4">
      {icon}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{body}</p>
      <Button onClick={onCta} className="mt-2">
        {ctaLabel}
      </Button>
    </div>
  );
}

// Summary step: shows ONLY truly extracted fields. Never invents missing fields.
// Never shows residence/location. Student must confirm before camera opens.
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
  const { t } = useLanguage();
  // Whitelist of generic identity fields, in display order. The reader's
  // `passport_number` fact is exposed as the generic key `document_number`
  // so the label is honest for passport / national_id / driver_license.
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

  // Doc-kind-aware label for the document number row.
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

  // Pretty-format ISO/short dates into a locale-friendly string.
  const formatValue = (key: string, raw: string) => {
    if (key === "date_of_birth" || key === "expiry_date") {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        try {
          return new Intl.DateTimeFormat(undefined, {
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
      // Title-case ALL-CAPS country names like "THE REPUBLIC OF THE SUDAN".
      return raw
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\s+/g, " ")
        .trim();
    }
    return raw;
  };

  return (
    <div className="space-y-5">
      {/* Header banner */}
      <div className="flex items-start gap-3 rounded-xl bg-gradient-to-br from-success/10 via-success/5 to-transparent border border-success/30 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 shrink-0">
          <CheckCircle2 className="w-5 h-5 text-success" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground leading-tight">
            {t("portal.identity.summary.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {t("portal.identity.summary.subtitle")}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-6">
          {t("portal.identity.summary.noFields")}
        </p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {rows.map(({ key, field }) => {
            const Icon = ICONS[key] ?? FileBadge;
            const isFullWidth = key === "full_name";
            return (
              <div
                key={key}
                className={cn(
                  "group relative rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-sm transition-all p-3.5",
                  isFullWidth && "sm:col-span-2",
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {labelFor(key)}
                  </dt>
                </div>
                <dd className="text-sm font-semibold text-foreground break-words leading-snug ps-8">
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

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onRetry} className="flex-1">
          <RotateCcw className="w-4 h-4 me-2" />
          {t("portal.identity.summary.retake")}
        </Button>
        <Button onClick={onConfirm} className="flex-1">
          <CheckCircle2 className="w-4 h-4 me-2" />
          {t("portal.identity.summary.confirm")}
        </Button>
      </div>
    </div>
  );
}
