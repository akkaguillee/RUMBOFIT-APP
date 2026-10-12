import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSetting } from '@/db/hooks';
import { toDateKey, WEEKDAY_SHORT } from '@/domain/dates';
import type { Profile } from '@/domain/types';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { useToday } from '@/ui/useToday';
import { StreakFlame } from './StreakFlame';
import { daysLabel } from './streakCopy';
import { useStreak } from './useStreak';
import './streak.css';

const EXPO = [0.16, 1, 0.3, 1] as const;
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: Math.cos(a), y: Math.sin(a), d: 70 + (i % 3) * 18 };
});

interface Props {
  profile: Profile;
  enabled: boolean;
  /** Tells the parent while the celebration is on screen (other overlays wait). */
  onActiveChange: (active: boolean) => void;
}

/**
 * Daily streak moment: the first record of each day ignites the flame, the
 * count rolls up and this week's day lights up. Shown once per day, and not on
 * the day the profile was created (onboarding already celebrates that day).
 */
export function StreakCelebration({ profile, enabled, onActiveChange }: Props) {
  const streak = useStreak();
  const today = useToday();
  const reduce = useReducedMotion();
  const [celebrated, setCelebrated] = useSetting<string | null>('streak:celebrated', null);
  const [open, setOpen] = useState<number | null>(null);
  const [rolled, setRolled] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const joinedToday = toDateKey(new Date(profile.createdAt)) === today;

  const due = enabled && open === null && celebrated !== undefined && celebrated !== today && !joinedToday && !!streak?.todayActive;
  if (due && streak) {
    // Derived during render: open as soon as today's first record lands.
    setRolled(false);
    setOpen(streak.current);
  }

  useEffect(() => {
    // Mark the day right away so a reload during the animation never repeats it.
    if (open !== null) void setCelebrated(today);
  }, [open, today, setCelebrated]);

  useEffect(() => {
    onActiveChange(open !== null);
  }, [open, onActiveChange]);

  useEffect(() => {
    if (open === null) return;
    const roll = window.setTimeout(() => setRolled(true), reduce ? 0 : 750);
    const focus = requestAnimationFrame(() => buttonRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'Tab') {
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(roll);
      cancelAnimationFrame(focus);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, reduce]);

  const count = open ?? 0;
  const record = streak !== undefined && count > 1 && count >= streak.longest;
  const todayIndex = streak?.week.findIndex((d) => d.date === today) ?? -1;

  return createPortal(
    <AnimatePresence>
      {open !== null && streak && (
        <motion.div
          className="streak-cele"
          role="dialog"
          aria-modal="true"
          aria-labelledby="streak-cele-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          <div className="streak-cele__scrim" aria-hidden="true" />
          <motion.div
            className="streak-cele__glow"
            aria-hidden="true"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: reduce ? 0 : 1.2, ease: EXPO }}
          />

          <div className="streak-cele__stage">
            <div className="streak-cele__flame">
              {!reduce && (
                <>
                  <motion.span
                    className="streak-cele__ring"
                    aria-hidden="true"
                    initial={{ scale: 0.3, opacity: 0.9 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    transition={{ delay: 0.35, duration: 1, ease: EXPO }}
                  />
                  {SPARKS.map((s, i) => (
                    <motion.span
                      key={i}
                      className="streak-cele__spark"
                      aria-hidden="true"
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                      animate={{ x: s.x * s.d, y: s.y * s.d, opacity: [0, 1, 0], scale: 1 }}
                      transition={{ delay: 0.4 + (i % 4) * 0.03, duration: 0.9, ease: EXPO }}
                    />
                  ))}
                </>
              )}
              <motion.div
                initial={reduce ? false : { scale: 0.2, y: 40, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 160, damping: 13 }}
              >
                <StreakFlame size={132} lit intense />
              </motion.div>
            </div>

            {/* Odometer: yesterday's count rolls up into today's. */}
            <div className="streak-cele__count" aria-label={`${count} ${daysLabel(count)} de racha`}>
              <motion.div
                className="streak-cele__roll"
                initial={false}
                animate={{ y: rolled || count <= 1 ? '-50%' : '0%' }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 210, damping: 19 }}
                aria-hidden="true"
              >
                <span className="t-num">{Math.max(0, count - 1)}</span>
                <span className="t-num">{count}</span>
              </motion.div>
            </div>

            <motion.h2
              id="streak-cele-title"
              className="streak-cele__title"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.6, ease: EXPO }}
            >
              {count === 1 ? '¡Racha encendida!' : `¡${count} ${daysLabel(count)} de racha!`}
            </motion.h2>
            <motion.p
              className="streak-cele__text"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6, ease: EXPO }}
            >
              {record ? 'Nuevo récord personal. ' : ''}
              {count === 1 ? 'Has dado el primer paso de hoy. Vuelve mañana para que crezca.' : 'Cada día que registras suma. Vuelve mañana para mantenerla viva.'}
            </motion.p>

            <ol className="streak-week streak-week--cele" aria-label="Días activos de esta semana">
              {streak.week.map((d, i) => {
                const isToday = i === todayIndex;
                return (
                  <li key={d.date} className={cx('streak-week__day', d.active && 'is-active', d.future && 'is-future', isToday && 'is-today')}>
                    <span className="streak-week__label">{WEEKDAY_SHORT[i]}</span>
                    <motion.span
                      className="streak-week__dot"
                      initial={reduce ? false : { scale: isToday ? 0.2 : 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: reduce ? 0 : isToday ? 1.05 : 0.8 + i * 0.04, type: 'spring', stiffness: 420, damping: isToday ? 12 : 24 }}
                    >
                      {d.active ? <StreakFlame size={16} lit /> : null}
                    </motion.span>
                  </li>
                );
              })}
            </ol>

            <motion.div
              className="streak-cele__actions"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95, duration: 0.5, ease: EXPO }}
            >
              <Button ref={buttonRef} size="lg" block onClick={() => setOpen(null)}>
                Continuar
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
