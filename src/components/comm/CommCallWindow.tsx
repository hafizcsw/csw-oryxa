/**
 * CommCallWindow — Full-screen overlay for an active voice/video call.
 * Renders local + remote video, controls, and an incoming-call dialog.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Phone, MonitorUp, MonitorOff,
  Circle, StopCircle, Maximize2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useCommCall } from '@/contexts/CommCallContext';

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function CommCallWindow() {
  const { t } = useTranslation();
  const {
    call, status, localStream, remoteStream,
    isMuted, isCameraOff, isScreenSharing, isRecording, durationSec,
    acceptCall, declineCall, endCall,
    toggleMute, toggleCamera, toggleScreenShare, toggleRecording,
  } = useCommCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!call || status === 'idle') return null;

  // Incoming ringing dialog
  if (status === 'ringing-in') {
    return (
      <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <Avatar className="w-20 h-20 mx-auto mb-4 ring-4 ring-primary/20 animate-pulse">
            <AvatarImage src={call.remoteAvatar} />
            <AvatarFallback className="text-2xl">
              {(call.remoteName || '?')[0]}
            </AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-semibold mb-1">
            {call.remoteName || t('comm.unknown')}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {call.callType === 'video'
              ? t('comm.call.incomingVideo')
              : t('comm.call.incomingAudio')}
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              size="lg"
              variant="destructive"
              onClick={() => declineCall()}
              className="rounded-full h-14 w-14 p-0"
              aria-label={t('comm.call.decline')}
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button
              size="lg"
              onClick={() => acceptCall()}
              className="rounded-full h-14 w-14 p-0 bg-green-600 hover:bg-green-700 text-white"
              aria-label={t('comm.call.accept')}
            >
              <Phone className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isVideo = call.callType === 'video';
  const showRemoteVideo = isVideo && remoteStream && remoteStream.getVideoTracks().length > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={call.remoteAvatar} />
            <AvatarFallback>{(call.remoteName || '?')[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{call.remoteName || t('comm.unknown')}</p>
            <p className="text-xs opacity-70">
              {status === 'ringing-out' && t('comm.call.calling')}
              {status === 'connecting' && t('comm.call.connecting')}
              {status === 'connected' && fmtDuration(durationSec)}
              {status === 'ended' && t('comm.call.ended')}
            </p>
          </div>
        </div>
        {isRecording && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-600/90 text-xs">
            <Circle className="w-2 h-2 fill-current animate-pulse" />
            REC
          </div>
        )}
      </div>

      {/* Remote area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {showRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center text-white">
            <Avatar className="w-32 h-32 mx-auto mb-4 ring-4 ring-white/20">
              <AvatarImage src={call.remoteAvatar} />
              <AvatarFallback className="text-4xl">
                {(call.remoteName || '?')[0]}
              </AvatarFallback>
            </Avatar>
            <p className="text-xl font-medium">{call.remoteName || t('comm.unknown')}</p>
            <p className="text-sm opacity-70 mt-2">
              {status === 'connected'
                ? (isVideo ? t('comm.call.cameraOff') : t('comm.call.audioOnly'))
                : t('comm.call.connecting')}
            </p>
          </div>
        )}

        {/* Local PiP */}
        {isVideo && localStream && !isCameraOff && (
          <div className="absolute bottom-28 right-4 w-32 h-44 sm:w-40 sm:h-56 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button
            size="lg"
            variant={isMuted ? 'destructive' : 'secondary'}
            onClick={toggleMute}
            className="rounded-full h-12 w-12 p-0"
            aria-label={isMuted ? t('comm.call.unmute') : t('comm.call.mute')}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          {isVideo && (
            <Button
              size="lg"
              variant={isCameraOff ? 'destructive' : 'secondary'}
              onClick={toggleCamera}
              className="rounded-full h-12 w-12 p-0"
              aria-label={isCameraOff ? t('comm.call.cameraOn') : t('comm.call.cameraOff')}
            >
              {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>
          )}

          <Button
            size="lg"
            variant={isScreenSharing ? 'default' : 'secondary'}
            onClick={() => toggleScreenShare()}
            className="rounded-full h-12 w-12 p-0"
            disabled={status !== 'connected'}
            aria-label={isScreenSharing ? t('comm.call.stopShare') : t('comm.call.startShare')}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
          </Button>

          <Button
            size="lg"
            variant={isRecording ? 'destructive' : 'secondary'}
            onClick={() => toggleRecording()}
            className="rounded-full h-12 w-12 p-0"
            disabled={status !== 'connected'}
            aria-label={isRecording ? t('comm.call.stopRecording') : t('comm.call.startRecording')}
          >
            {isRecording ? <StopCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </Button>

          <Button
            size="lg"
            variant="destructive"
            onClick={() => endCall('hangup')}
            className="rounded-full h-14 w-14 p-0"
            aria-label={t('comm.call.endCall')}
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
