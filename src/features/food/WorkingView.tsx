import { Barcode, Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import type { PreparedImage } from './api';

export type WorkStep = 'upload' | 'identify' | 'lookup' | 'product';

interface Step {
  id: string;
  label: string;
}

const PHOTO_STEPS: Step[] = [
  { id: 'prepare', label: 'Foto preparada en tu móvil' },
  { id: 'upload', label: 'Enviando la foto' },
  { id: 'identify', label: 'Identificando alimentos y cantidades' },
  { id: 'lookup', label: 'Buscando valores nutricionales' },
];

const CODE_STEPS: Step[] = [
  { id: 'read', label: 'Código leído' },
  { id: 'product', label: 'Buscando el producto en Open Food Facts' },
];

interface Props {
  image?: PreparedImage;
  code?: string;
  step: WorkStep;
  /** Share of the photo already sent (real bytes). */
  upload: number;
  onCancel: () => void;
}

/**
 * Progress of a scan, step by step. Only the upload has a measurable share
 * (bytes sent); the other steps show activity without a made-up percentage.
 */
export function WorkingView({ image, code, step, upload, onCancel }: Props) {
  const reduce = useReducedMotion();
  const steps = step === 'product' ? CODE_STEPS : PHOTO_STEPS;
  const active = steps.findIndex((s) => s.id === step);
  const current = steps[active];
  const uploadPct = Math.round(Math.min(1, Math.max(0, upload)) * 100);

  return (
    <motion.div className="work" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }}>
      <div className="work__visual">
        {image ? (
          <>
            <motion.img
              src={image.url}
              alt="Foto que se está analizando"
              className="work__photo"
              initial={reduce ? false : { scale: 1.04, filter: 'brightness(1.25)' }}
              animate={{ scale: 1, filter: 'brightness(1)' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
            {!reduce && <span className="work__scan" aria-hidden="true" />}
            <span className="work__grid" aria-hidden="true" />
          </>
        ) : (
          <div className="work__code">
            <Barcode aria-hidden="true" />
            <span className="t-num">{code}</span>
          </div>
        )}
      </div>

      <div className="work__panel">
        <h2 className="work__title">{step === 'product' ? 'Buscando el producto' : 'Analizando tu comida'}</h2>
        <div className="work__bar" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.id} className={cx('work__seg', i < active && 'is-done', i === active && 'is-active')}>
              {i === active && s.id === 'upload' ? (
                <span className="work__seg-fill" style={{ transform: `scaleX(${upload})` }} />
              ) : (
                <span className="work__seg-fill" />
              )}
            </span>
          ))}
        </div>
        <ol className="work__steps">
          {steps.map((s, i) => (
            <li key={s.id} className={cx('work__step', i < active && 'is-done', i === active && 'is-active')} aria-current={i === active ? 'step' : undefined}>
              <span className="work__dot" aria-hidden="true">
                {i < active ? <Check /> : i === active ? <span className="work__spin" /> : null}
              </span>
              <span>
                {s.label}
                {i === active && s.id === 'upload' && <span className="work__pct t-num"> · {uploadPct} %</span>}
              </span>
            </li>
          ))}
        </ol>
        <p className="sr-only" aria-live="polite">
          {current?.label}
        </p>
        <Button variant="ghost" block onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </motion.div>
  );
}
