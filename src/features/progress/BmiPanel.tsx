import { History, Info, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useBmiHistory } from '@/db/hooks';
import { updateProfile } from '@/db/repos/profile';
import { deleteBmi, saveBmi } from '@/db/repos/tracking';
import { formatDate } from '@/domain/dates';
import { BMI_CATEGORIES, bmiCategory, calculateBmi, currentAge } from '@/domain/health';
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
import { useUnits } from '../shared/units';

const SCALE_MIN = 15;
const SCALE_MAX = 40;
const segColors: Record<string, string> = {
  under: 'var(--warn)',
  normal: 'var(--good)',
  over: 'var(--warn)',
  obese1: 'color-mix(in srgb, var(--bad) 70%, var(--warn))',
  obese2: 'var(--bad)',
  obese3: 'color-mix(in srgb, var(--bad) 80%, #000)',
};

export function BmiPanel({ profile, weights }: { profile: Profile; weights: WeightEntry[] }) {
  const u = useUnits(profile.units);
  const today = useToday();
  const history = useBmiHistory();
  const latest = weights[weights.length - 1];
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
  const cat = bmi !== null ? bmiCategory(bmi, age) : null;
  const pos = bmi !== null ? ((Math.min(Math.max(bmi, SCALE_MIN), SCALE_MAX) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100 : 0;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await saveBmi(kg!, cm!);
      if (cm !== profile.heightCm) await updateProfile({ heightCm: cm! });
      toast('Cálculo de IMC guardado');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="split">
      <GlassCard variant="strong" aria-labelledby="bmi-title">
        <h2 id="bmi-title" className="card__title" style={{ marginBottom: 16 }}>
          Índice de masa corporal
        </h2>
        <div className="grid-2">
          <NumberField label="Peso" value={w} onChange={(e) => setW(e.target.value)} suffix={u.w} error={wErr} />
          <NumberField label="Altura" value={h} onChange={(e) => setH(e.target.value)} suffix={u.h} error={hErr} />
        </div>

        <div aria-live="polite" style={{ marginTop: 24 }}>
          {bmi === null ? (
            <p className="t-small">Introduce tu peso y altura para calcular el IMC.</p>
          ) : (
            <>
              <div className="bmi-result">
                <span className="t-hero">{formatFixed(bmi, 1)}</span>
                <span className="t-small" style={{ marginBottom: 8 }}>
                  kg/m²
                </span>
                {cat && <StatusBadge tone={cat.tone} label={cat.label} className="grow-none" />}
              </div>
              {!minor && (
                <div className="bmi-scale" aria-hidden="true">
                  <div className="bmi-scale__bar">
                    {BMI_CATEGORIES.map((c) => {
                      const a = Math.max(c.min, SCALE_MIN);
                      const b = Math.min(c.max, SCALE_MAX);
                      return <span key={c.id} className="bmi-scale__seg" style={{ flex: b - a, background: segColors[c.id] }} />;
                    })}
                  </div>
                  <span className="bmi-scale__marker" style={{ left: `${pos}%` }} />
                  <div className="bmi-scale__labels">
                    <span>15</span>
                    <span>18,5</span>
                    <span>25</span>
                    <span>30</span>
                    <span>35</span>
                    <span>40</span>
                  </div>
                </div>
              )}
              <p className="t-body" style={{ marginTop: 12 }}>
                {minor
                  ? 'En menores de 18 años el IMC se interpreta con tablas de percentiles según edad y sexo, por lo que no aplicamos los rangos de adultos.'
                  : cat?.description}
              </p>
              <p className="t-small t-muted" style={{ marginTop: 6 }}>
                Fórmula: peso (kg) ÷ altura (m)². Cálculo del {formatDate.long(today)}.
              </p>
            </>
          )}
        </div>
        <div className="callout" style={{ marginTop: 16 }}>
          <Info aria-hidden="true" />
          <p>
            El IMC es una herramienta orientativa, no un diagnóstico: no distingue entre grasa y masa muscular ni describe por sí solo tu estado de salud.
          </p>
        </div>
        <Button block icon={<Save />} onClick={save} disabled={!valid} loading={saving} style={{ marginTop: 16 }}>
          Guardar en el historial
        </Button>
      </GlassCard>

      <GlassCard aria-labelledby="bmi-hist">
        <h2 id="bmi-hist" className="card__title" style={{ marginBottom: 8 }}>
          <History aria-hidden="true" />
          Historial de IMC
        </h2>
        {!history?.length ? (
          <p className="t-small">Los cálculos que guardes aparecerán aquí con su fecha.</p>
        ) : (
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
        )}
      </GlassCard>
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
    </div>
  );
}
