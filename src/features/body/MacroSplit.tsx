import type { MacroSplit as Split } from '@/domain/health';
import { formatInt } from '@/domain/units';
import './body.css';

/** Fixed, accent-independent trio: with the accent, protein collided with fat (naranja) or carbohydrates (cian). */
const MACRO_COLORS = { protein: 'var(--series-weight)', fat: 'var(--series-steps)', carbs: 'var(--series-water)' } as const;

/** Stacked bar + legend for a protein / fat / carbohydrate split (grams and kcal always in text). */
export function MacroSplitView({ macros }: { macros: Split }) {
  const rows = [
    ['Proteína', macros.proteinG, macros.proteinKcal, MACRO_COLORS.protein],
    ['Grasas', macros.fatG, macros.fatKcal, MACRO_COLORS.fat],
    ['Carbohidratos', macros.carbsG, macros.carbsKcal, MACRO_COLORS.carbs],
  ] as const;
  return (
    <div className="macro-split">
      <div className="macro-bar" aria-hidden="true">
        <span style={{ flex: macros.proteinKcal, background: MACRO_COLORS.protein }} />
        <span style={{ flex: macros.fatKcal, background: MACRO_COLORS.fat }} />
        <span style={{ flex: Math.max(macros.carbsKcal, 1), background: MACRO_COLORS.carbs }} />
      </div>
      <div className="macro-legend">
        {rows.map(([label, g, kcal, color]) => (
          <div key={label} className="macro-legend__item">
            <span className="macro-legend__swatch" style={{ background: color }} aria-hidden="true" />
            <span>
              <span className="macro-legend__g t-num">{formatInt(g)} g</span>
              <span className="t-small">{label}</span>
              <span className="t-small t-muted t-num">{formatInt(kcal)} kcal</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
