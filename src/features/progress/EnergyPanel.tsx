import { Flame, Info, Save, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useEnergyHistory } from '@/db/hooks';
import { updateProfile } from '@/db/repos/profile';
import { saveEnergy } from '@/db/repos/tracking';
import { formatDate } from '@/domain/dates';
import { ACTIVITY_LEVELS, calculateEnergy, calculateMacros, currentAge, mifflinStJeor } from '@/domain/health';
import type { ActivityLevel, GoalType, HealthFlag, Profile, Sex, WeightEntry } from '@/domain/types';
import { formatInt, formatNumber } from '@/domain/units';
import { checkRange, LIMITS } from '@/domain/validation';
import { Button } from '@/ui/Button';
import { NumberField, SelectField } from '@/ui/Field';
import { GlassCard } from '@/ui/GlassCard';
import { Segmented } from '@/ui/Segmented';
import { toast, toastError } from '@/ui/toast';
import { useToday } from '@/ui/useToday';
import { GOALS, SEX_OPTIONS } from '../shared/labels';
import { useUnits } from '../shared/units';

const FLAGS: { id: HealthFlag; label: string }[] = [
  { id: 'pregnancy', label: 'Embarazo o lactancia' },
  { id: 'eating_disorder', label: 'Antecedentes de trastornos de la conducta alimentaria' },
  { id: 'medical_condition', label: 'Una condición médica que requiere supervisión (diabetes, enfermedad renal, etc.)' },
];

const MACRO_COLORS = { protein: 'var(--accent)', fat: 'var(--series-steps)', carbs: 'var(--series-water)' };

