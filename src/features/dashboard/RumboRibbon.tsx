import { useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { krophedWidth } from '@/brand/krophed';

/** The organic route the ribbon follows (also the baseline of its text). */
const ROUTE = 'M-24 84 C 60 90, 112 56, 172 46 S 272 96, 330 78 S 392 32, 432 28';
const PHRASE = 'CADA PASO CUENTA + ';
const FONT = 13;
const TRACK = 1.2;
/** One phrase along the path, in SVG units: the marquee loops by exactly this much. */
const PHRASE_LEN = krophedWidth(PHRASE) * FONT + PHRASE.length * TRACK;

/**
 * Inicio's signature element: a violet route that draws itself in, with a
 * short phrase in the display face travelling along it and a handwritten
 * note. Decorative only (aria-hidden); still with prefers-reduced-motion.
 */
export function RumboRibbon() {
  const reduce = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = `route-${uid}`;
  const grad = `ribbon-grad-${uid}`;
  return (
    <div className="ribbon" aria-hidden="true">
      <svg className="ribbon__svg" viewBox="0 0 400 116" role="presentation" focusable="false">
        <defs>
          <path id={id} d={ROUTE} />
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--acc-hi)' }} />
            <stop offset="0.55" style={{ stopColor: 'var(--acc)' }} />
            <stop offset="1" style={{ stopColor: 'var(--acc-lo)' }} />
          </linearGradient>
        </defs>
        {/* faint hand-drawn guide offset from the route */}
        <path className="ribbon__guide" d="M-24 104 C 64 110, 118 76, 178 66 S 276 116, 336 98 S 396 52, 432 48" />
        <path className="ribbon__band" d={ROUTE} pathLength={1} stroke={`url(#${grad})`} />
        <text className="ribbon__text" fontSize={FONT} letterSpacing={TRACK} dominantBaseline="central">
          <textPath href={`#${id}`} startOffset={reduce ? 0 : -PHRASE_LEN}>
            {PHRASE.repeat(4)}
            {!reduce && <animate attributeName="startOffset" from={-PHRASE_LEN} to={0} dur="16s" repeatCount="indefinite" />}
          </textPath>
        </text>
      </svg>
      <p className="ribbon__note hand">
        tu ritmo,
        <br />
        tu rumbo
      </p>
      <svg className="ribbon__marks" viewBox="0 0 40 40" focusable="false">
        <path d="M8 26 4 32M18 22l-1 9M28 25l5 6" />
      </svg>
    </div>
  );
}
