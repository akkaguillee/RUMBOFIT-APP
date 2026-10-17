import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSetting } from '@/db/hooks';
import { addMeal } from '@/db/repos/meals';
import { isDateKey, todayKey } from '@/domain/dates';
import type { MealType } from '@/domain/types';
import { cheer } from '@/ui/cheer';
import { toastError } from '@/ui/toast';
import { analyzePhoto, FoodApiError, lookupBarcode, lookupNutrients, scannerStatus, type PreparedImage, type ScannerStatus } from './api';
import { CaptureView, type ScanMode } from './CaptureView';
import { ConsentView } from './ConsentView';
import { applyLookups, draftFromAnalysis, draftFromProduct, emptyDraft, failLookups, retryLookups, summarize, toMealItems, waitingKeys, type Draft } from './draft';
import { FailedView } from './FailedView';
import { ResultView } from './ResultView';
import { SavedView, type SavedSummary } from './SavedView';
import { WorkingView, type WorkStep } from './WorkingView';
import './food.css';

/** Bumped if what the scanner does with photos ever changes, so people read it again. */
export const SCAN_CONSENT_VERSION = 1;
export const SCAN_CONSENT_KEY = 'foodScanConsent';

type Phase =
  | { kind: 'capture' }
  | { kind: 'working'; image?: PreparedImage; code?: string; step: WorkStep; upload: number }
  | { kind: 'failed'; error: FoodApiError; image?: PreparedImage; code?: string; retry: (() => void) | null }
  | { kind: 'result'; draft: Draft; image?: PreparedImage; lookupError?: FoodApiError }
  | { kind: 'saved'; summary: SavedSummary };

const asFoodError = (e: unknown): FoodApiError =>
  e instanceof FoodApiError ? e : new FoodApiError('upstream', 'Algo no ha ido bien en el análisis. Inténtalo de nuevo.');

/**
 * «Escáner de alimentos»: a full-screen layer over the app with the camera,
 * the analysis and the editable result. It is a route (/habitos/escaner) so
 * the back gesture closes it.
 */