export function EnergyPanel({ profile, weights }: { profile: Profile; weights: WeightEntry[] }) {
  const u = useUnits(profile.units);
  const today = useToday();
  const history = useEnergyHistory();
  const latest = weights[weights.length - 1];
  const [w, setW] = useState(u.weightToInput(latest?.kg));
  const [h, setH] = useState(u.heightToInput(profile.heightCm));
  const [age, setAge] = useState(String(currentAge(profile.age, profile.ageRecordedOn, today) ?? ''));
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [activity, setActivity] = useState<ActivityLevel>(profile.activityLevel);
  const [goal, setGoal] = useState<GoalType>(profile.goal);
  const [flags, setFlags] = useState<HealthFlag[]>(profile.healthFlags ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [protein, setProtein] = useState('1.6');
  const [fat, setFat] = useState('30');
  const [saving, setSaving] = useState(false);

  const kg = u.parseWeight(w);
  const cm = u.parseHeight(h);
  const ageN = age ? Number(age) : null;
  const errs = {
    w: w ? checkRange(kg, LIMITS.weightKg) : null,
    h: h ? checkRange(cm, LIMITS.heightCm) : null,
    a: age ? checkRange(ageN, LIMITS.age) : null,
  };
  const valid = kg !== null && cm !== null && ageN !== null && !errs.w && !errs.h && !errs.a;
  const result = valid ? calculateEnergy({ kg: kg!, heightCm: cm!, age: ageN!, sex, activityLevel: activity, goal, healthFlags: flags }) : null;
  const target = result ? (result.targets.find((t) => t.id === selected) ?? result.targets.find((t) => t.recommended) ?? result.targets[0]!) : null;
  const macros = result && target && kg ? calculateMacros(target.kcal, kg, Number(protein), Number(fat)) : null;
  const sexConst = sex === 'male' ? '+ 5' : sex === 'female' ? '− 161' : '− 78';
  const last = history?.[0];

  const toggleFlag = async (f: HealthFlag) => {
    const next = flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f];
    setFlags(next);
    try {
      await updateProfile({ healthFlags: next });
    } catch (e) {
      toastError(e);
    }
  };

  const save = async () => {
    if (!result || !valid) return;
    setSaving(true);
    try {
      await saveEnergy({ kg: kg!, heightCm: cm!, age: ageN!, sex, activityLevel: activity, goal, healthFlags: flags }, target?.kcal);
      toast('Estimación guardada');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="split">
      <div className="vstack">
        <GlassCard variant="strong" aria-labelledby="kcal-title">
          <h2 id="kcal-title" className="card__title" style={{ marginBottom: 16 }}>
            <Flame aria-hidden="true" />
            Tus datos
          </h2>
          <div className="vstack">
            <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))' }}>
              <NumberField label="Peso" value={w} onChange={(e) => setW(e.target.value)} suffix={u.w} error={errs.w} />
              <NumberField label="Altura" value={h} onChange={(e) => setH(e.target.value)} suffix={u.h} error={errs.h} />
              <NumberField label="Edad" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} decimals={false} suffix="años" error={errs.a} />
            </div>
            <div className="field">
              <span className="field__label">Sexo biológico (para la ecuación)</span>
              <Segmented label="Sexo biológico" options={SEX_OPTIONS} value={sex} onChange={setSex} block />
            </div>
            <SelectField
              label="Nivel de actividad (incluye tu entrenamiento habitual)"
              value={activity}
              onChange={(e) => setActivity(e.target.value as ActivityLevel)}
              options={(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((k) => ({
                value: k,
                label: `${ACTIVITY_LEVELS[k].label} · ${ACTIVITY_LEVELS[k].description}`,
              }))}
            />
            <SelectField label="Objetivo" value={goal} onChange={(e) => setGoal(e.target.value as GoalType)} options={GOALS.map((g) => ({ value: g.id, label: g.label }))} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field__label" style={{ marginBottom: 4 }}>
                Situaciones especiales
              </legend>
              {FLAGS.map((f) => (
                <label key={f.id} className="check-row">
                  <input type="checkbox" checked={flags.includes(f.id)} onChange={() => void toggleFlag(f.id)} />
                  {f.label}
                </label>
              ))}
              <p className="field__hint">Se guarda en tu perfil para no mostrarte objetivos que no serían adecuados.</p>
            </fieldset>
          </div>
        </GlassCard>
      </div>

      <div className="vstack" aria-live="polite">
        {!result ? (
          <GlassCard>
            <p className="t-body">Completa peso, altura y edad para estimar tu gasto energético.</p>
          </GlassCard>
        ) : (
          <>
            <GlassCard variant="glow" aria-labelledby="kcal-res">
              <h2 id="kcal-res" className="sr-only">
                Resultado
              </h2>
              <div className="energy-grid">
                <div className="stat">
                  <span className="stat__label">Metabolismo basal</span>
                  <span className="stat__value" style={{ fontSize: 'var(--text-2xl)' }}>
                    {formatInt(result.bmr)}
                    <small>kcal</small>
                  </span>
                  <span className="t-small">En reposo absoluto</span>
                </div>
                <div className="stat">
                  <span className="stat__label">Gasto diario total</span>
                  <span className="stat__value" style={{ fontSize: 'var(--text-2xl)' }}>
                    {formatInt(result.tdee)}
                    <small>kcal</small>
                  </span>
                  <span className="t-small">Con tu nivel de actividad</span>
                </div>
              </div>
            </GlassCard>

            {result.restrictions.length > 0 && (
              <div className="callout callout--warn" role="note">
                <ShieldAlert aria-hidden="true" />
                <div>
                  {result.restrictions.map((r) => (
                    <p key={r}>{r}</p>
                  ))}
                </div>
              </div>
            )}

            <GlassCard aria-labelledby="kcal-targets">
              <h3 id="kcal-targets" className="card__title" style={{ marginBottom: 12 }}>
                Objetivo calórico orientativo
              </h3>
              <div className="energy-grid">
                {result.targets.map((t) => (
                  <button key={t.id} type="button" className="energy-target" aria-pressed={target?.id === t.id} onClick={() => setSelected(t.id)}>
                    <span className="t-small" style={{ fontWeight: 640, color: 'var(--text)' }}>
                      {t.label} {t.recommended && <span className="badge badge--accent" style={{ height: 20, marginLeft: 4 }}>Sugerido</span>}
                    </span>
                    <span className="energy-target__kcal">
                      {formatInt(t.kcal)}
                      <small>kcal</small>
                    </span>
                    <span className="t-small">{t.description}</span>
                  </button>
                ))}
              </div>

              {macros && target && (
                <div style={{ marginTop: 20 }}>
                  <h4 className="card__title" style={{ marginBottom: 10 }}>
                    Macronutrientes (opcional)
                  </h4>
                  <div className="grid-2">
                    <div className="field">
                      <span className="field__label">Proteína por kg</span>
                      <Segmented
                        label="Proteína por kilo de peso"
                        options={['1.2', '1.6', '2.0'].map((v) => ({ value: v, label: `${v.replace('.', ',')} g` }))}
                        value={protein}
                        onChange={setProtein}
                        block
                      />
                    </div>
                    <div className="field">
                      <span className="field__label">Grasas</span>
                      <Segmented label="Porcentaje de grasas" options={['25', '30', '35'].map((v) => ({ value: v, label: `${v} %` }))} value={fat} onChange={setFat} block />
                    </div>
                  </div>
                  <div className="macro-bar" aria-hidden="true">
                    <span style={{ flex: macros.proteinKcal, background: MACRO_COLORS.protein }} />
                    <span style={{ flex: macros.fatKcal, background: MACRO_COLORS.fat }} />
                    <span style={{ flex: Math.max(macros.carbsKcal, 1), background: MACRO_COLORS.carbs }} />
                  </div>
                  <div className="macro-legend">
                    {(
                      [
                        ['Proteína', macros.proteinG, macros.proteinKcal, MACRO_COLORS.protein],
                        ['Grasas', macros.fatG, macros.fatKcal, MACRO_COLORS.fat],
                        ['Carbohidratos', macros.carbsG, macros.carbsKcal, MACRO_COLORS.carbs],
                      ] as const
                    ).map(([label, g, kcal, color]) => (
                      <div key={label} className="macro-legend__item">
                        <span className="macro-legend__swatch" style={{ background: color }} aria-hidden="true" />
                        <span>
                          <span style={{ display: 'block', fontWeight: 700 }}>{g} g</span>
                          <span className="t-small">
                            {label} · {formatInt(kcal)} kcal
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {!macros.valid && <p className="field__error" style={{ marginTop: 8 }}>La proteína y las grasas superan las calorías del objetivo. Ajusta la distribución.</p>}
                  <p className="field__hint" style={{ marginTop: 10 }}>
                    Proteína = peso × g/kg (4 kcal/g) · Grasas = % de las calorías (9 kcal/g) · Carbohidratos = resto (4 kcal/g).
                  </p>
                </div>
              )}
            </GlassCard>

            <GlassCard aria-labelledby="kcal-how">
              <h3 id="kcal-how" className="card__title" style={{ marginBottom: 8 }}>
                Cómo se calcula
              </h3>
              <dl className="formula">
                <div>
                  <dt>Metabolismo basal (Mifflin-St Jeor)</dt>
                  <dd>
                    10 × {formatNumber(kg!, 1)} + 6,25 × {formatNumber(cm!, 0)} − 5 × {ageN} {sexConst} = {formatInt(mifflinStJeor(kg!, cm!, ageN!, sex))} kcal
                  </dd>
                </div>
                <div>
                  <dt>Factor de actividad</dt>
                  <dd>
                    × {formatNumber(result.activityFactor, 3)} ({ACTIVITY_LEVELS[activity].label})
                  </dd>
                </div>
                <div>
                  <dt>Gasto energético diario total</dt>
                  <dd>{formatInt(result.tdee)} kcal</dd>
                </div>
                {target && (
                  <div>
                    <dt>Objetivo seleccionado</dt>
                    <dd>
                      {target.label}: {formatInt(target.kcal)} kcal
                    </dd>
                  </div>
                )}
              </dl>
              <ul className="vstack" style={{ gap: 6, marginTop: 14 }}>
                {result.notes.map((n) => (
                  <li key={n} className="t-small" style={{ display: 'flex', gap: 8 }}>
                    <Info aria-hidden="true" style={{ width: 15, height: 15, flex: 'none', marginTop: 2, color: 'var(--text-3)' }} />
                    {n}
                  </li>
                ))}
                <li className="t-small" style={{ display: 'flex', gap: 8 }}>
                  <Info aria-hidden="true" style={{ width: 15, height: 15, flex: 'none', marginTop: 2, color: 'var(--text-3)' }} />
                  RUMBO no registra lo que comes: estas cifras son estimaciones de gasto, no de ingesta.
                </li>
              </ul>
              <Button block icon={<Save />} onClick={save} loading={saving} style={{ marginTop: 16 }}>
                Guardar estimación
              </Button>
              {last && (
                <p className="t-small t-muted" style={{ marginTop: 10, textAlign: 'center' }}>
                  Última guardada el {formatDate.long(last.date)}: {formatInt(last.tdee)} kcal de gasto
                  {last.target ? ` · objetivo ${formatInt(last.target)} kcal` : ''}
                </p>
              )}
            </GlassCard>
          </>
        )}
      </div>
    </div>
  );
}
