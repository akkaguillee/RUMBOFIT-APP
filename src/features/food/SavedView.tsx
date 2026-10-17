import { motion, useReducedMotion } from 'motion/react';
import { mealLabel } from '@/domain/nutrition/meals';
import type { MealType } from '@/domain/types';
import { formatInt } from '@/domain/units';
import { Button } from '@/ui/Button';

export interface SavedSummary {
  meal: MealType;
  kcal: number;
  estimated: boolean;
  name: string;
}

/** Confirmation after saving: what was stored and where to find it. */
export function SavedView({ summary, onLog, onAgain }: { summary: SavedSummary; onLog: () => void; onAgain: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }}>
      <div className="saved__card" role="status">
        <motion.svg
          className="saved__check"
          viewBox="0 0 64 64"
          aria-hidden="true"
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 20 }}
        >
          <circle cx="32" cy="32" r="30" className="saved__ring" />
          <motion.path
            d="M19 33.5 28 42 45.5 23.5"
            className="saved__tick"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.18, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.svg>
        <h2 className="saved__title">Guardado en {mealLabel(summary.meal)}</h2>
        <p className="saved__text">
          {summary.name} · {summary.estimated ? '≈ ' : ''}
          {formatInt(summary.kcal)} kcal
        </p>
        <p className="t-small">Lo tienes en Hábitos › Comidas, en el registro de hoy.</p>
        <div className="saved__actions">
          <Button block size="lg" onClick={onLog} data-autofocus>
            Ver mi registro
          </Button>
          <Button block variant="secondary" onClick={onAgain}>
            Escanear otra comida
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
