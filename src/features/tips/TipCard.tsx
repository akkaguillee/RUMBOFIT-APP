import { ChevronRight, Lightbulb } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import type { Tip } from '@/domain/tips/types';
import { cx } from '@/ui/cx';
import { ease, riseVariants } from '@/ui/motion';
import { TOPIC_META } from './topics';
import { useDailyTips } from './useDailyTips';
import './tips.css';

function TipText({ tip, extra }: { tip: Tip; extra?: boolean }) {
  return (
    <>
      <h3 className={cx('tip-card__title', extra && 'tip-card__title--extra')}>{tip.title}</h3>
      <p className="tip-card__body">{tip.body}</p>
      {tip.action && (
        <Link to={tip.action.to} className="link-btn pressable tip-card__action">
          {tip.action.label}
          <ChevronRight aria-hidden="true" />
        </Link>
      )}
    </>
  );
}

function TipSkeleton() {
  return (
    <div className="tip-card__skeleton" aria-hidden="true">
      <span style={{ width: '58%' }} />
      <span />
      <span style={{ width: '82%' }} />
    </div>
  );
}

/**
 * "Tu consejo de hoy": one tip chosen for today from the user's own records and
 * answers, plus at most one "Un paso más" when something significant happens
 * during the day. The card is a single surface: the extra tip is a section
 * under a divider, not a card inside the card.
 */
export function TipCard({ className }: { className?: string }) {
  const state = useDailyTips();
  const reduce = useReducedMotion();
  const main = state.status === 'ready' ? state.main : null;
  const extra = state.status === 'ready' ? state.extra : undefined;
  const meta = main ? TOPIC_META[main.topic] : null;
  const Icon = meta?.icon ?? Lightbulb;
  const ExtraIcon = extra ? TOPIC_META[extra.topic].icon : null;
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 8 };

  return (
    <motion.section
      className={cx('glass card tip-card', className)}
      variants={riseVariants}
      aria-labelledby="tip-card-title"
      aria-busy={state.status === 'loading' || undefined}
    >
      <div className="tip-card__head">
        <span className="tip-card__icon" aria-hidden="true">
          <Icon />
        </span>
        <h2 id="tip-card-title" className="tip-card__label">
          Tu consejo de hoy
        </h2>
        {meta && <span className="tip-card__topic">{meta.label}</span>}
      </div>

      {state.status === 'loading' && <TipSkeleton />}
      {state.status === 'empty' && <p className="tip-card__body">Hoy no hay un consejo nuevo. Vuelve mañana.</p>}

      {main && (
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={main.id}
            className="tip-card__main"
            initial={enter}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: ease.out } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <TipText tip={main} />
          </motion.div>
        </AnimatePresence>
      )}

      <div aria-live="polite">
        <AnimatePresence>
          {extra && ExtraIcon && (
            <motion.div
              key={extra.id}
              className="tip-card__extra"
              initial={enter}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.42, ease: ease.out, delay: 0.12 } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              <p className="tip-card__extra-label">
                <ExtraIcon aria-hidden="true" />
                Un paso más
              </p>
              <TipText tip={extra} extra />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

export default TipCard;
