import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findAchievementDef, RARITIES, type AchievementDef } from '@/domain/achievements/catalog';
import { markUnlocksSeen, useUnseenUnlocks } from '@/db/hooks';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { AchievementBadge } from './AchievementBadge';
import { RARITY_COLORS } from './icons';

type Def = Omit<AchievementDef, 'metric'>;

/** From this many simultaneous unlocks (e.g. new milestones met by past records) one summary is shown. */
export const SUMMARY_FROM = 3;
/** Rows listed in the summary; the rest are counted. */
const LIST_MAX = 5;

/**
 * Shows newly unlocked achievements once (persisted "seen" flag), with a
 * light burst and a glass card that expands from the medal. One or two
 * unlocks get the full medal; several at once (a big session, or milestones
 * added in an update that the user's records already met) become a single
 * compact summary instead of a queue of dialogs.
 */
export function UnlockCelebration({ enabled }: { enabled: boolean }) {
  const unseen = useUnseenUnlocks();
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<string[] | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // A short pause first, so the direct feedback of what unlocked it (a ring
  // filling up, «Hecho», Rumbi's hop) is seen before the celebration covers it.
  useEffect(() => {
    if (!enabled || batch || !unseen?.length) return;
    const t = window.setTimeout(() => setBatch(unseen.map((u) => u.id).filter((id) => findAchievementDef(id))), 1100);
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

  // Rarest first: it leads the single view and the summary.
  const sorted = (batch ?? [])
    .map((id) => findAchievementDef(id))
    .filter((d): d is Def => !!d)
    .sort((a, b) => RARITIES[b.rarity].order - RARITIES[a.rarity].order);
  const main = sorted[0];
  const summary = sorted.length >= SUMMARY_FROM;
  const rest = sorted.slice(1);

  return (
    <AnimatePresence>
      {main && (
        <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title" aria-describedby="celebrate-text">
          <motion.div className="celebrate__scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => void close()} />
          <motion.div
            ref={cardRef}
            className={cx('celebrate__card glass glass--sheet', summary && 'celebrate__card--summary')}
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
            {summary ? <SummaryBody items={sorted} reduce={!!reduce} /> : <SingleBody main={main} rest={rest} reduce={!!reduce} />}
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

/** One unlock (or two): the medal leads, as it always has. */
function SingleBody({ main, rest, reduce }: { main: Def; rest: Def[]; reduce: boolean }) {
  return (
    <>
      <motion.div
        className="celebrate__medal"
        initial={reduce ? false : { scale: 0.2, rotate: -40 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
      >
        <AchievementBadge icon={main.icon} rarity={main.rarity} unlocked size={96} />
      </motion.div>
      <p className="t-eyebrow celebrate__eyebrow">Hito desbloqueado · {RARITIES[main.rarity].label}</p>
      <h2 id="celebrate-title" className="celebrate__title">
        {main.name}
      </h2>
      <p id="celebrate-text" className="celebrate__text">
        {main.description}
      </p>
      {rest.length > 0 && (
        <>
          <div className="celebrate__more" aria-hidden="true">
            {rest.map((d) => (
              <AchievementBadge key={d.id} icon={d.icon} rarity={d.rarity} unlocked size={36} />
            ))}
          </div>
          <p className="t-small" style={{ marginTop: -12, marginBottom: 20 }}>
            También: {rest.map((d) => d.name).join(', ')}
          </p>
        </>
      )}
    </>
  );
}

/** Several unlocks at once: a fan of the three rarest medals and a short list. */
function SummaryBody({ items, reduce }: { items: Def[]; reduce: boolean }) {
  const fan = [items[1], items[0], items[2]];
  const listed = items.length <= LIST_MAX ? items : items.slice(0, LIST_MAX - 1);
  const hidden = items.length - listed.length;
  return (
    <>
      <motion.div
        className="celebrate__fan"
        aria-hidden="true"
        initial={reduce ? false : { scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
      >
        {fan.map(
          (d, i) =>
            d && (
              <span key={d.id} className={`celebrate__fan-item celebrate__fan-item--${['side', 'center', 'side'][i]}`} data-side={i === 0 ? 'left' : i === 2 ? 'right' : undefined}>
                <AchievementBadge icon={d.icon} rarity={d.rarity} unlocked size={i === 1 ? 84 : 58} />
              </span>
            ),
        )}
      </motion.div>
      <p className="t-eyebrow celebrate__eyebrow">Hitos desbloqueados</p>
      <h2 id="celebrate-title" className="celebrate__title">
        ¡{items.length} hitos nuevos!
      </h2>
      <p id="celebrate-text" className="celebrate__text">
        Todos salen de tus registros.
      </p>
      <ul className="celebrate__list">
        {listed.map((d) => (
          <li key={d.id}>
            <AchievementBadge icon={d.icon} rarity={d.rarity} unlocked size={30} />
            <span className="celebrate__list-name">{d.name}</span>
            <span className={`rarity-tag rarity-tag--${d.rarity}`}>{RARITIES[d.rarity].label}</span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="celebrate__list-more">
          Y {hidden} {hidden === 1 ? 'hito' : 'hitos'} más en tu colección.
        </p>
      )}
    </>
  );
}
