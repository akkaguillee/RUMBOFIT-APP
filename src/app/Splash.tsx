import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useMemo, useRef } from 'react';
import { RUNNER_VIEWBOX, WORDMARK_VIEWBOX, runnerPaths, wordmarkPaths } from '@/brand/logoPaths';
import type { IntroMode } from './intro';

interface Props {
  mode: IntroMode;
  ready: boolean;
  onDone: () => void;
}

/* Motion-graphics easings (After Effects "easy ease" family). */
const EXPO_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const CURTAIN = [0.76, 0, 0.24, 1] as const;

/** Head centre in runner viewBox units (used for the shockwave). */
const HEAD = { x: 1652, y: 175, r: 176 };

/** Deterministic pseudo-random so the streak layout is stable between renders. */
function streaks(count: number) {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: count }, (_, i) => ({
    top: 8 + rnd() * 84,
    width: 18 + rnd() * 34,
    delay: rnd() * 0.5,
    duration: 0.55 + rnd() * 0.5,
    opacity: 0.12 + rnd() * 0.3,
    key: i,
  }));
}

/**
 * Logo intro in a motion-graphics style: speed streaks, trim-path drawing of
 * the runner, a shockwave from the head, tracked-in wordmark, an anamorphic
 * light streak and a cinematic split to reveal the app. Always white on black.
 */
