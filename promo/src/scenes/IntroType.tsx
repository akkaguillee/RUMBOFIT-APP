import type { CSSProperties } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { RED_GRAD } from '../design';
import { clamp, easeInOut, prog } from '../ui';

/*
 * Kinetic type for the first act: each word rises out of its own mask on a
 * given frame and, on exit, lifts out through the top of the same mask.
 * (Local copy of ui.tsx <Words>: that one lets accents and ascenders of the
 * hidden words peek through the bottom of the mask at line-height ≤ 1.02, so
 * here hidden words travel further and are also faded out at both ends.)
 */
export function MaskLine({
  text,
  frames,
  size,
  weight = 800,
  color = '#fff',
  accent = [],
  align = 'left',
  out,
  outEvery = 1.5,
  lineHeight = 1,
  tracking = '-0.035em',
  style,
}: {
  text: string;
  /** Start frame of each word. */
  frames: number[];
  size: number;
  weight?: number;
  color?: string;
  /** Indexes of words drawn with the red gradient. */
  accent?: number[];
  align?: 'left' | 'center';
  /** Frame at which the words start lifting away. */
  out?: number;
  outEvery?: number;
  lineHeight?: number;
  tracking?: string;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  const padTop = size * 0.1;
  const padBottom = size * 0.16;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        columnGap: size * 0.25,
        lineHeight,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const start = frames[i] ?? frames[frames.length - 1]!;
        const s = spring({ frame: frame - start, fps, config: { damping: 20, stiffness: 170, mass: 0.8 } });
        const leave = out === undefined ? 0 : prog(frame, out + i * outEvery, out + 10 + i * outEvery, easeInOut);
        const y = (1 - s) * 130 - leave * 130;
        const opacity = clamp(s * 3) * (1 - clamp((leave - 0.55) * 2.5));
        if (opacity <= 0) {
          return (
            <span key={i} style={{ display: 'inline-block', fontSize: size, fontWeight: weight, letterSpacing: tracking, visibility: 'hidden' }}>
              {w}
            </span>
          );
        }
        const isAccent = accent.includes(i);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              overflow: 'hidden',
              paddingTop: padTop,
              paddingBottom: padBottom,
              marginTop: -padTop,
              marginBottom: -padBottom,
              paddingRight: size * 0.06,
              marginRight: -size * 0.06,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${y}%)`,
                fontSize: size,
                fontWeight: weight,
                letterSpacing: tracking,
                color: isAccent ? 'transparent' : color,
                backgroundImage: isAccent ? RED_GRAD : undefined,
                WebkitBackgroundClip: isAccent ? 'text' : undefined,
                backgroundClip: isAccent ? 'text' : undefined,
                opacity,
                filter: s < 0.999 || leave > 0 ? `blur(${(1 - s) * 7 + leave * 7}px)` : undefined,
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
}
