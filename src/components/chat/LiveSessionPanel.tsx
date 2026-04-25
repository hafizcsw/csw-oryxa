import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Loader2, Radio, AlertTriangle, FileText, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRealtimeSession, type SessionPhase, type StudentContext } from "@/hooks/useRealtimeSession";
import { cn } from "@/lib/utils";

interface LiveSessionPanelProps {
  onBack?: () => void;
  studentContext?: StudentContext;
}

const PHASE_ORDER: SessionPhase[] = [
  "greeting",
  "background",
  "language",
  "quantitative",
  "logical",
  "wrap_up",
  "complete",
];

function phaseLabel(t: (k: string, o?: any) => string, p: SessionPhase): string {
  const map: Record<SessionPhase, [string, string]> = {
    greeting:     ["portal.chat.live.phase.greeting",     "Greeting"],
    background:   ["portal.chat.live.phase.background",   "Background"],
    language:     ["portal.chat.live.phase.language",     "Language"],
    quantitative: ["portal.chat.live.phase.quantitative", "Quantitative"],
    logical:      ["portal.chat.live.phase.logical",      "Logical"],
    wrap_up:      ["portal.chat.live.phase.wrap_up",      "Summary"],
    complete:     ["portal.chat.live.phase.complete",     "Complete"],
  };
  const [k, d] = map[p];
  return t(k, { defaultValue: d });
}

