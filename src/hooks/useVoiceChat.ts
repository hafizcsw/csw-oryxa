import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceChatStatus =
  | "idle"
  | "requesting_token"
  | "connecting"
  | "connected"
  | "ended"
  | "error";

export interface VoiceChatCallbacks {
  /** Final user transcript (after Whisper finishes a turn). */
  onUserTranscript?: (text: string) => void;
  /** Final assistant transcript (after the assistant finishes speaking). */
  onAssistantTranscript?: (text: string) => void;
  /** Streaming partial assistant transcript (for live caption). */
  onAssistantPartial?: (text: string) => void;
}

interface StartOptions extends VoiceChatCallbacks {
  language: string;
}

interface UseVoiceChatResult {
  status: VoiceChatStatus;
  error: string | null;
  isAISpeaking: boolean;
  /** Live partial assistant text, cleared between turns. */
  livePartial: string;
  remoteAudioRef: React.RefObject<HTMLAudioElement>;
  start: (opts: StartOptions) => Promise<void>;
  stop: () => void;
}

/**
 * Audio-only Realtime voice chat with OpenAI — ChatGPT Voice Mode style.
 * No video, no tools, no assessment phases. Transcripts are surfaced via callbacks
 * so the host chat UI can persist them as regular messages.
 */
export function useVoiceChat(): UseVoiceChatResult {
  const [status, setStatus] = useState<VoiceChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [livePartial, setLivePartial] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callbacksRef = useRef<VoiceChatCallbacks>({});
  const partialBufRef = useRef<Record<string, string>>({});

  const cleanup = useCallback(() => {
    try { dcRef.current?.close(); } catch {}
    dcRef.current = null;
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    partialBufRef.current = {};
    setIsAISpeaking(false);
    setLivePartial("");
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
      // Speech detection — instant interruption support (like ChatGPT Voice).
      case "input_audio_buffer.speech_started":
        // User started talking → cut off any AI audio immediately.
        setIsAISpeaking(false);
        setLivePartial("");
        partialBufRef.current = {};
        break;
      case "input_audio_buffer.speech_stopped":
        break;

      case "response.audio.delta":
        setIsAISpeaking(true);
        break;
      case "response.audio.done":
      case "response.done":
      case "response.cancelled":
        setIsAISpeaking(false);
        break;

      case "response.audio_transcript.delta": {
        const id = evt.response_id || evt.item_id || "current";
        const delta = evt.delta || "";
        const next = (partialBufRef.current[id] || "") + delta;
        partialBufRef.current[id] = next;
        setLivePartial(next);
        callbacksRef.current.onAssistantPartial?.(next);
        break;
      }
      case "response.audio_transcript.done": {
        const id = evt.response_id || evt.item_id || "current";
        const finalText = (evt.transcript || partialBufRef.current[id] || "").trim();
        delete partialBufRef.current[id];
        setLivePartial("");
        if (finalText) callbacksRef.current.onAssistantTranscript?.(finalText);
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const finalText = (evt.transcript || "").trim();
        if (finalText) callbacksRef.current.onUserTranscript?.(finalText);
        break;
      }
      case "conversation.item.input_audio_transcription.failed": {
        console.warn("[voice-chat] user transcription failed", evt.error);
        break;
      }

      case "error": {
        const msg = evt.error?.message || "Realtime error";
        console.error("[voice-chat] server error", evt);
        setError(msg);
        break;
      }
      default:
        break;
    }
  }, []);

  const start = useCallback(
    async ({ language, onUserTranscript, onAssistantTranscript, onAssistantPartial }: StartOptions) => {
      setError(null);
      setLivePartial("");
      cleanup();

      callbacksRef.current = { onUserTranscript, onAssistantTranscript, onAssistantPartial };

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
            body: JSON.stringify({ language, mode: "voice_chat" }),
          },
        );

        if (!tokenRes.ok) {
          const errBody = await tokenRes.text();
          throw new Error(`Token request failed (${tokenRes.status}): ${errBody.slice(0, 200)}`);
        }

        const { client_secret, model } = await tokenRes.json();
        const ephemeralKey = client_secret?.value;
        if (!ephemeralKey) throw new Error("Missing ephemeral key");

        setStatus("connecting");

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = micStream;

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
          // Nudge the model to greet first.
          try {
            dc.send(
              JSON.stringify({
                type: "response.create",
                response: { modalities: ["audio", "text"] },
              }),
            );
          } catch {}
        };
        dc.onmessage = (e) => {
          try {
            handleServerEvent(JSON.parse(e.data));
          } catch (parseErr) {
            console.warn("[voice-chat] non-JSON event", parseErr);
          }
        };
        dc.onerror = (e) => {
          console.error("[voice-chat] datachannel error", e);
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
          throw new Error(`SDP exchange failed (${sdpRes.status}): ${errText.slice(0, 200)}`);
        }

        const answerSdp = await sdpRes.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (e) {
        console.error("[voice-chat] start failed", e);
        setError(e instanceof Error ? e.message : "Failed to start voice chat");
        setStatus("error");
        cleanup();
      }
    },
    [cleanup, handleServerEvent],
  );

  return {
    status,
    error,
    isAISpeaking,
    livePartial,
    remoteAudioRef,
    start,
    stop,
  };
}
