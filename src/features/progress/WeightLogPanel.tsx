import { ChevronRight, ListChecks, Plus, StickyNote } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDate, monthKey } from '@/domain/dates';
import type { Profile, WeightEntry } from '@/domain/types';
import { formatSigned, kgToDisplay } from '@/domain/units';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { GlassCard } from '@/ui/GlassCard';
import { WeightSheet } from '../shared/sheets/WeightSheet';
import { useUnits } from '../shared/units';

export function WeightLogPanel({ profile, weights }: { profile: Profile; weights: WeightEntry[] }) {
  const u = useUnits(profile.units);
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const [adding, setAdding] = useState(false);

  const groups = useMemo(() => {
    const out = new Map<string, { entry: WeightEntry; delta: number | null }[]>();
    weights.forEach((entry, i) => {
      const prev = i > 0 ? weights[i - 1]! : null;
      const k = monthKey(entry.date);
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push({ entry, delta: prev ? entry.kg - prev.kg : null });
    });
    return [...out.entries()].reverse().map(([k, rows]) => [k, rows.reverse()] as const);
  }, [weights]);

  return (
    <GlassCard aria-labelledby="log-title">
      <div className="card__head">
        <h2 id="log-title" className="card__title">
          <ListChecks aria-hidden="true" />
          Historial de pesajes
        </h2>
        <Button size="sm" icon={<Plus />} onClick={() => setAdding(true)}>
          Añadir
        </Button>
      </div>
      {weights.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="Sin registros todavía" text="Cada pesaje que guardes aparecerá aquí, ordenado por fecha. Podrás corregirlo o eliminarlo." />
      ) : (
        groups.map(([month, rows]) => (
          <section key={month} className="month-group" aria-label={formatDate.monthYear(`${month}-01`)}>
            <h3 className="t-eyebrow" style={{ marginBottom: 6 }}>
              {formatDate.monthYear(`${month}-01`)} · {rows.length} {rows.length === 1 ? 'registro' : 'registros'}
            </h3>
            <ul>
              {rows.map(({ entry, delta }) => (
                <li key={entry.id}>
                  <button type="button" className="log-row" onClick={() => setEditing(entry)} aria-label={`Editar registro del ${formatDate.long(entry.date)}: ${u.weight(entry.kg)}`}>
                    <span className="log-row__date" aria-hidden="true">
                      <span className="log-row__day">{Number(entry.date.slice(8))}</span>
                      <span className="log-row__wd">{formatDate.weekdayShort(entry.date)}</span>
                    </span>
                    <span className="grow">
                      <span className="log-row__kg">{u.weight(entry.kg)}</span>
                      <span className="list-row__sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {entry.time ?? 'Sin hora'}
                        {entry.note && (
                          <>
                            <StickyNote aria-hidden="true" style={{ width: 13, height: 13 }} />
                            <span className="truncate">{entry.note}</span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="log-row__delta">{delta === null ? 'Inicio' : formatSigned(kgToDisplay(delta, profile.units), 1, u.w)}</span>
                    <ChevronRight aria-hidden="true" style={{ width: 16, color: 'var(--text-3)', flex: 'none' }} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <WeightSheet open={adding} onClose={() => setAdding(false)} units={profile.units} lastKg={weights[weights.length - 1]?.kg} />
      <WeightSheet open={editing !== null} onClose={() => setEditing(null)} units={profile.units} entry={editing} />
    </GlassCard>
  );
}
