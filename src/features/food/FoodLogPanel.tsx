import { Barcode, Camera, ChevronDown, ChevronLeft, ChevronRight, PencilLine, ScanLine, Trash2, UtensilsCrossed } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMealsDay, useWeights } from '@/db/hooks';
import { deleteMeal, restoreMeal } from '@/db/repos/meals';
import { energyEstimate } from '@/domain/body';
import { addDays, formatDate, todayKey } from '@/domain/dates';
import { MEAL_TYPES, mealLabel, sourceLabel } from '@/domain/nutrition/meals';
import { kcalToKj, mealTotals } from '@/domain/nutrition/nutrients';
import type { MealEntry, Profile } from '@/domain/types';
import { formatInt, formatNumber } from '@/domain/units';
import { AnimatedNumber } from '@/ui/AnimatedNumber';
import { ButtonLink, IconButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { GlassCard } from '@/ui/GlassCard';
import { ProgressBar } from '@/ui/ProgressBar';
import { toast } from '@/ui/toast';
import { useToday } from '@/ui/useToday';
import './food.css';

const ORIGIN_ICON = { photo: Camera, barcode: Barcode, manual: PencilLine } as const;
const ORIGIN_LABEL = { photo: 'Foto', barcode: 'Código de barras', manual: 'A mano' } as const;

/** Hábitos › Comidas: what was logged each day, by meal, with totals. */
export function FoodLogPanel({ profile }: { profile: Profile }) {
  const today = useToday();
  const [date, setDate] = useState(today);
  const meals = useMealsDay(date);
  const weights = useWeights();
  const [open, setOpen] = useState<Set<number>>(new Set());

  const day = useMemo(() => {
    const entries = meals ?? [];
    const { total, missing } = mealTotals(entries.flatMap((m) => m.items));
    const estimated = entries.some((m) => m.items.some((i) => i.estimated));
    return { entries, total, missing, estimated };
  }, [meals]);

  const reference = useMemo(() => {
    if ((profile.healthFlags ?? []).includes('eating_disorder')) return { kind: 'hidden' as const };
    if (!weights) return null;
    const est = energyEstimate(profile, weights, today);
    if (est.status === 'missing') return { kind: 'missing' as const };
    if (!est.target) return { kind: 'restricted' as const };
    return { kind: 'target' as const, kcal: est.target.kcal, label: est.target.label };
  }, [profile, weights, today]);

  const scanQuery = date === today ? '' : `fecha=${date}`;
  const scanLink = (extra = '') => `/habitos/escaner${[extra, scanQuery].filter(Boolean).length ? `?${[extra, scanQuery].filter(Boolean).join('&')}` : ''}`;

  const remove = async (entry: MealEntry) => {
    await deleteMeal(entry.id!);
    toast(`«${entry.name}» eliminado`, { tone: 'info', action: { label: 'Deshacer', onClick: () => void restoreMeal(entry) } });
  };

  const toggle = (id: number) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const a = day.estimated ? '≈ ' : '';

  return (
    <div className="split">
      <div className="vstack">
        <GlassCard variant="glow" aria-labelledby="food-day-title">
          <h2 id="food-day-title" className="sr-only">
            Comidas del día
          </h2>
          <div className="day-nav">
            <IconButton label="Día anterior" size="sm" onClick={() => setDate((d) => addDays(d, -1))}>
              <ChevronLeft />
            </IconButton>
            <span className="day-nav__label" aria-live="polite">
              {formatDate.relative(date, today)} · {formatDate.dayMonth(date)}
            </span>
            <IconButton label="Día siguiente" size="sm" onClick={() => setDate((d) => addDays(d, 1))} disabled={date >= todayKey()}>
              <ChevronRight />
            </IconButton>
          </div>

          <div className="food-total">
            <p className="food-total__kcal t-num">
              {a}
              <AnimatedNumber value={day.total.kcal} format={formatInt} />
              <small> kcal</small>
            </p>
            <p className="t-small t-num">{formatInt(kcalToKj(day.total.kcal))} kJ</p>
            {reference?.kind === 'target' && (
              <div className="food-total__ref">
                <ProgressBar value={day.total.kcal / reference.kcal} label="Energía registrada respecto a tu referencia diaria" />
                <p className="t-small">
                  {day.total.kcal > 0 ? `El ${Math.round((day.total.kcal / reference.kcal) * 100)} % de ` : 'Referencia: '}
                  ~{formatInt(reference.kcal)} kcal al día ({reference.label.toLowerCase()})
                </p>
              </div>
            )}
            {reference?.kind === 'missing' && (
              <p className="t-small">
                <Link to="/perfil" className="link-btn">
                  Completa tu peso, altura y edad
                </Link>{' '}
                para ver una referencia diaria.
              </p>
            )}
            {reference?.kind === 'restricted' && <p className="t-small">En tu caso no mostramos una referencia de calorías: un profesional sanitario puede darte una pauta adaptada.</p>}
            {reference?.kind === 'hidden' && <p className="t-small">Por lo que nos contaste, RUMBO no compara lo que comes con objetivos de calorías.</p>}
          </div>

          <div className="food-macros">
            {(
              [
                ['protein', 'Proteína'],
                ['carbs', 'Hidratos'],
                ['fat', 'Grasa'],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className={`food-macro tile--${k}`}>
                <span className="tile__label">
                  <span className="tile__dot" aria-hidden="true" />
                  {label}
                </span>
                <strong className="t-num">
                  {a}
                  {formatNumber(day.total[k], 0)} g
                </strong>
              </div>
            ))}
          </div>

          <div className="food-actions">
            <ButtonLink to={scanLink()} icon={<ScanLine />} block>
              Escanear comida
            </ButtonLink>
            <div className="food-actions__row">
              <ButtonLink to={scanLink('modo=codigo')} variant="secondary" icon={<Barcode />}>
                Código
              </ButtonLink>
              <ButtonLink to={scanLink('modo=manual')} variant="secondary" icon={<PencilLine />}>
                A mano
              </ButtonLink>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="vstack">
        <GlassCard aria-labelledby="food-log-title">
          <div className="card__head">
            <h3 id="food-log-title" className="card__title">
              <UtensilsCrossed aria-hidden="true" /> Registro del día
            </h3>
            {day.entries.length > 0 && <span className="t-small">{day.entries.length === 1 ? '1 comida' : `${day.entries.length} comidas`}</span>}
          </div>
          {!day.entries.length ? (
            <EmptyState
              icon={<UtensilsCrossed />}
              title={date === today ? 'Aún no has registrado comidas hoy' : 'Sin comidas este día'}
              text="Escanea tu plato o el código de barras, o añade los alimentos a mano."
            />
          ) : (
            <div className="meal-groups">
              {MEAL_TYPES.map(({ id }) => {
                const group = day.entries.filter((m) => m.meal === id);
                if (!group.length) return null;
                const sub = mealTotals(group.flatMap((m) => m.items)).total.kcal;
                const approx = group.some((m) => m.items.some((i) => i.estimated)) ? '≈ ' : '';
                return (
                  <section key={id} className="meal-group" aria-label={mealLabel(id)}>
                    <h4 className="meal-group__head">
                      <span>{mealLabel(id)}</span>
                      <span className="t-num">
                        {approx}
                        {formatInt(sub)} kcal
                      </span>
                    </h4>
                    <ul className="meal-list">
                      <AnimatePresence initial={false}>
                        {group.map((m) => (
                          <MealRow key={m.id} entry={m} expanded={open.has(m.id!)} onToggle={() => toggle(m.id!)} onRemove={() => void remove(m)} />
                        ))}
                      </AnimatePresence>
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
          {day.entries.length > 0 && (
            <p className="t-small food-log__note">
              {day.estimated ? 'Los valores con ≈ incluyen cantidades estimadas a partir de fotos. ' : ''}Valores orientativos de USDA FoodData Central y Open Food Facts.
            </p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function MealRow({ entry, expanded, onToggle, onRemove }: { entry: MealEntry; expanded: boolean; onToggle: () => void; onRemove: () => void }) {
  const Icon = ORIGIN_ICON[entry.origin];
  const { total } = mealTotals(entry.items);
  const approx = entry.items.some((i) => i.estimated) ? '≈ ' : '';
  const detailsId = `meal-${entry.id}-items`;
  return (
    <motion.li className="meal-row" layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}>
      <div className="meal-row__main">
        <span className="icon-tile icon-tile--accent" title={ORIGIN_LABEL[entry.origin]}>
          <Icon aria-hidden="true" />
        </span>
        <button type="button" className="meal-row__toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={onToggle}>
          <span className="meal-row__text">
            <strong>{entry.name}</strong>
            <span className="t-small">
              {entry.time} · {entry.items.length === 1 ? '1 alimento' : `${entry.items.length} alimentos`} · {ORIGIN_LABEL[entry.origin]}
            </span>
          </span>
          <span className="meal-row__kcal t-num">
            {approx}
            {formatInt(total.kcal)} kcal
          </span>
          <ChevronDown className="meal-row__chev" aria-hidden="true" />
        </button>
        <IconButton label={`Eliminar ${entry.name}`} size="sm" tone="plain" onClick={onRemove}>
          <Trash2 />
        </IconButton>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            id={detailsId}
            className="meal-row__items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {entry.items.map((it, i) => (
              <li key={i}>
                <span className="grow">
                  {it.name}
                  <span className="t-small">
                    {' '}
                    · {it.estimated ? '≈ ' : ''}
                    {it.grams !== undefined ? `${formatInt(it.grams)} ${it.unit ?? 'g'}` : ''}
                  </span>
                  <span className="meal-row__source">{sourceLabel(it.source)}</span>
                </span>
                <span className="t-num t-small">
                  {formatInt(it.nutrients.kcal)} kcal · P {formatNumber(it.nutrients.protein, 0)} · H {formatNumber(it.nutrients.carbs, 0)} · G {formatNumber(it.nutrients.fat, 0)}
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
