import { Lock } from 'lucide-react';
import type { AchievementIcon, Rarity } from '@/domain/achievements/catalog';
import { ACHIEVEMENT_ICONS, RARITY_COLORS } from './icons';

interface Props {
  icon: AchievementIcon;
  rarity: Rarity;
  unlocked: boolean;
  /** Locked but already under way: tinted with the rarity colour and without the lock. */
  inProgress?: boolean;
  size?: number;
}

/**
 * Faceted glass medallion. Unlocked: full rarity colour. In progress: a quiet
 * tint of the rarity colour. Locked: a dark silhouette with a lock.
 */
export function AchievementBadge({ icon, rarity, unlocked, inProgress = false, size = 56 }: Props) {
  const Icon = ACHIEVEMENT_ICONS[icon];
  const c = RARITY_COLORS[rarity];
  const state = unlocked ? 'unlocked' : inProgress ? 'progress' : 'locked';
  const lock = Math.max(16, Math.min(22, Math.round(size * 0.4)));
  return (
    <span
      className="medal"
      data-unlocked={unlocked}
      data-state={state}
      style={
        {
          width: size,
          height: size,
          '--medal-from': c.from,
          '--medal-to': c.to,
          '--medal-glow': c.glow,
          '--lock-size': `${lock}px`,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <Icon style={{ width: size * 0.42, height: size * 0.42 }} />
      {state === 'locked' && (
        <span className="medal__lock">
          <Lock />
        </span>
      )}
    </span>
  );
}
