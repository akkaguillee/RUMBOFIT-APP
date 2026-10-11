import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef } from 'react';
import { RUNNER_VIEWBOX, WORDMARK_VIEWBOX, runnerPaths, wordmarkPaths } from '@/brand/logoPaths';
import type { IntroMode } from './intro';

interface Props {
  mode: IntroMode;
  ready: boolean;
  onDone: () => void;
}

export function Splash({ mode, ready, onDone }: Props) {
  const reduce = useReducedMotion();
  const clipId = useId();
  const gradId = useId();
  const full = mode === 'full' && !reduce;
  const total = reduce ? 600 : full ? 2350 : 1150;
  const minElapsed = useRef(false);
  const readyRef = useRef(ready);
  const doneRef = useRef(onDone);

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

  const k = full ? 1 : 0.5; // timeline compression for the brief intro
  const t = (s: number) => (reduce ? 0 : s * k);

  return (
    <motion.div
      className="splash"
      role="presentation"
      initial={{ opacity: 1 }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.25 } }
          : { clipPath: 'inset(0% 0% 100% 0%)', transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] } }
      }
      style={{ clipPath: 'inset(0% 0% 0% 0%)' }}
    >
      <motion.div
        className="splash__glow"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduce ? 0 : 1.2 * k, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      />
      <motion.div
        className="splash__lockup"
        exit={reduce ? undefined : { y: -60, opacity: 0, transition: { duration: 0.45, ease: [0.65, 0, 0.35, 1] } }}
      >
        <svg viewBox={RUNNER_VIEWBOX} className="splash__runner" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff5a66" />
              <stop offset="1" stopColor="#c21f2e" />
            </linearGradient>
          </defs>
          <g fill={`url(#${gradId})`} fillRule="evenodd">
            {runnerPaths.speedLines.map((d, i) => (
              <motion.path
                key={i}
                d={d}
                initial={{ x: reduce ? 0 : 420, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: t(0.18 + i * 0.07), duration: reduce ? 0 : 0.7 * k, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
            <motion.g
              initial={{ y: reduce ? 0 : 140, opacity: 0, rotate: reduce ? 0 : -6 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              transition={{ delay: t(0.08), type: 'spring', stiffness: 170, damping: 18 }}
              style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
            >
              <path d={runnerPaths.leg} />
              <path d={runnerPaths.body} />
            </motion.g>
            <motion.path
              d={runnerPaths.head}
              initial={{ scale: reduce ? 1 : 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: t(0.38), type: 'spring', stiffness: 320, damping: 14 }}
              style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
            />
          </g>
        </svg>

        <svg viewBox={WORDMARK_VIEWBOX} className="splash__wordmark" role="img" aria-label="RUMBO">
          <defs>
            <clipPath id={clipId}>
              {wordmarkPaths.letters.map((d, i) => (
                <path key={i} d={d} clipRule="evenodd" />
              ))}
            </clipPath>
            <clipPath id={`${clipId}-band`}>
              <rect x="-20" y="-6" width="2640" height="360" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId}-band)`} fill="currentColor" fillRule="evenodd">
            {wordmarkPaths.letters.map((d, i) => (
              <motion.path
                key={i}
                d={d}
                initial={{ y: reduce ? 0 : 360 }}
                animate={{ y: 0 }}
                transition={{ delay: t(0.62 + i * 0.075), duration: reduce ? 0 : 0.75 * k, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
            <motion.path
              d={wordmarkPaths.copyright}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: t(1.15), type: 'spring', stiffness: 300, damping: 18 }}
              style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
            />
          </g>
          {!reduce && (
            <g clipPath={`url(#${clipId})`} aria-hidden="true">
              <motion.rect
                y="-10"
                width="420"
                height="370"
                fill="url(#splash-sheen)"
                initial={{ x: -700 }}
                animate={{ x: 2800 }}
                transition={{ delay: t(1.2), duration: 0.95 * k, ease: [0.65, 0, 0.35, 1] }}
              />
            </g>
          )}
          <defs>
            <linearGradient id="splash-sheen" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ff8a93" stopOpacity="0.95" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <motion.p
          className="splash__tagline"
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: t(1.35), duration: 0.5 }}
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
        transition={{ delay: t(0.4) }}
      >
        Saltar
      </motion.button>
    </motion.div>
  );
}
