import { useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'paused' | 'denied' | 'unavailable' | 'busy' | 'error';

export interface TorchState {
  /** The browser lets RUMBO turn the camera light on (Chrome on Android, some others). */
  supported: boolean;
  on: boolean;
}

function statusFor(error: unknown): CameraStatus {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'unavailable';
  return 'error';
}

/** Resolves once the preview shows real frames (or after a short wait). */
function framesReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('loadeddata', done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, 3000);
    video.addEventListener('loadeddata', done);
  });
}

/**
 * The rear camera as a live preview. It only runs while `active` is true and
 * always releases the camera when it stops (the system indicator turns off).
 * Nothing is recorded: frames are only read when the user takes a photo or
 * while a barcode is being looked for. When the browser allows it, the camera
 * light can be switched on as a flash.
 */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [torch, setTorch] = useState<TorchState>({ supported: false, on: false });
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
        const track = s.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorch({ supported: caps.torch === true, on: false });
        if (video) {
          video.srcObject = s;
          try {
            await video.play();
          } catch {
            // Autoplay refused (e.g. Low Power Mode on iPhone): a tap starts it.
            if (!cancelled) setStatus('paused');
            return;
          }
          await framesReady(video);
        }
        if (!cancelled) setStatus('live');
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
      trackRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [active, attempt]);

  /** Starts a paused preview from a tap (which counts as a user gesture). */
  const resume = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      await framesReady(video);
      setStatus('live');
    } catch {
      setStatus('paused');
    }
  };

  /** Turns the camera light on or off; resolves to false when the device refuses. */
  const toggleTorch = async (): Promise<boolean> => {
    const track = trackRef.current;
    if (!track || !torch.supported) return false;
    const next = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch({ supported: true, on: next });
      return true;
    } catch {
      setTorch({ supported: false, on: false });
      return false;
    }
  };

  return {
    videoRef,
    status: active ? status : ('idle' as CameraStatus),
    torch: active ? torch : { supported: false, on: false },
    retry: () => setAttempt((a) => a + 1),
    resume,
    toggleTorch,
  };
}
