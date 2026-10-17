import { useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'busy' | 'error';

function statusFor(error: unknown): CameraStatus {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'unavailable';
  return 'error';
}

/**
 * The rear camera as a live preview. It only runs while `active` is true and
 * always releases the camera when it stops (the system indicator turns off).
 * Nothing is recorded: frames are only read when the user takes a photo or
 * while a barcode is being looked for.
 */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    const video = videoRef.current;
    const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;

    void Promise.resolve().then(async () => {
      if (cancelled) return;
      if (!media?.getUserMedia || !window.isSecureContext) {
        setStatus('unavailable');
        return;
      }
      setStatus('starting');
      try {
        const s = await media.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video) {
          video.srcObject = s;
          await video.play().catch(() => undefined);
        }
        setStatus('live');
      } catch (e) {
        if (!cancelled) setStatus(statusFor(e));
      }
    });

    // iOS ends the stream when the app goes to the background: start it again on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && stream?.getVideoTracks().some((t) => t.readyState === 'ended')) setAttempt((a) => a + 1);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, [active, attempt]);

  return {
    videoRef,
    status: active ? status : ('idle' as CameraStatus),
    retry: () => setAttempt((a) => a + 1),
  };
}
