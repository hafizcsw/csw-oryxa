import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle, Camera, Video, Upload, RotateCcw, CheckCircle2, X } from "lucide-react";
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
  const kinds: IdentityDocKind[] = ["passport", "national_id", "driver_license"];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("portal.identity.doc.instruction")}</p>
      <div className="grid grid-cols-3 gap-2">
        {kinds.map((k) => (
          <Card
            key={k}
            onClick={() => onKindChange(k)}
            className={cn(
              "p-3 text-center cursor-pointer text-sm font-medium transition-all",
              docKind === k
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border hover:border-primary/40",
            )}
          >
            {t(`portal.identity.docKind.${k}`)}
          </Card>
        ))}
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
      <Button className="w-full" onClick={() => inputRef.current?.click()}>
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