export function LiveSessionPanel({ onBack, studentContext }: LiveSessionPanelProps) {
  const { t, language } = useLanguage();
  const { status, error, isAISpeaking, transcript, phase, assessment, remoteAudioRef, start, stop } =
    useRealtimeSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enableCamera, setEnableCamera] = useState(true);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const isActive = status === "connected" || status === "connecting" || status === "requesting_token";
  const phaseIdx = PHASE_ORDER.indexOf(phase);
  const showWorkTip = phase === "quantitative" && enableCamera && status === "connected";

  const handleStart = async () => {
    await start({
      language,
      videoEl: enableCamera ? videoRef.current : null,
      studentContext,
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-card/40">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={isActive}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {t("portal.support.panel.back", { defaultValue: "Back" })}
          </button>
        ) : <div />}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {language.toUpperCase()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Radio className={cn("h-3 w-3", status === "connected" ? "text-emerald-500 animate-pulse" : "")} />
            {status === "connected" && t("portal.chat.live.connected", { defaultValue: "Live" })}
            {(status === "connecting" || status === "requesting_token") &&
              t("portal.chat.live.connecting", { defaultValue: "Connecting…" })}
            {status === "idle" && t("portal.chat.live.idle", { defaultValue: "Idle" })}
            {status === "ended" && t("portal.chat.live.ended", { defaultValue: "Ended" })}
            {status === "error" && t("portal.chat.live.errorLabel", { defaultValue: "Error" })}
          </span>
        </div>
      </div>

      {/* Phase strip */}
      {(isActive || status === "ended") && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/40 bg-card/20 overflow-x-auto">
          {PHASE_ORDER.slice(0, 6).map((p, i) => {
            const reached = i <= phaseIdx;
            const current = i === phaseIdx;
            return (
              <div
                key={p}
                className={cn(
                  "flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                  current
                    ? "bg-primary text-primary-foreground border-primary"
                    : reached
                      ? "bg-muted text-foreground border-border/60"
                      : "bg-transparent text-muted-foreground border-border/30",
                )}
              >
                {phaseLabel(t, p)}
              </div>
            );
          })}
        </div>
      )}

      {/* Video */}
      <div className="relative bg-muted/40 aspect-video w-full overflow-hidden border-b border-border/40">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            "w-full h-full object-cover transition-opacity",
            enableCamera && isActive ? "opacity-100" : "opacity-0",
          )}
        />
        {(!enableCamera || !isActive) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <VideoOff className="h-8 w-8" />
            <p className="text-xs">
              {!isActive
                ? t("portal.chat.live.cameraOffIdle", {
                    defaultValue: "Camera will turn on when session starts",
                  })
                : t("portal.chat.live.cameraDisabled", { defaultValue: "Camera disabled" })}
            </p>
          </div>
        )}
        {status === "connected" && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm border border-border/40">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isAISpeaking ? "bg-primary animate-pulse" : "bg-emerald-500",
              )}
            />
            <span className="text-[10px] text-foreground">
              {isAISpeaking
                ? t("portal.chat.live.speaking", { defaultValue: "Oryxa is speaking" })
                : t("portal.chat.live.listening", { defaultValue: "Listening…" })}
            </span>
          </div>
        )}
        {showWorkTip && (
          <div className="absolute bottom-2 left-2 right-2 flex items-start gap-2 px-3 py-2 rounded-md bg-primary/90 text-primary-foreground text-[11px] backdrop-blur-sm">
            <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              {t("portal.chat.live.showWorkTip", {
                defaultValue:
                  "Tip: solve on paper and hold it up to the camera so Oryxa can see your work.",
              })}
            </span>
          </div>
        )}
      </div>

      {/* Transcript / intro / summary */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 [scrollbar-width:thin]">
        {transcript.length === 0 && status !== "connected" && !assessment && (
          <div className="text-center py-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("portal.chat.live.title", { defaultValue: "CSW World live preliminary assessment" })}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {t("portal.chat.live.intro", {
                defaultValue:
                  "Oryxa will run a short, structured chat in your language: background, language, quantitative reasoning (with paper held to camera) and a logical question. Ends with a preliminary impression and a recommended next step on CSW World.",
              })}
            </p>
            <p className="text-[11px] text-muted-foreground/80 max-w-sm mx-auto bg-muted/40 rounded-md px-3 py-2 border border-border/40">
              {t("portal.chat.live.disclaimer", {
                defaultValue:
                  "Experimental preview. Audio and video are streamed for the session only and not stored. This is not a formal evaluation.",
              })}
            </p>
          </div>
        )}

        {transcript.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "text-sm leading-relaxed rounded-lg px-3 py-2 max-w-[90%]",
              entry.role === "assistant"
                ? "bg-muted/60 text-foreground"
                : "bg-primary/10 text-foreground ml-auto",
            )}
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              {entry.role === "assistant"
                ? t("portal.chat.live.oryxa", { defaultValue: "Oryxa" })
                : t("portal.chat.live.you", { defaultValue: "You" })}
            </div>
            {entry.text}
          </div>
        ))}

        {assessment && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">
                {t("portal.chat.live.summary.title", { defaultValue: "Preliminary impression" })}
              </h4>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("portal.chat.live.summary.confidence", { defaultValue: "Confidence" })}: {assessment.confidence || "—"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <SummaryStat
                label={t("portal.chat.live.summary.language", { defaultValue: "Language" })}
                value={assessment.language_level_estimate}
              />
              <SummaryStat
                label={t("portal.chat.live.summary.quant", { defaultValue: "Quant" })}
                value={assessment.quantitative_level}
              />
              <SummaryStat
                label={t("portal.chat.live.summary.logic", { defaultValue: "Logic" })}
                value={assessment.logical_level}
              />
            </div>
            {assessment.recommended_next_step && (
              <div className="text-[12px] text-foreground bg-background/60 rounded px-2 py-1.5 border border-border/40">
                <span className="font-medium">
                  {t("portal.chat.live.summary.next", { defaultValue: "Next step" })}:
                </span>{" "}
                {assessment.recommended_next_step}
              </div>
            )}
            {assessment.session_notes_short && (
              <p className="text-[11px] text-muted-foreground italic">{assessment.session_notes_short}</p>
            )}
            <p className="text-[10px] text-muted-foreground/80">
              {t("portal.chat.live.summary.notSaved", {
                defaultValue: "This impression is shown once and is not saved.",
              })}
            </p>
          </div>
        )}

        <div ref={transcriptEndRef} />

        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 border border-destructive/30">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-border/40 bg-card/40 px-4 py-3 space-y-2">
        {!isActive && (
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setEnableCamera((v) => !v)}
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              {enableCamera ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
              {enableCamera
                ? t("portal.chat.live.cameraOn", { defaultValue: "Camera on" })
                : t("portal.chat.live.cameraOff", { defaultValue: "Camera off" })}
            </button>
            <span className="inline-flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5" />
              {t("portal.chat.live.micRequired", { defaultValue: "Mic required" })}
            </span>
          </div>
        )}
        <div className="flex justify-center">
          {!isActive ? (
            <Button onClick={handleStart} size="lg" className="rounded-full px-6">
              <Mic className="h-4 w-4 mr-2" />
              {t("portal.chat.live.start", { defaultValue: "Start live session" })}
            </Button>
          ) : status === "connected" ? (
            <Button onClick={stop} size="lg" variant="destructive" className="rounded-full px-6">
              <MicOff className="h-4 w-4 mr-2" />
              {t("portal.chat.live.end", { defaultValue: "End session" })}
            </Button>
          ) : (
            <Button disabled size="lg" className="rounded-full px-6">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("portal.chat.live.connecting", { defaultValue: "Connecting…" })}
            </Button>
          )}
        </div>
      </div>

      <audio ref={remoteAudioRef} autoPlay className="hidden" />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md bg-background/60 border border-border/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[13px] font-semibold text-foreground">{value || "—"}</div>
    </div>
  );
}
