import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACHIEVEMENTS, COLLECTOR, RARITIES } from '@/domain/achievements/catalog';
import { markUnlocksSeen, useUnseenUnlocks } from '@/db/hooks';
import { Button } from '@/ui/Button';
import { AchievementBadge } from './AchievementBadge';
import { RARITY_COLORS } from './icons';

const defs = new Map([...ACHIEVEMENTS, COLLECTOR].map((d) => [d.id, d]));

/**
 * Shows newly unlocked achievements once (persisted "seen" flag), with a
 * light burst and a glass card that expands from the medal.
 */
export function UnlockCelebration({ enabled }: { enabled: boolean }) {
  const unseen = useUnseenUnlocks();
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<string[] | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || batch || !unseen?.length) return;
    const t = window.setTimeout(() => setBatch(unseen.map((u) => u.id).filter((id) => defs.has(id))), 450);
    return () => window.clearTimeout(t);
  }, [unseen, enabled, batch]);

  useEffect(() => {
    if (!batch) return;
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeRef.current?.focus());
    // Give focus back to where the user was once the dialog closes.
    return () => previous?.focus?.({ preventScroll: true });
  }, [batch]);

  const close = async (goTo?: string) => {
    if (!batch) return;
    await markUnlocksSeen(unseen?.map((u) => u.id) ?? batch);
    setBatch(null);
    if (goTo) navigate(goTo);
  };

  useEffect(() => {
    if (!batch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void close();
        return;
      }
      // Modal dialog: keep Tab / Shift+Tab inside the card.
      const card = cardRef.current;
      if (e.key !== 'Tab' || !card) return;
      const items = [...card.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && (document.activeElement === first || !card.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !card.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Highlight the rarest achievement of the batch.
  const sorted = (batch ?? [])
    .map((id) => defs.get(id)!)
    .sort((a, b) => RARITIES[b.rarity].order - RARITIES[a.rarity].order);
  const main = sorted[0];
  const rest = sorted.slice(1);

  return (
    <AnimatePresence>
      {main && (
        <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
          <motion.div className="celebrate__scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => void close()} />
          <motion.div
            ref={cardRef}
            className="celebrate__card glass glass--sheet"
            style={{ '--medal-glow': RARITY_COLORS[main.rarity].glow } as React.CSSProperties}
            initial={reduce ? { opacity: 0 } : { opacity: 0, clipPath: 'circle(8% at 50% 92px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, clipPath: 'circle(150% at 50% 92px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20, transition: { duration: 0.2 } }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            {!reduce && (
              <>
                <motion.div
                  className="celebrate__burst"
                  initial={{ rotate: 0, opacity: 0 }}
                  animate={{ rotate: 90, opacity: [0, 1, 0.6] }}
                  transition={{ duration: 6, ease: 'linear', opacity: { duration: 1.2 } }}
                  aria-hidden="true"
                />
                <motion.div
                  className="celebrate__ring"
                  initial={{ scale: 0.4, opacity: 0.9 }}
                  animate={{ scale: 2.6, opacity: 0 }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                  aria-hidden="true"
                />
              </>
            )}
            <motion.div
              className="celebrate__medal"
              initial={reduce ? false : { scale: 0.2, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
            >
              <AchievementBadge icon={main.icon} rarity={main.rarity} unlocked size={96} />
            </motion.div>
            <p className="t-eyebrow celebrate__eyebrow">
              Hito desbloqueado · {RARITIES[main.rarity].label}
            </p>
            <h2 id="celebrate-title" className="celebrate__title">
              {main.name}
            </h2>
            <p className="celebrate__text">{main.description}</p>
            {rest.length > 0 && (
              <>
                <div className="celebrate__more" aria-label={`Y ${rest.length} hitos más`}>
                  {rest.slice(0, 5).map((d) => (
                    <AchievementBadge key={d.id} icon={d.icon} rarity={d.rarity} unlocked size={36} />
                  ))}
                </div>
                <p className="t-small" style={{ marginTop: -12, marginBottom: 20 }}>
                  {rest.length === 1 ? `También: ${rest[0]!.name}` : `Y ${rest.length} hitos más`}
                </p>
              </>
            )}
            <div className="vstack" style={{ gap: 10 }}>
              <Button ref={closeRef} block onClick={() => void close()}>
                Seguir avanzando
              </Button>
              <Button variant="ghost" block onClick={() => void close('/hitos')}>
                Ver mis hitos
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