export function Splash({ mode, ready, onDone }: Props) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const full = mode === 'full' && !reduce;
  const total = reduce ? 600 : full ? 2700 : 1300;
  const minElapsed = useRef(false);
  const readyRef = useRef(ready);
  const doneRef = useRef(onDone);
  const lines = useMemo(() => streaks(12), []);

  useEffect(() => {
    readyRef.current = ready;
    doneRef.current = onDone;
    if (ready && minElapsed.current) onDone();
  }, [ready, onDone]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      minElapsed.current = true;
      if (readyRef.current) doneRef.current();
    }, total);
    return () => window.clearTimeout(t);
  }, [total]);

  const k = full ? 1 : 0.48; // timeline compression for the brief intro
  const t = (s: number) => (reduce ? 0 : s * k);
  const d = (s: number) => (reduce ? 0 : s * k);

  return (
    <motion.div
      className="splash"
      role="presentation"
      exit={reduce ? { opacity: 0, transition: { duration: 0.25 } } : { opacity: 1, transition: { duration: 0.95 } }}
    >
      {/* Background halves: they part like a curtain on exit */}
      <motion.div
        className="splash__half splash__half--top"
        aria-hidden="true"
        exit={
          reduce
            ? undefined
            : {
                y: '-100%',
                transition: { delay: 0.18, duration: 0.75, ease: CURTAIN },
              }
        }
      />
      <motion.div
        className="splash__half splash__half--bottom"
        aria-hidden="true"
        exit={
          reduce
            ? undefined
            : {
                y: '100%',
                transition: { delay: 0.18, duration: 0.75, ease: CURTAIN },
              }
        }
      />

      <motion.div className="splash__fx" aria-hidden="true" exit={{ opacity: 0, transition: { duration: 0.25 } }}>
        <motion.div
          className="splash__spot"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: d(1.4), ease: EXPO_OUT }}
        />
        {!reduce &&
          lines.map((l) => (
            <motion.span
              key={l.key}
              className="splash__streak"
              style={{ top: `${l.top}%`, width: `${l.width}vw` }}
              initial={{ x: '110vw', opacity: 0 }}
              animate={{ x: '-60vw', opacity: [0, l.opacity, l.opacity, 0] }}
              transition={{
                delay: t(0.05 + l.delay),
                duration: d(l.duration),
                ease: 'linear',
              }}
            />
          ))}
      </motion.div>

      <motion.div
        className="splash__lockup"
        exit={
          reduce
            ? undefined
            : {
                scale: 0.9,
                opacity: 0,
                filter: 'blur(10px)',
                transition: { duration: 0.32, ease: EASE_IN_OUT },
              }
        }
      >
        <motion.div
          className="splash__bloom"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: reduce ? 0.1 : [0, 0.32, 0.1], scale: 1 }}
          transition={{ delay: t(0.5), duration: d(1.4), ease: EXPO_OUT }}
        />

        <motion.svg
          viewBox={RUNNER_VIEWBOX}
          className="splash__runner"
          aria-hidden="true"
          initial={{ x: reduce ? 0 : -26 }}
          animate={{ x: 0 }}
          transition={{ duration: d(1.2), ease: EXPO_OUT }}
        >
          {/* Speed lines shoot in, stretched as if motion-blurred */}
          <g fill="#fff">
            {runnerPaths.speedLines.map((p, i) => (
              <motion.path
                key={i}
                d={p}
                initial={{
                  x: reduce ? 0 : -520,
                  scaleX: reduce ? 1 : 2.2,
                  opacity: 0,
                }}
                animate={{ x: 0, scaleX: 1, opacity: 1 }}
                transition={{
                  delay: t(0.12 + i * 0.07),
                  duration: d(0.75),
                  ease: EXPO_OUT,
                }}
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: '100% 50%',
                }}
              />
            ))}
          </g>

          {/* Trim-path outline that draws the body, then the fill floods in */}
          {!reduce && (
            <g fill="none" stroke="#fff" strokeWidth={14} strokeLinejoin="round">
              {[runnerPaths.leg, runnerPaths.body].map((p, i) => (
                <motion.path
                  key={i}
                  d={p}
                  initial={{ pathLength: 0, opacity: 1 }}
                  animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                  transition={{
                    pathLength: {
                      delay: t(0.18 + i * 0.08),
                      duration: d(0.8),
                      ease: EASE_IN_OUT,
                    },
                    opacity: {
                      delay: t(0.18 + i * 0.08),
                      duration: d(1.15),
                      times: [0, 0.75, 1],
                    },
                  }}
                />
              ))}
            </g>
          )}
          <motion.g
            fill="#fff"
            fillRule="evenodd"
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: t(0.78), duration: d(0.4), ease: 'easeOut' }}
          >
            <path d={runnerPaths.leg} />
            <path d={runnerPaths.body} />
          </motion.g>

          {/* Head pops with overshoot and sends out a shockwave */}
          {!reduce && (
            <motion.circle
              cx={HEAD.x}
              cy={HEAD.y}
              fill="none"
              stroke="#fff"
              initial={{ r: HEAD.r, opacity: 0, strokeWidth: 30 }}
              animate={{
                r: HEAD.r * 3.4,
                opacity: [0, 0.7, 0],
                strokeWidth: 2,
              }}
              transition={{ delay: t(0.62), duration: d(0.9), ease: EXPO_OUT }}
            />
          )}
          <motion.path
            d={runnerPaths.head}
            fill="#fff"
            initial={{ scale: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: t(0.58),
              type: 'spring',
              stiffness: 420,
              damping: 13,
            }}
            style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
          />
        </motion.svg>

        <div className="splash__word">
          {!reduce && (
            <motion.span
              className="splash__flare"
              aria-hidden="true"
              initial={{ x: '-70vw', opacity: 0 }}
              animate={{ x: '70vw', opacity: [0, 1, 1, 0] }}
              transition={{
                delay: t(1.3),
                duration: d(0.85),
                ease: EASE_IN_OUT,
              }}
            />
          )}
          <svg viewBox={WORDMARK_VIEWBOX} className="splash__wordmark" role="img" aria-label="RUMBO">
            <defs>
              <clipPath id={`${uid}-band`}>
                <rect x="-200" y="-6" width="3000" height="358" />
              </clipPath>
            </defs>
            <g clipPath={`url(#${uid}-band)`} fill="#fff" fillRule="evenodd">
              {wordmarkPaths.letters.map((p, i) => (
                <motion.path
                  key={i}
                  d={p}
                  initial={{
                    y: reduce ? 0 : 380,
                    x: reduce ? 0 : (i - 2) * 120,
                  }}
                  animate={{ y: 0, x: 0 }}
                  transition={{
                    y: {
                      delay: t(0.86 + i * 0.065),
                      duration: d(0.8),
                      ease: EXPO_OUT,
                    },
                    x: { delay: t(0.86), duration: d(1.25), ease: EXPO_OUT },
                  }}
                />
              ))}
              <motion.path
                d={wordmarkPaths.copyright}
                initial={{ opacity: 0, scale: reduce ? 1 : 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: t(1.4),
                  type: 'spring',
                  stiffness: 380,
                  damping: 16,
                }}
                style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
              />
            </g>
          </svg>
        </div>

        <motion.p
          className="splash__tagline"
          initial={{ opacity: 0, letterSpacing: reduce ? '0.32em' : '0.9em' }}
          animate={{ opacity: 1, letterSpacing: '0.32em' }}
          transition={{ delay: t(1.45), duration: d(1.1), ease: EXPO_OUT }}
        >
          Cada pequeño paso cuenta
        </motion.p>
      </motion.div>

      <motion.button
        type="button"
        className="splash__skip"
        onClick={onDone}
        disabled={!ready}
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        transition={{ delay: t(0.6) }}
      >
        Saltar
      </motion.button>
    </motion.div>
  );
}
