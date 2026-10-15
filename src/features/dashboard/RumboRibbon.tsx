import { useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { krophedWidth } from '@/brand/krophed';

/** The organic route the ribbon follows (also the baseline of its text). */
const ROUTE = 'M-24 106 C 60 112, 112 70, 172 56 S 272 120, 330 98 S 392 38, 432 34';
const PHRASE = 'CADA PASO CUENTA + ';
const FONT = 13;
const TRACK = 1.2;
/** One phrase along the path, in SVG units: the marquee loops by exactly this much. */
const PHRASE_LEN = krophedWidth(PHRASE) * FONT + PHRASE.length * TRACK;

/**
 * Inicio's signature element: a lime route that draws itself in, with a short
 * phrase in the display face travelling along it and a handwritten note.
 * Decorative only (aria-hidden); still with prefers-reduced-motion.
 */
export function RumboRibbon() {
  const reduce = useReducedMotion();
  const id = `route-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div className="ribbon" aria-hidden="true">
      <svg className="ribbon__svg" viewBox="0 0 400 140" role="presentation" focusable="false">
        <defs>
          <path id={id} d={ROUTE} />
        </defs>
        {/* faint hand-drawn guide offset from the route */}
        <path className="ribbon__guide" d="M-24 128 C 64 134, 118 92, 178 80 S 276 142, 336 120 S 396 62, 432 58" />
        <path className="ribbon__band" d={ROUTE} pathLength={1} />
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
