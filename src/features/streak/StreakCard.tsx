import { Trophy } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { WEEKDAY_SHORT } from '@/domain/dates';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { cx } from '@/ui/cx';
import { riseVariants } from '@/ui/motion';
import { useToday } from '@/ui/useToday';
import { StreakFlame } from './StreakFlame';
import { daysLabel, streakMessage } from './streakCopy';
import { useStreak } from './useStreak';
import './streak.css';

/** Dashboard streak: a living flame, the count, this week's days and the record. */
export function StreakCard({ className }: { className?: string }) {
  const streak = useStreak();
  const today = useToday();
  const reduce = useReducedMotion();
  if (!streak) return null;
  const { current, longest, todayActive, week } = streak;
  const record = todayActive && current > 1 && current === longest;

  return (
    <motion.section className={cx('glass card streak-card', className)} variants={riseVariants} aria-labelledby="streak-title">
      <div className="streak-card__main">
        <div className="streak-card__flame">
          <StreakFlame size={64} lit={todayActive} />
        </div>
        <div className="streak-card__text">
          <h2 id="streak-title" className="sr-only">
            Racha
          </h2>
          <p className="streak-card__count">
            <AnimatedNumber value={current} className="t-num" />
            <span>{daysLabel(current)} de racha</span>
          </p>
          <p className="streak-card__msg">{streakMessage(streak)}</p>
        </div>
      </div>

      <ol className="streak-week" aria-label="Días activos de esta semana">
        {week.map((d, i) => (
          <li
            key={d.date}
            className={cx('streak-week__day', d.active && 'is-active', d.future && 'is-future', d.date === today && 'is-today')}
            aria-label={`${WEEKDAY_SHORT[i]}: ${d.future ? 'por llegar' : d.active ? 'activo' : 'sin registros'}`}
          >
            <span className="streak-week__label">{WEEKDAY_SHORT[i]}</span>
            <motion.span
              className="streak-week__dot"
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.15 + i * 0.05, type: 'spring', stiffness: 380, damping: 22 }}
            >
              {d.active ? <StreakFlame size={16} lit /> : null}
            </motion.span>
          </li>
        ))}
      </ol>

      <p className="streak-card__best">
        <Trophy aria-hidden="true" />
        {record ? (
          <span>
            <strong>¡Es tu mejor racha!</strong>
          </span>
        ) : (
          <span>
            Mejor racha: <strong className="t-num">{longest}</strong> {daysLabel(longest)}
          </span>
        )}
      </p>
    </motion.section>
  );
}
