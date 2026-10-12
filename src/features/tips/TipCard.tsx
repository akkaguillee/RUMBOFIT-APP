import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import type { Tip } from '@/domain/tips/types';
import { cx } from '@/ui/cx';
import { ease, riseVariants } from '@/ui/motion';
import { useNow } from '@/ui/useNow';
import { mascotExpression } from '../mascot/expression';
import { Mascot } from '../mascot/Mascot';
import { useSurpriseBeat } from '../mascot/useSurpriseBeat';
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
 * "Tu consejo de hoy", delivered by Rumbi: one tip chosen for today from the
 * user's own records and answers, plus at most one "Un paso más" when something
 * significant happens during the day. Rumbi's face follows the tip (thinking
 * while it loads, a short surprise when the extra tip appears) and reacts to
 * taps. The card is a single surface: the extra tip is a section under a
 * divider, not a card inside the card.
 */
export function TipCard({ className }: { className?: string }) {
  const state = useDailyTips();
  const reduce = useReducedMotion();
  // The hour only nudges a neutral face towards sleepy late at night: a coarse clock is enough.
  const hour = new Date(useNow(5 * 60_000)).getHours();
  const main = state.status === 'ready' ? state.main : null;
  const extra = state.status === 'ready' ? state.extra : undefined;
  const meta = main ? TOPIC_META[main.topic] : null;
  const ExtraIcon = extra ? TOPIC_META[extra.topic].icon : null;
  const face = useSurpriseBeat(mascotExpression(state, hour), extra?.id);
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 8 };

  return (
    <motion.section
      className={cx('glass card tip-card', className)}
      variants={riseVariants}
      aria-labelledby="tip-card-title"
      aria-busy={state.status === 'loading' || undefined}
    >
      <div className="tip-card__layout">
        <Mascot className="tip-card__mascot" expression={face} size={72} interactive />

        <div className="tip-card__head">
          <h2 id="tip-card-title" className="tip-card__label">
            Tu consejo de hoy
          </h2>
          <p className="tip-card__byline">
            <span className="tip-card__name">Rumbi</span>
            {meta && <span className="tip-card__topic">{meta.label}</span>}
          </p>
        </div>

        <div className="tip-card__content">
          {state.status === 'loading' && <TipSkeleton />}
          {state.status === 'empty' && <p className="tip-card__body tip-card__body--lead">Hoy no hay un consejo nuevo. Vuelve mañana.</p>}

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
        </div>
      </div>
    </motion.section>
  );
}

export default TipCard;
