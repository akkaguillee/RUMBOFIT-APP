import { Camera, CameraOff, Images, Info, Keyboard, Play, RefreshCw, Search, X, Zap, ZapOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { isValidGtin, normalizeBarcode } from '@/domain/nutrition/barcode';
import { Button } from '@/ui/Button';
import { NumberField } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { spring } from '@/ui/motion';
import { toast, toastError } from '@/ui/toast';
import { prepareFile, prepareFrame, type PreparedImage, type ScannerStatus } from './api';
import { BarcodeReader } from './barcodeReader';
import { InfoSheet } from './ConsentView';
import { useCamera, type CameraStatus } from './useCamera';

export type ScanMode = 'photo' | 'barcode';

interface Props {
  mode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
  /** What the server can do (null while unknown). */
  server: ScannerStatus | null;
  /** A photo was just taken with the live camera (for the flash effect). */
  onShot: () => void;
  onPhoto: (image: PreparedImage) => void;
  onCode: (code: string) => void;
  onManual: () => void;
  onClose: () => void;
}

const MODES: { id: ScanMode; label: string }[] = [
  { id: 'photo', label: 'Plato' },
  { id: 'barcode', label: 'Código de barras' },
];

export function CaptureView({ mode, onModeChange, server, onShot, onPhoto, onCode, onManual, onClose }: Props) {
  const { videoRef, status, torch, retry, resume, toggleTorch } = useCamera(true);
  const [busy, setBusy] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [flashOpen, setFlashOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const systemCameraRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BarcodeReader | null>(null);
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  });
  const live = status === 'live';
  const reader = () => (readerRef.current ??= new BarcodeReader());

  // Barcodes are read continuously from the preview, on the device.
  useEffect(() => {
    if (mode !== 'barcode' || !live) return;
    const codeReader = (readerRef.current ??= new BarcodeReader());
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      const video = videoRef.current;
      const code = video ? await codeReader.readVideo(video).catch(() => null) : null;
      if (stopped) return;
      if (code) {
        navigator.vibrate?.(35);
        onCodeRef.current(code);
        return;
      }
      timer = window.setTimeout(() => void tick(), 120);
    };
    timer = window.setTimeout(() => void tick(), 400);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [mode, live, videoRef]);

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !live) return;
    try {
      const image = prepareFrame(video);
      onShot();
      onPhoto(image);
    } catch (e) {
      toastError(e);
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      if (mode === 'barcode') {
        const code = await reader().readImage(file);
        if (code) onCode(code);
        else toast('No encontramos un código de barras legible en la foto. Puedes escribir los números.', { tone: 'info', duration: 5200 });
      } else {
        onPhoto(await prepareFile(file));
      }
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="cap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }}>
      <div className="cap__stage">
        <video ref={videoRef} className="cap__video" data-live={live || undefined} playsInline muted autoPlay aria-hidden="true" />
        {live ? (
          <div className="cap__guide">
            {/* Remounted on mode change so the new frame settles in (transform and opacity only). */}
            <div key={mode} className={`cap__frame cap__frame--${mode}`} aria-hidden="true">
              <span className="cap__corner cap__corner--tl" />
              <span className="cap__corner cap__corner--tr" />
              <span className="cap__corner cap__corner--bl" />
              <span className="cap__corner cap__corner--br" />
              {mode === 'barcode' && <span className="cap__laser" />}
            </div>
            <p className="cap__hint" aria-live="polite">
              {mode === 'photo' ? 'Encuadra el plato entero, desde arriba y con buena luz' : 'Alinea el código de barras dentro del recuadro'}
            </p>
          </div>
        ) : (
          <CameraFallback
            status={status}
            mode={mode}
            onRetry={retry}
            onResume={() => void resume()}
            onSystemCamera={() => systemCameraRef.current?.click()}
            onGallery={() => galleryRef.current?.click()}
            onCodeEntry={() => setCodeOpen(true)}
            onManual={onManual}
          />
        )}
        {busy && (
          <div className="cap__busy" role="status">
            <span className="btn__spinner" aria-hidden="true" />
            {mode === 'barcode' ? 'Buscando el código en la foto…' : 'Preparando la foto…'}
          </div>
        )}
      </div>

      <header className="cap__top">
        <button type="button" className="scan-btn" aria-label="Cerrar escáner" onClick={onClose}>
          <X />
        </button>
        <h2 className="cap__title">Escáner de alimentos</h2>
        <div className="cap__top-actions">
          <button
            type="button"
            className="scan-btn scan-btn--flash"
            aria-label={torch.on ? 'Apagar el flash' : 'Encender el flash'}
            aria-pressed={torch.supported ? torch.on : undefined}
            data-on={torch.on || undefined}
            onClick={() => {
              if (!torch.supported) {
                setFlashOpen(true);
                return;
              }
              void toggleTorch().then((ok) => ok || setFlashOpen(true));
            }}
          >
            {torch.on ? <Zap /> : <ZapOff />}
          </button>
          <button type="button" className="scan-btn" aria-label="Cómo funciona el escáner" onClick={() => setInfoOpen(true)}>
            <Info />
          </button>
        </div>
      </header>

      {server && !server.vision && mode === 'photo' && (
        <div className="cap__notice" role="status">
          <p>El análisis por foto aún no está activado en el servidor de RUMBO.</p>
          <button type="button" onClick={() => onModeChange('barcode')}>
            Usar el código de barras
          </button>
        </div>
      )}

      <div className="cap__bottom">
        <ModeSwitch mode={mode} onChange={onModeChange} />
        <div className="cap__controls">
          <button type="button" className="cap__side" onClick={() => galleryRef.current?.click()} disabled={busy}>
            <span className="cap__side-icon">
              <Images aria-hidden="true" />
            </span>
            Galería
          </button>
          {mode === 'photo' ? (
            <button type="button" className="shutter" aria-label="Hacer foto" onClick={shoot} disabled={!live || busy}>
              <span className="shutter__core" />
            </button>
          ) : (
            <button type="button" className="shutter shutter--code" aria-label="Escribir el código" onClick={() => setCodeOpen(true)}>
              <Keyboard aria-hidden="true" />
            </button>
          )}
          <button type="button" className="cap__side" onClick={onManual}>
            <span className="cap__side-icon">
              <Search aria-hidden="true" />
            </span>
            Buscar
          </button>
        </div>
      </div>

      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e)} />
      <input ref={systemCameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFile(e)} />
      <CodeSheet
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        onSubmit={(code) => {
          setCodeOpen(false);
          onCode(code);
        }}
      />
      <InfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} />
      <Sheet
        open={flashOpen}
        onClose={() => setFlashOpen(false)}
        title="Flash"
        footer={
          <div className="flash-sheet__actions">
            <Button
              block
              icon={<Camera />}
              onClick={() => {
                setFlashOpen(false);
                systemCameraRef.current?.click();
              }}
            >
              Hacer la foto con la cámara del sistema
            </Button>
            <Button block variant="ghost" onClick={() => setFlashOpen(false)}>
              Entendido
            </Button>
          </div>
        }
      >
        <p className="t-body">
          {status === 'live'
            ? 'El navegador de este dispositivo no deja encender la luz de la cámara desde una web (pasa en el iPhone).'
            : 'La cámara aún no está lista.'}{' '}
          La cámara del sistema sí tiene flash: haz la foto con ella y RUMBO la analizará igual.
        </p>
      </Sheet>
    </motion.div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: ScanMode; onChange: (m: ScanMode) => void }) {
  const id = useId();
  return (
    <div className="mode-switch" role="radiogroup" aria-label="Qué quieres escanear">
      {MODES.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className="mode-switch__item" onClick={() => onChange(m.id)}>
          {mode === m.id && <motion.span layoutId={`${id}-thumb`} className="mode-switch__thumb" transition={spring.snappy} />}
          <span className="mode-switch__label">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

const FALLBACK_COPY: Record<Exclude<CameraStatus, 'live'>, { title: string; text: string; retry: boolean } | null> = {
  idle: null,
  starting: null,
  paused: null,
  denied: {
    title: 'Sin permiso para usar la cámara',
    text: 'Puedes permitirlo en los ajustes del navegador (en iPhone: Ajustes › Apps › Safari › Cámara) o usar otra opción.',
    retry: true,
  },
  unavailable: { title: 'La cámara no está disponible', text: 'Este navegador o dispositivo no deja usar la cámara dentro de RUMBO. Usa otra opción.', retry: false },
  busy: { title: 'La cámara está ocupada', text: 'Otra app la está usando. Ciérrala y vuelve a intentarlo, o usa otra opción.', retry: true },
  error: { title: 'No se ha podido abrir la cámara', text: 'Vuelve a intentarlo o usa otra opción.', retry: true },
};

function CameraFallback({
  status,
  mode,
  onRetry,
  onResume,
  onSystemCamera,
  onGallery,
  onCodeEntry,
  onManual,
}: {
  status: CameraStatus;
  mode: ScanMode;
  onRetry: () => void;
  onResume: () => void;
  onSystemCamera: () => void;
  onGallery: () => void;
  onCodeEntry: () => void;
  onManual: () => void;
}) {
  const copy = status === 'live' ? null : FALLBACK_COPY[status];
  if (status === 'paused') {
    return (
      <button type="button" className="cap__resume" onClick={onResume}>
        <span className="cap__resume-icon" aria-hidden="true">
          <Play />
        </span>
        Toca para activar la cámara
      </button>
    );
  }
  if (!copy) {
    return (
      <div className="cap__starting" role="status">
        <span className="btn__spinner" aria-hidden="true" />
        Abriendo la cámara…
      </div>
    );
  }
  return (
    <motion.div className="cap__fallback" role="alert" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <span className="cap__fallback-icon" aria-hidden="true">
        <CameraOff />
      </span>
      <h3>{copy.title}</h3>
      <p>{copy.text}</p>
      <div className="cap__fallback-actions">
        {mode === 'photo' ? (
          <Button variant="inverse" icon={<Camera />} onClick={onSystemCamera}>
            Hacer una foto
          </Button>
        ) : (
          <Button variant="inverse" icon={<Keyboard />} onClick={onCodeEntry}>
            Escribir el código
          </Button>
        )}
        <Button variant="secondary" icon={<Images />} onClick={onGallery}>
          {mode === 'photo' ? 'Elegir de la galería' : 'Foto del código'}
        </Button>
        <Button variant="ghost" icon={<Search />} onClick={onManual}>
          Buscar por nombre
        </Button>
        {copy.retry && (
          <Button variant="ghost" icon={<RefreshCw />} onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function CodeSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (code: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const digits = normalizeBarcode(value);
    if (![8, 12, 13, 14].includes(digits.length)) {
      setError('Escribe los 8 o 13 números que aparecen bajo las barras.');
      return;
    }
    if (!isValidGtin(digits)) {
      setError('Los números no cuadran con el dígito de control. Revísalos.');
      return;
    }
    setValue('');
    setError(null);
    onSubmit(digits.length === 12 ? `0${digits}` : digits);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Escribir el código"
      description="Son los números que aparecen bajo las barras del envase."
      footer={
        <Button block onClick={submit}>
          Buscar producto
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <NumberField
          label="Código de barras"
          decimals={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          maxLength={18}
          placeholder="8410000123456"
          error={error}
          data-autofocus
        />
      </form>
    </Sheet>
  );
}
