/**
 * CommCallContext — Global P2P WebRTC voice/video/screen-share for the
 * canonical communication backbone (comm_threads).
 *
 * Architecture (no third-party SDK):
 *   - Signaling: Supabase Realtime on `comm_call_signals` (offer/answer/ice/screen).
 *   - Persistence: `comm_calls` row per call (status + duration + recording url).
 *   - Recording: MediaRecorder on a mixed MediaStream → uploaded to `call-recordings`.
 *
 * Public API (via useCommCall):
 *   startCall({ threadId, calleeId, withVideo })
 *   acceptCall() / declineCall() / endCall()
 *   toggleMute() / toggleCamera() / toggleScreenShare() / toggleRecording()
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

export type CallType = 'audio' | 'video';
export type CallStatus =
  | 'idle'
  | 'ringing-out'  // I'm calling, waiting for callee
  | 'ringing-in'   // Incoming call for me
  | 'connecting'
  | 'connected'
  | 'ended';

export interface ActiveCall {
  id: string;
  threadId: string;
  callerId: string;
  calleeId: string;
  callType: CallType;
  isOutgoing: boolean;
  remoteUserId: string;
  remoteName?: string;
  remoteAvatar?: string;
}

interface CommCallCtx {
  call: ActiveCall | null;
  status: CallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  durationSec: number;
  startCall: (args: {
    threadId: string;
    calleeId: string;
    callType: CallType;
    remoteName?: string;
    remoteAvatar?: string;
  }) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: (reason?: string) => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleRecording: () => Promise<void>;
}

const Ctx = createContext<CommCallCtx | null>(null);

export function CommCallProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const signalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const incomingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingRemoteIceRef = useRef<RTCIceCandidateInit[]>([]);
  const callRef = useRef<ActiveCall | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const answeredAtRef = useRef<number | null>(null);

  // Track current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Listen for incoming calls (where I'm the callee)
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`incoming-calls:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comm_calls',
          filter: `callee_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          if (callRef.current) return; // already in a call
          // Fetch caller name
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_storage_path, email')
            .eq('user_id', row.caller_id)
            .maybeSingle();
          const remoteName = profile?.full_name || profile?.email || undefined;
          const remoteAvatar = profile?.avatar_storage_path
            ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_storage_path).data.publicUrl
            : undefined;
          const incoming: ActiveCall = {
            id: row.id,
            threadId: row.thread_id,
            callerId: row.caller_id,
            calleeId: row.callee_id,
            callType: row.call_type,
            isOutgoing: false,
            remoteUserId: row.caller_id,
            remoteName,
            remoteAvatar,
          };
          callRef.current = incoming;
          setCall(incoming);
          setStatus('ringing-in');
        },
      )
      .subscribe();
    incomingChannelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      incomingChannelRef.current = null;
    };
  }, [userId]);

  // Cleanup helpers
  const stopAllTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenTrackRef.current?.stop();
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    screenTrackRef.current = null;
    cameraTrackRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const closeChannel = useCallback(() => {
    if (signalChannelRef.current) {
      supabase.removeChannel(signalChannelRef.current);
      signalChannelRef.current = null;
    }
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const fullCleanup = useCallback(() => {
    stopDurationTimer();
    closeChannel();
    pcRef.current?.close();
    pcRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    recordedChunksRef.current = [];
    stopAllTracks();
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    setIsRecording(false);
    setDurationSec(0);
    answeredAtRef.current = null;
    pendingRemoteIceRef.current = [];
  }, [closeChannel, stopAllTracks, stopDurationTimer]);

  const sendSignal = useCallback(
    async (
      callId: string,
      toUser: string,
      type: 'offer' | 'answer' | 'ice' | 'renegotiate' | 'screen-start' | 'screen-stop',
      payload: any,
    ) => {
      const { error } = await supabase.from('comm_call_signals').insert({
        call_id: callId,
        from_user: userId!,
        to_user: toUser,
        signal_type: type,
        payload,
      });
      if (error) console.error('[CommCall] signal insert', error);
    },
    [userId],
  );

  const startDurationTimer = useCallback(() => {
    answeredAtRef.current = Date.now();
    durationTimerRef.current = window.setInterval(() => {
      if (answeredAtRef.current) {
        setDurationSec(Math.floor((Date.now() - answeredAtRef.current) / 1000));
      }
    }, 1000);
  }, []);

  // PeerConnection factory
  const createPeer = useCallback(
    (callId: string, remoteUserId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      const remote = new MediaStream();
      remoteStreamRef.current = remote;
      setRemoteStream(remote);

      pc.ontrack = (ev) => {
        ev.streams[0]?.getTracks().forEach((track) => {
          remote.addTrack(track);
        });
        setRemoteStream(new MediaStream(remote.getTracks()));
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendSignal(callId, remoteUserId, 'ice', ev.candidate.toJSON()).catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') {
          setStatus('connected');
          if (!answeredAtRef.current) startDurationTimer();
        } else if (st === 'failed' || st === 'disconnected') {
          // best-effort end
          endCallInternal('connection-lost').catch(() => {});
        }
      };

      pcRef.current = pc;
      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendSignal, startDurationTimer],
  );

  // Subscribe to signals for an active call
  const subscribeSignals = useCallback(
    (callId: string) => {
      const ch = supabase
        .channel(`call-signals:${callId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'comm_call_signals',
            filter: `call_id=eq.${callId}`,
          },
          async (payload) => {
            const row = payload.new as any;
            if (row.from_user === userId) return; // ignore my own
            const pc = pcRef.current;
            if (!pc) return;
            try {
              if (row.signal_type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
                // flush queued ICE
                for (const c of pendingRemoteIceRef.current) {
                  try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* */ }
                }
                pendingRemoteIceRef.current = [];
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await sendSignal(callId, row.from_user, 'answer', answer);
              } else if (row.signal_type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
                for (const c of pendingRemoteIceRef.current) {
                  try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* */ }
                }
                pendingRemoteIceRef.current = [];
              } else if (row.signal_type === 'ice') {
                if (pc.remoteDescription && pc.remoteDescription.type) {
                  try { await pc.addIceCandidate(new RTCIceCandidate(row.payload)); } catch { /* */ }
                } else {
                  pendingRemoteIceRef.current.push(row.payload);
                }
              } else if (row.signal_type === 'renegotiate') {
                // remote will send a new offer next
              }
            } catch (e) {
              console.error('[CommCall] signal handler', e);
            }
          },
        )
        // Also listen for status updates on the call row (decline / end by the other side)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'comm_calls',
            filter: `id=eq.${callId}`,
          },
          (payload) => {
            const row = payload.new as any;
            if (['ended', 'declined', 'cancelled', 'failed'].includes(row.status)) {
              if (callRef.current?.id === callId && status !== 'ended') {
                fullCleanup();
                setStatus('ended');
                setTimeout(() => {
                  setCall(null);
                  callRef.current = null;
                  setStatus('idle');
                }, 1500);
              }
            }
          },
        )
        .subscribe();
      signalChannelRef.current = ch;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, sendSignal, fullCleanup],
  );

  const getLocalMedia = useCallback(async (callType: CallType) => {
    const constraints: MediaStreamConstraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);
    cameraTrackRef.current = stream.getVideoTracks()[0] || null;
    return stream;
  }, []);

  // ---- start outgoing ----
  const startCall: CommCallCtx['startCall'] = useCallback(
    async ({ threadId, calleeId, callType, remoteName, remoteAvatar }) => {
      if (!userId || callRef.current) return;
      try {
        // 1. create db row
        const { data: row, error } = await supabase
          .from('comm_calls')
          .insert({
            thread_id: threadId,
            caller_id: userId,
            callee_id: calleeId,
            call_type: callType,
            status: 'ringing',
          })
          .select()
          .single();
        if (error || !row) throw error || new Error('insert failed');

        const active: ActiveCall = {
          id: row.id,
          threadId,
          callerId: userId,
          calleeId,
          callType,
          isOutgoing: true,
          remoteUserId: calleeId,
          remoteName,
          remoteAvatar,
        };
        callRef.current = active;
        setCall(active);
        setStatus('ringing-out');

        // 2. get media + create peer + subscribe
        const stream = await getLocalMedia(callType);
        subscribeSignals(row.id);
        const pc = createPeer(row.id, calleeId);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        // 3. create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal(row.id, calleeId, 'offer', offer);
        setStatus('connecting');
      } catch (e) {
        console.error('[CommCall] startCall', e);
        fullCleanup();
        setCall(null);
        callRef.current = null;
        setStatus('idle');
        throw e;
      }
    },
    [userId, getLocalMedia, subscribeSignals, createPeer, sendSignal, fullCleanup],
  );

  // ---- accept incoming ----
  const acceptCall: CommCallCtx['acceptCall'] = useCallback(async () => {
    const c = callRef.current;
    if (!c || c.isOutgoing) return;
    try {
      await supabase
        .from('comm_calls')
        .update({ status: 'accepted', answered_at: new Date().toISOString() })
        .eq('id', c.id);
      setStatus('connecting');
      const stream = await getLocalMedia(c.callType);
      subscribeSignals(c.id);
      const pc = createPeer(c.id, c.remoteUserId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      // Wait for offer to arrive via realtime; offer handler will create answer.
    } catch (e) {
      console.error('[CommCall] acceptCall', e);
      await endCallInternal('accept-failed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLocalMedia, subscribeSignals, createPeer]);

  const declineCall: CommCallCtx['declineCall'] = useCallback(async () => {
    const c = callRef.current;
    if (!c) return;
    await supabase
      .from('comm_calls')
      .update({ status: 'declined', ended_at: new Date().toISOString(), end_reason: 'declined' })
      .eq('id', c.id);
    fullCleanup();
    setCall(null);
    callRef.current = null;
    setStatus('idle');
  }, [fullCleanup]);

  // Internal end (used by handlers)
  const endCallInternal = useCallback(
    async (reason?: string) => {
      const c = callRef.current;
      if (!c) return;
      const duration = answeredAtRef.current
        ? Math.floor((Date.now() - answeredAtRef.current) / 1000)
        : null;
      try {
        await supabase
          .from('comm_calls')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            duration_seconds: duration,
            end_reason: reason ?? 'hangup',
          })
          .eq('id', c.id);
      } catch { /* */ }

      // stop recorder before cleanup so we can upload
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          await new Promise<void>((resolve) => {
            recorderRef.current!.onstop = () => resolve();
            recorderRef.current!.stop();
          });
          await uploadRecording(c.id);
        } catch (e) {
          console.error('[CommCall] recording stop/upload', e);
        }
      }

      fullCleanup();
      setStatus('ended');
      setTimeout(() => {
        setCall(null);
        callRef.current = null;
        setStatus('idle');
      }, 1500);
    },
    [fullCleanup],
  );

  const endCall: CommCallCtx['endCall'] = useCallback(
    async (reason) => {
      await endCallInternal(reason);
    },
    [endCallInternal],
  );

  // ---- controls ----
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !isMuted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !enabled));
    setIsMuted(enabled);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const off = !isCameraOff;
    stream.getVideoTracks().forEach((t) => (t.enabled = !off));
    setIsCameraOff(off);
  }, [isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
    if (!sender) return;

    if (!isScreenSharing) {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const track = screen.getVideoTracks()[0];
        screenTrackRef.current = track;
        await sender.replaceTrack(track);
        track.onended = () => { toggleScreenShare(); };
        setIsScreenSharing(true);
      } catch (e) {
        console.warn('[CommCall] screen share denied', e);
      }
    } else {
      screenTrackRef.current?.stop();
      screenTrackRef.current = null;
      if (cameraTrackRef.current) {
        await sender.replaceTrack(cameraTrackRef.current);
      }
      setIsScreenSharing(false);
    }
  }, [isScreenSharing]);

  const uploadRecording = useCallback(async (callId: string) => {
    const chunks = recordedChunksRef.current;
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: 'video/webm' });
    const path = `${callId}/recording-${Date.now()}.webm`;
    const { error } = await supabase.storage.from('call-recordings').upload(path, blob, {
      contentType: 'video/webm',
      upsert: false,
    });
    if (error) {
      console.error('[CommCall] upload', error);
      return;
    }
    await supabase.from('comm_calls').update({ recording_url: path }).eq('id', callId);
    recordedChunksRef.current = [];
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }
    const local = localStreamRef.current;
    const remote = remoteStreamRef.current;
    if (!local) return;
    // Mix: combine local+remote tracks
    const mixed = new MediaStream();
    local.getTracks().forEach((t) => mixed.addTrack(t));
    remote?.getTracks().forEach((t) => mixed.addTrack(t));
    try {
      const rec = new MediaRecorder(mixed, { mimeType: 'video/webm;codecs=vp8,opus' });
      recordedChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      rec.start(1000);
      recorderRef.current = rec;
      setIsRecording(true);
    } catch (e) {
      console.error('[CommCall] recording not supported', e);
    }
  }, [isRecording]);

  const value = useMemo<CommCallCtx>(
    () => ({
      call,
      status,
      localStream,
      remoteStream,
      isMuted,
      isCameraOff,
      isScreenSharing,
      isRecording,
      durationSec,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      toggleRecording,
    }),
    [
      call, status, localStream, remoteStream, isMuted, isCameraOff,
      isScreenSharing, isRecording, durationSec,
      startCall, acceptCall, declineCall, endCall,
      toggleMute, toggleCamera, toggleScreenShare, toggleRecording,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommCall() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCommCall must be used within <CommCallProvider>');
  return v;
}
