import { motion, useReducedMotion } from 'motion/react';
import { cx } from './cx';

interface Props {
  value: number; // 0..1
  tone?: 'accent' | 'good' | 'warn' | 'water' | 'steps';
  size?: 'md' | 'lg';
  label: string;
  className?: string;
}

export function ProgressBar({ value, tone = 'accent', size = 'md', label, className }: Props) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cx('progress', size === 'lg' && 'progress--lg', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <motion.div
        className={cx('progress__fill', tone !== 'accent' && `progress__fill--${tone}`)}
        initial={{ width: reduce ? `${pct}%` : '0%' }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
