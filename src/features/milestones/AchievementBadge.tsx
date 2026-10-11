import { Lock } from 'lucide-react';
import type { AchievementIcon, Rarity } from '@/domain/achievements/catalog';
import { ACHIEVEMENT_ICONS, RARITY_COLORS } from './icons';

interface Props {
  icon: AchievementIcon;
  rarity: Rarity;
  unlocked: boolean;
  size?: number;
}

/** Faceted glass medallion; locked medallions are a dark silhouette with a lock. */
export function AchievementBadge({ icon, rarity, unlocked, size = 56 }: Props) {
  const Icon = ACHIEVEMENT_ICONS[icon];
  const c = RARITY_COLORS[rarity];
  return (
    <span
      className="medal"
      data-unlocked={unlocked}
      style={
        {
          width: size,
          height: size,
          '--medal-from': c.from,
          '--medal-to': c.to,
          '--medal-glow': c.glow,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <Icon style={{ width: size * 0.42, height: size * 0.42 }} />
      {!unlocked && (
        <span className="medal__lock">
          <Lock />
        </span>
      )}
    </span>
  );
}
