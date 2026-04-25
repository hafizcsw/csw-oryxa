import { useCallback, useEffect, useRef, useState } from "react";

export type RealtimeStatus =
  | "idle"
  | "requesting_token"
  | "connecting"
  | "connected"
  | "ended"
  | "error";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  done: boolean;
}

interface StartOptions {
  language: string;
  videoEl?: HTMLVideoElement | null;
}

interface UseRealtimeSessionResult {
  status: RealtimeStatus;
  error: string | null;
  isAISpeaking: boolean;
  transcript: TranscriptEntry[];
  remoteAudioRef: React.RefObject<HTMLAudioElement>;
  start: (opts: StartOptions) => Promise<void>;
  stop: () => void;
}

const FRAME_INTERVAL_MS = 2500;
const FRAME_MAX_WIDTH = 512;

export function useRealtimeSession(): UseRealtimeSessionResult {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const frameTimerRef = useRef<number | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const cleanup = useCallback(() => {
    if (frameTimerRef.current) {
      window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    try {
      dcRef.current?.close();
    } catch {}
    dcRef.current = null;
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
    videoElRef.current = null;
    setIsAISpeaking(false);
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus("ended");
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  const handleServerEvent = useCallback((evt: any) => {
    const t = evt?.type as string | undefined;
    if (!t) return;

    switch (t) {
      case "response.audio.delta":
        setIsAISpeaking(true);
        break;
      case "response.audio.done":
      case "response.done":
        setIsAISpeaking(false);
        break;
      case "response.audio_transcript.delta": {
        const id = evt.response_id || evt.item_id || "assistant-current";
        const delta = evt.delta || "";
        setTranscript((prev) => {
          const idx = prev.findIndex((x) => x.id === id && !x.done);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = { ...next[idx], text: next[idx].text + delta };
            return next;
          }
          return [...prev, { id, role: "assistant", text: delta, done: false }];
        });
        break;
      }
      case "response.audio_transcript.done": {
        const id = evt.response_id || evt.item_id || "assistant-current";
        const finalText = evt.transcript || "";
        setTranscript((prev) => {
          const idx = prev.findIndex((x) => x.id === id && !x.done);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = { ...next[idx], text: finalText || next[idx].text, done: true };
            return next;
          }
          return [...prev, { id, role: "assistant", text: finalText, done: true }];
        });
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const id = evt.item_id || `user-${Date.now()}`;
        const finalText = evt.transcript || "";
        if (!finalText.trim()) break;
        setTranscript((prev) => [
          ...prev,
          { id, role: "user", text: finalText, done: true },
        ]);
        break;
      }
      case "error": {
        const msg = evt.error?.message || "Realtime error";
        console.error("[realtime] server error", evt);
        setError(msg);
        break;
      }
      default:
        break;
    }
  }, []);

  const sendFrame = useCallback(() => {
    const video = videoElRef.current;
    const dc = dcRef.current;
    if (!video || !dc || dc.readyState !== "open") return;
    if (video.readyState < 2 || !video.videoWidth) return;

    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;

    const scale = Math.min(1, FRAME_MAX_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);

    try {
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_image",
                image_url: dataUrl,
              },
            ],
          },
        }),
      );
    } catch (e) {
      console.warn("[realtime] frame send failed", e);
    }
  }, []);

  const start = useCallback(
    async ({ language, videoEl }: StartOptions) => {
      setError(null);
      setTranscript([]);
      cleanup();

      try {
        setStatus("requesting_token");
        const tokenRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/realtime-session-token`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ language }),
          },
        );

        if (!tokenRes.ok) {
          const errBody = await tokenRes.text();
          throw new Error(`Token request failed (${tokenRes.status}): ${errBody}`);
        }

        const { client_secret, model } = await tokenRes.json();
        const ephemeralKey = client_secret?.value;
        if (!ephemeralKey) throw new Error("Missing ephemeral key");

        setStatus("connecting");

        // Mic
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = micStream;

        // Camera (optional)
        if (videoEl) {
          try {
            const camStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
            });
            videoStreamRef.current = camStream;
            videoEl.srcObject = camStream;
            videoEl.muted = true;
            await videoEl.play().catch(() => {});
            videoElRef.current = videoEl;
          } catch (camErr) {
            console.warn("[realtime] camera unavailable, continuing audio-only", camErr);
          }
        }

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.ontrack = (evt) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = evt.streams[0];
            remoteAudioRef.current.play().catch(() => {});
          }
        };

        micStream.getAudioTracks().forEach((track) => pc.addTrack(track, micStream));

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.onopen = () => {
          setStatus("connected");
          if (videoStreamRef.current && videoElRef.current) {
            frameTimerRef.current = window.setInterval(sendFrame, FRAME_INTERVAL_MS);
            // initial frame sooner
            window.setTimeout(sendFrame, 600);
          }
        };
        dc.onmessage = (e) => {
          try {
            handleServerEvent(JSON.parse(e.data));
          } catch (parseErr) {
            console.warn("[realtime] non-JSON event", parseErr);
          }
        };
        dc.onerror = (e) => {
          console.error("[realtime] datachannel error", e);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpRes = await fetch(
          `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ephemeralKey}`,
              "Content-Type": "application/sdp",
            },
            body: offer.sdp,
          },
        );

        if (!sdpRes.ok) {
          const errText = await sdpRes.text();
          throw new Error(`SDP exchange failed (${sdpRes.status}): ${errText.slice(0, 300)}`);
        }

        const answerSdp = await sdpRes.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (e) {
        console.error("[realtime] start failed", e);
        setError(e instanceof Error ? e.message : "Failed to start session");
        setStatus("error");
        cleanup();
      }
    },
    [cleanup, handleServerEvent, sendFrame],
  );

  return {
    status,
    error,
    isAISpeaking,
    transcript,
    remoteAudioRef,
    start,
    stop,
  };
}