export default function ScannerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [consent, setConsent] = useSetting<number>(SCAN_CONSENT_KEY, 0);
  const [params] = useState(() => new URLSearchParams(location.search));
  const [phase, setPhase] = useState<Phase>(() => (params.get('modo') === 'manual' ? { kind: 'result', draft: emptyDraft() } : { kind: 'capture' }));
  const [mode, setMode] = useState<ScanMode>(() => (params.get('modo') === 'codigo' ? 'barcode' : 'photo'));
  // Logging for an earlier day from Hábitos › Comidas (never a future one).
  const [date] = useState(() => {
    const d = params.get('fecha');
    return d && isDateKey(d) && d < todayKey() ? d : undefined;
  });
  const [saving, setSaving] = useState(false);
  const [server, setServer] = useState<ScannerStatus | null>(null);
  const [shots, setShots] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** Increases with every scan, so late answers never land on a newer result. */
  const scanRef = useRef(0);

  // Ask once what the server can do, to warn before a photo is taken.
  useEffect(() => {
    let alive = true;
    void scannerStatus().then((s) => alive && setServer(s));
    return () => {
      alive = false;
    };
  }, []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    if (location.key !== 'default') navigate(-1);
    else navigate('/habitos?tab=comidas', { replace: true });
  }, [location.key, navigate]);

  // Stop any request in flight when the scanner closes.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // Sheets above the scanner handle their own Escape.
      if (e.key === 'Escape' && !document.querySelector('.overlay')) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  const backToCapture = () => {
    abortRef.current?.abort();
    scanRef.current++;
    setPhase({ kind: 'capture' });
  };

  const runBarcode = async (code: string, image?: PreparedImage) => {
    setPhase({ kind: 'working', code, image, step: 'product', upload: 1 });
    try {
      const product = await lookupBarcode(code);
      setPhase({ kind: 'result', draft: draftFromProduct(product), image });
    } catch (e) {
      setPhase({ kind: 'failed', error: asFoodError(e), code, image, retry: () => void runBarcode(code, image) });
    }
  };

  /** Checks the estimated values against USDA in the background and puts the answers on the result. */
  const verify = async (scan: number, draft: Draft) => {
    const pending = waitingKeys(draft);
    if (!pending.length) return;
    try {
      const results = await lookupNutrients(pending);
      if (scanRef.current === scan) setPhase((p) => (p.kind === 'result' ? { ...p, draft: applyLookups(p.draft, results), lookupError: undefined } : p));
    } catch (e) {
      if (scanRef.current === scan) setPhase((p) => (p.kind === 'result' ? { ...p, draft: failLookups(p.draft), lookupError: asFoodError(e) } : p));
    }
  };

  const runPhoto = async (image: PreparedImage, hint?: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const scan = ++scanRef.current;
    setPhase({ kind: 'working', image, step: 'upload', upload: 0 });
    try {
      const [analysis, status] = await Promise.all([
        analyzePhoto(image, {
          hint,
          signal: ctrl.signal,
          onUpload: (f) => setPhase((p) => (p.kind === 'working' && p.step === 'upload' ? { ...p, upload: f, step: f >= 1 ? 'identify' : 'upload' } : p)),
        }),
        scannerStatus(),
      ]);
      if (ctrl.signal.aborted) return;
      // A legible barcode on a package beats a visual estimate: try the product data first.
      if (analysis.barcode) {
        try {
          setPhase({ kind: 'working', image, code: analysis.barcode, step: 'product', upload: 1 });
          const product = await lookupBarcode(analysis.barcode);
          if (!ctrl.signal.aborted) setPhase({ kind: 'result', draft: draftFromProduct(product), image });
          return;
        } catch {
          // Not in Open Food Facts: fall back to what the photo shows.
        }
      }
      if (!analysis.isFood || !analysis.items.length) {
        const message =
          analysis.quality === 'not_food'
            ? 'No vemos comida en esta foto. Prueba a encuadrar el plato o el producto.'
            : 'No hemos podido reconocer los alimentos. Prueba con más luz, más cerca o desde arriba.';
        setPhase({ kind: 'failed', error: new FoodApiError('not_found', message), image, retry: null });
        return;
      }
      // Results show at once with the estimated values; the database check follows.
      const draft = draftFromAnalysis(analysis, { verify: status?.database !== false });
      setPhase({ kind: 'result', draft, image });
      void verify(scan, draft);
    } catch (e) {
      const err = asFoodError(e);
      if (err.code === 'aborted') return;
      setPhase({ kind: 'failed', error: err, image, retry: () => void runPhoto(image, hint) });
    }
  };

  const retryValues = () => {
    if (phase.kind !== 'result') return;
    const draft = retryLookups(phase.draft);
    setPhase({ ...phase, draft, lookupError: undefined });
    void verify(scanRef.current, draft);
  };

  const save = async (meal: MealType) => {
    if (phase.kind !== 'result') return;
    const { draft } = phase;
    setSaving(true);
    try {
      const items = toMealItems(draft);
      await addMeal({ date, meal, name: draft.dish.trim() || items[0]?.name || 'Comida', items, origin: draft.origin });
      const s = summarize(draft);
      setPhase({ kind: 'saved', summary: { meal, kcal: Math.round(s.total.kcal), estimated: s.estimated, name: draft.dish.trim() || items[0]?.name || 'Comida' } });
      cheer();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const startManual = () => setPhase({ kind: 'result', draft: emptyDraft() });

  const layer = (
    <motion.div
      ref={rootRef}
      className={`scanner scanner--${phase.kind}`}
      role="dialog"
      aria-modal="true"
      aria-label="Escáner de alimentos"
      tabIndex={-1}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
    >
      {consent === undefined ? null : consent < SCAN_CONSENT_VERSION && !(phase.kind === 'result' && phase.draft.origin === 'manual') ? (
        <ConsentView onAccept={() => void setConsent(SCAN_CONSENT_VERSION)} onClose={close} />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {phase.kind === 'capture' && (
            <CaptureView
              key="capture"
              mode={mode}
              onModeChange={setMode}
              server={server}
              onShot={() => setShots((n) => n + 1)}
              onPhoto={(image) => void runPhoto(image)}
              onCode={(code) => void runBarcode(code)}
              onManual={startManual}
              onClose={close}
            />
          )}
          {phase.kind === 'working' && (
            <WorkingView key="working" image={phase.image} code={phase.code} step={phase.step} upload={phase.upload} onCancel={backToCapture} />
          )}
          {phase.kind === 'failed' && (
            <FailedView
              key="failed"
              error={phase.error}
              image={phase.image}
              code={phase.code}
              onRetry={phase.retry}
              onRescan={backToCapture}
              onManual={startManual}
              onBarcode={() => {
                setMode('barcode');
                backToCapture();
              }}
              onClose={close}
            />
          )}
          {phase.kind === 'result' && (
            <ResultView
              key="result"
              draft={phase.draft}
              date={date}
              image={phase.image}
              lookupError={phase.lookupError}
              saving={saving}
              onChange={(draft) => setPhase((p) => (p.kind === 'result' ? { ...p, draft } : p))}
              onRetryValues={retryValues}
              onReanalyze={phase.image ? (hint) => void runPhoto(phase.image!, hint) : undefined}
              onSave={(meal) => void save(meal)}
              onRescan={backToCapture}
              onClose={close}
            />
          )}
          {phase.kind === 'saved' && (
            <SavedView
              key="saved"
              summary={phase.summary}
              onLog={() => navigate('/habitos?tab=comidas', { replace: true })}
              onAgain={backToCapture}
            />
          )}
        </AnimatePresence>
      )}
      {/* Camera flash: a short white blink above everything when a photo is taken. */}
      {shots > 0 && !reduce && <span key={shots} className="shot-flash" aria-hidden="true" />}
    </motion.div>
  );

  return createPortal(layer, document.body);
}
