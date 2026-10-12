import { Calculator, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useBmiHistory } from '@/db/hooks';
import { deleteBmi, saveBmi } from '@/db/repos/tracking';
import { bmiBand, latestWeightUpTo } from '@/domain/body';
import { formatDate } from '@/domain/dates';
import { calculateBmi, currentAge } from '@/domain/health';
import type { Profile, WeightEntry } from '@/domain/types';
import { formatFixed } from '@/domain/units';
import { checkRange, LIMITS } from '@/domain/validation';
import { Button, IconButton } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { NumberField } from '@/ui/Field';
import { GlassCard } from '@/ui/GlassCard';
import { StatusBadge } from '@/ui/StatusBadge';
import { toast, toastError } from '@/ui/toast';
import { useToday } from '@/ui/useToday';
import { BmiCard } from '../body/BmiCard';
import { BmiTrendCard } from '../body/BmiTrend';
import { useUnits } from '../shared/units';

/** Progresos › IMC: the automatic card and its evolution lead; the manual calculator is secondary. */
export function BmiPanel({ profile, weights }: { profile: Profile; weights: WeightEntry[] }) {
  return (
    <div className="split">
      <div className="vstack">
        <BmiCard profile={profile} weights={weights} />
        <BmiTrendCard profile={profile} weights={weights} />
      </div>
      <div className="vstack">
        <ManualBmi profile={profile} weights={weights} />
      </div>
    </div>
  );
}

/** What-if calculator: never changes the profile; results can be kept in a history. */
function ManualBmi({ profile, weights }: { profile: Profile; weights: WeightEntry[] }) {
  const u = useUnits(profile.units);
  const today = useToday();
  const history = useBmiHistory();
  const latest = latestWeightUpTo(weights, today);
  const [w, setW] = useState(u.weightToInput(latest?.kg));
  const [h, setH] = useState(u.heightToInput(profile.heightCm));
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<number | null>(null);

  const kg = u.parseWeight(w);
  const cm = u.parseHeight(h);
  const wErr = w ? checkRange(kg, LIMITS.weightKg) : null;
  const hErr = h ? checkRange(cm, LIMITS.heightCm) : null;
  const valid = kg !== null && cm !== null && !wErr && !hErr;
  const bmi = valid ? calculateBmi(kg!, cm!) : null;
  const age = currentAge(profile.age, profile.ageRecordedOn, today);
  const minor = age !== undefined && age < 18;
  // Same rule as the automatic card: no adult categories for minors or during pregnancy / breastfeeding.
  const pregnancy = profile.healthFlags?.includes('pregnancy') ?? false;
  const band = bmi !== null && !minor && !pregnancy ? bmiBand(bmi) : null;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await saveBmi(kg!, cm!);
      toast('Cálculo de IMC guardado');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard aria-labelledby="bmi-manual-title">
      <h2 id="bmi-manual-title" className="card__title">
        <Calculator aria-hidden="true" />
        Calculadora manual
      </h2>
      <p className="t-small" style={{ margin: '4px 0 16px' }}>
        Prueba con otros valores. No cambia tu perfil ni tus registros.
      </p>
      <div className="grid-2">
        <NumberField label="Peso" value={w} onChange={(e) => setW(e.target.value)} suffix={u.w} error={wErr} />
        <NumberField label="Altura" value={h} onChange={(e) => setH(e.target.value)} suffix={u.h} error={hErr} />
      </div>

      <div className="bmi-manual__result" aria-live="polite">
        {bmi === null ? (
          <p className="t-small">Introduce un peso y una altura para calcular el IMC.</p>
        ) : (
          <>
            <span className="bmi-manual__value t-num">
              {formatFixed(bmi, 1)}
              <small>kg/m²</small>
            </span>
            {band ? (
              <StatusBadge tone={band.tone} label={band.label} icon={band.id === 'normal' ? 'check' : 'alert'} />
            ) : (
              <span className="t-small">{minor ? 'Sin categorías de adultos (menor de 18 años)' : 'Sin categorías durante el embarazo o la lactancia'}</span>
            )}
          </>
        )}
      </div>
      <p className="field__hint">Fórmula: peso (kg) ÷ altura (m)².</p>
      <Button block variant="secondary" icon={<Save />} onClick={save} disabled={!valid} loading={saving} style={{ marginTop: 16 }}>
        Guardar en el historial
      </Button>

      {!!history?.length && (
        <>
          <hr className="divider" style={{ marginTop: 20 }} />
          <h3 className="bmi-manual__subtitle">Cálculos guardados</h3>
          <ul className="list">
            {history.map((r) => (
              <li key={r.id} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title t-num">{formatFixed(r.bmi, 1)}</div>
                  <div className="list-row__sub">
                    {formatDate.long(r.date)} · {u.weight(r.kg)} · {u.height(r.heightCm)}
                  </div>
                </div>
                <IconButton label="Eliminar cálculo" size="sm" tone="plain" onClick={() => setToDelete(r.id!)}>
                  <Trash2 />
                </IconButton>
              </li>
            ))}
          </ul>
        </>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="¿Eliminar este cálculo?"
        message="Se eliminará del historial de IMC."
        onConfirm={async () => {
          await deleteBmi(toDelete!);
          toast('Cálculo eliminado');
        }}
      />
    </GlassCard>
  );
}
