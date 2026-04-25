import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Loader2, Radio, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRealtimeSession } from "@/hooks/useRealtimeSession";
import { cn } from "@/lib/utils";

interface LiveSessionPanelProps {
  onBack?: () => void;
}

export function LiveSessionPanel({ onBack }: LiveSessionPanelProps) {
  const { t, language } = useLanguage();
  const { status, error, isAISpeaking, transcript, remoteAudioRef, start, stop } =
    useRealtimeSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enableCamera, setEnableCamera] = useState(true);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const isActive = status === "connected" || status === "connecting" || status === "requesting_token";

  const handleStart = async () => {
    await start({
      language,
      videoEl: enableCamera ? videoRef.current : null,
    });
  };

  const handleStop = () => {
    stop();
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {onBack && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-card/40">
          <button
            type="button"
            onClick={onBack}
            disabled={isActive}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {t("portal.support.panel.back", { defaultValue: "Back" })}
          </button>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Radio className={cn("h-3 w-3", status === "connected" ? "text-emerald-500 animate-pulse" : "")} />
            <span>
              {status === "connected" && t("portal.chat.live.connected", { defaultValue: "Live" })}
              {status === "connecting" && t("portal.chat.live.connecting", { defaultValue: "Connecting…" })}
              {status === "requesting_token" && t("portal.chat.live.connecting", { defaultValue: "Connecting…" })}
              {status === "idle" && t("portal.chat.live.idle", { defaultValue: "Idle" })}
              {status === "ended" && t("portal.chat.live.ended", { defaultValue: "Ended" })}
              {status === "error" && t("portal.chat.live.errorLabel", { defaultValue: "Error" })}
            </span>
          </div>
        </div>
      )}

      {/* Video + AI indicator */}
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
                isAISpeaking ? "bg-primary animate-pulse" : "bg-muted-foreground/50",
              )}
            />
            <span className="text-[10px] text-foreground">
              {isAISpeaking
                ? t("portal.chat.live.speaking", { defaultValue: "Oryxa is speaking" })
                : t("portal.chat.live.listening", { defaultValue: "Listening…" })}
            </span>
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 [scrollbar-width:thin]">
        {transcript.length === 0 && status !== "connected" && (
          <div className="text-center py-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("portal.chat.live.title", { defaultValue: "Live assessment session" })}
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              {t("portal.chat.live.intro", {
                defaultValue:
                  "Oryxa will speak with you over voice and see you on camera to run a short, friendly assessment.",
              })}
            </p>
            <p className="text-[11px] text-muted-foreground/80 max-w-xs mx-auto bg-muted/40 rounded-md px-3 py-2 border border-border/40">
              {t("portal.chat.live.disclaimer", {
                defaultValue:
                  "Experimental preview. Audio and video are streamed for the session only and not stored.",
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
                ? "bg-muted/60 text-foreground self-start"
                : "bg-primary/10 text-foreground self-end ml-auto",
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
            <Button onClick={handleStop} size="lg" variant="destructive" className="rounded-full px-6">
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

      {/* Hidden audio sink for AI voice */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
    </div>
  );
}
