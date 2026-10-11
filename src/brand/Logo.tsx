import { RUNNER_VIEWBOX, WORDMARK_TEXT_VIEWBOX, WORDMARK_VIEWBOX, runnerPaths, wordmarkPaths } from './logoPaths';

interface MarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/** The RUMBO runner symbol, drawn in currentColor. */
export function RunnerMark({ size = 32, className, title }: MarkProps) {
  return (
    <svg
      viewBox={RUNNER_VIEWBOX}
      width={size}
      height={(size * 1600) / 2040}
      className={className}
      fill="currentColor"
      fillRule="evenodd"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {runnerPaths.speedLines.map((d, i) => (
        <path key={i} d={d} />
      ))}
      <path d={runnerPaths.leg} />
      <path d={runnerPaths.body} />
      <path d={runnerPaths.head} />
    </svg>
  );
}

interface WordmarkProps {
  height?: number;
  className?: string;
  /** The © mark is omitted at small sizes, where it would be illegible. */
  withCopyright?: boolean;
  title?: string;
}

export function Wordmark({ height = 20, className, withCopyright = false, title = 'RUMBO' }: WordmarkProps) {
  const [vx, vy, vw, vh] = (withCopyright ? WORDMARK_VIEWBOX : WORDMARK_TEXT_VIEWBOX).split(' ').map(Number) as [number, number, number, number];
  return (
    <svg
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      height={height}
      width={(height * vw) / vh}
      className={className}
      fill="currentColor"
      fillRule="evenodd"
      role="img"
      aria-label={title}
    >
      {wordmarkPaths.letters.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {withCopyright && <path d={wordmarkPaths.copyright} />}
    </svg>
  );
}

export function LogoInline({ height = 18 }: { height?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(height * 0.5) }}>
      <RunnerMark size={Math.round(height * 1.75)} />
      <Wordmark height={height} />
    </span>
  );
}
