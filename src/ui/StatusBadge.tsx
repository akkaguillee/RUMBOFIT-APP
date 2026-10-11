import { AlertTriangle, CircleDashed, Minus, TrendingDown, TrendingUp, CheckCircle2 } from 'lucide-react';
import type { Tone } from '@/domain/weight';
import { cx } from './cx';

interface Props {
  tone: Tone;
  label: string;
  icon?: 'trend-up' | 'trend-down' | 'check' | 'alert' | 'flat' | 'pending';
  className?: string;
}

const icons = {
  'trend-up': TrendingUp,
  'trend-down': TrendingDown,
  check: CheckCircle2,
  alert: AlertTriangle,
  flat: Minus,
  pending: CircleDashed,
};

/** Status is never conveyed by color alone: every badge has an icon and text. */
export function StatusBadge({ tone, label, icon, className }: Props) {
  const Icon = icons[icon ?? (tone === 'good' ? 'check' : tone === 'bad' ? 'alert' : tone === 'warn' ? 'pending' : 'flat')];
  return (
    <span className={cx('badge', tone !== 'neutral' && `badge--${tone}`, className)}>
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}
