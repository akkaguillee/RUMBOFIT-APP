import { ChevronDown, HeartPulse, Info, Save, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEnergyHistory } from '@/db/hooks';
import { updateProfile } from '@/db/repos/profile';
import { applyCalculation } from '@/db/repos/tracking';
import { activityBasis, energyEstimate, guardDeficit, keepUnitsTogether, latestWeightUpTo, macroSplit } from '@/domain/body';
import { formatDate } from '@/domain/dates';
import { ACTIVITY_LEVELS, calculateEnergy, calculateMacros, currentAge, mifflinStJeor } from '@/domain/health';
import type { ActivityLevel, GoalType, HealthFlag, Profile, Sex, WeightEntry } from '@/domain/types';
import { formatInt, formatNumber } from '@/domain/units';
import { checkRange, LIMITS, type Range } from '@/domain/validation';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { NumberField, SelectField } from '@/ui/Field';
import { GlassButtonCard, GlassCard } from '@/ui/GlassCard';
import { Segmented } from '@/ui/Segmented';
import { toast, toastError } from '@/ui/toast';
import { useToday } from '@/ui/useToday';
import { CalorieCard } from '../body/CalorieCard';
import { MacroSplitView } from '../body/MacroSplit';
import { GOALS, SEX_OPTIONS } from '../shared/labels';
import { useUnits } from '../shared/units';

const FLAGS: { id: HealthFlag; label: string }[] = [
  { id: 'pregnancy', label: 'Embarazo o lactancia' },
  { id: 'eating_disorder', label: 'Antecedentes de trastornos de la conducta alimentaria' },
  { id: 'medical_condition', label: 'Una condición médica que requiere supervisión (diabetes, enfermedad renal, etc.)' },
];

const PANEL_ID = 'kcal-adjust-panel';
const TRIGGER_ID = 'kcal-adjust-trigger';

/**
 * Progresos › Calorías: the automatic estimate leads; special situations stay
 * visible because they change what we show; the editable calculator lives
 * behind "Ajustar el cálculo" and, when saved, updates the profile so every
 * screen shows the same numbers.
 */
export function EnergyPanel({ profile, weights }: { profile: Profile; weights: WeightEntry[] }) {
  const [adjust, setAdjust] = useState(false);
  const [settled, setSettled] = useState(false);
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);

  // Opening moves focus into the panel and brings it into view: on phones it
  // opens below the fold, right above the tab bar.
  useEffect(() => {
    if (adjust) panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, [adjust]);

  const close = useCallback(() => {
    setSettled(false);
    setAdjust(false);
    // Back to the button that opened it, once React has removed the panel.
    requestAnimationFrame(() => document.getElementById(TRIGGER_ID)?.focus({ preventScroll: true }));
  }, []);

  return (
    <div className="vstack">
      <div className="split">
        <CalorieCard profile={profile} weights={weights} />
        <div className="vstack">
          <SpecialSituations profile={profile} />
          <GlassButtonCard
            id={TRIGGER_ID}
            className="kcal-adjust"
            aria-expanded={adjust}
            aria-controls={PANEL_ID}
            onClick={() => (adjust ? close() : setAdjust(true))}
          >
            <span className="icon-tile" aria-hidden="true">
              <SlidersHorizontal />
            </span>
            <span className="grow">
              <span className="list-row__title kcal-adjust__title">Ajustar el cálculo</span>
              <span className="list-row__sub kcal-adjust__sub">Corrige tus datos, nivel de actividad u objetivo y actualiza tus calorías.</span>
            </span>
            <ChevronDown aria-hidden="true" className={cx('kcal-adjust__chev', adjust && 'is-open')} />
          </GlassButtonCard>
        </div>
      </div>
      {/* Always in the DOM so aria-controls points at something; empty while closed. */}
      <div id={PANEL_ID} className="kcal-adjust-host">
        <AnimatePresence initial={false}>
          {adjust && (
            <motion.section
              ref={panelRef}
              key="panel"
              className={cx('kcal-adjust-panel', settled && 'is-settled')}
              aria-labelledby="kcal-title"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0.12 : 0.34, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={(def) => {
                // Only the opening animation (the exit one ends at opacity 0).
                if ((def as { opacity?: number }).opacity !== 1) return;
                setSettled(true);
                panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !(e.target instanceof HTMLSelectElement)) {
                  e.stopPropagation();
                  close();
                }
              }}
            >
              <EnergyCalculator profile={profile} weights={weights} onCancel={close} />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SpecialSituations({ profile }: { profile: Profile }) {
  const flags = profile.healthFlags ?? [];
  const toggle = async (f: HealthFlag) => {
    try {
      await updateProfile({ healthFlags: flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f] });
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <GlassCard aria-labelledby="kcal-flags-title">
      <h2 id="kcal-flags-title" className="card__title">
        <HeartPulse aria-hidden="true" />
        Situaciones especiales
      </h2>
      <p className="t-small" style={{ margin: '4px 0 6px' }}>
        Si alguna te aplica, solo mostramos el mantenimiento y no calculamos objetivos de pérdida ni de ganancia.
      </p>
      <fieldset className="kcal-flags">
        <legend className="sr-only">Situaciones especiales</legend>
        {FLAGS.map((f) => (
          <label key={f.id} className="check-row">
            <input type="checkbox" checked={flags.includes(f.id)} onChange={() => void toggle(f.id)} />
            {f.label}
          </label>
        ))}
      </fieldset>
      <p className="field__hint">Se guarda en tu perfil, solo en este dispositivo.</p>
    </GlassCard>
  );
}

type FieldKey = 'w' | 'h' | 'age';

/** Error for a number typed by the user: empty, not a number, negative or out of range. */
function numberError(raw: string, parsed: number | null, range: Range): string | null {
  if (!raw.trim()) return checkRange(null, range);
  if (parsed === null) return `${range.label} debe ser un número, por ejemplo ${range === LIMITS.age ? '34' : '72,5'}.`;
  if (parsed < 0) return `${range.label} no puede ser negativo.`;
  return checkRange(parsed, range);
}

const sameNumber = (a: number | null | undefined, b: number | null | undefined, tolerance: number) =>
  a === null || a === undefined || b === null || b === undefined ? (a ?? null) === (b ?? null) : Math.abs(a - b) < tolerance;

/**
 * Editable calculator. Saving writes the data to the profile (and a new weight
 * as today's weight), so the calorie card, tips and the rest of the app agree.
 */
function EnergyCalculator({ profile, weights, onCancel }: { profile: Profile; weights: WeightEntry[]; onCancel: () => void }) {
  const u = useUnits(profile.units);
  const today = useToday();
  const history = useEnergyHistory();
  const latest = latestWeightUpTo(weights, today);
  const flags = profile.healthFlags ?? [];
  const plan = macroSplit(profile);
  const savedAge = currentAge(profile.age, profile.ageRecordedOn, today);
  const savedTarget = useMemo(() => {
    const est = energyEstimate(profile, weights, today);
    return est.status === 'ok' ? (est.target?.id ?? 'maintain') : null;
  }, [profile, weights, today]);

  // What is saved now; the form starts from it and "dirty" is measured against it.
  const base = {
    w: u.weightToInput(latest?.kg),
    h: u.heightToInput(profile.heightCm),
    age: savedAge === undefined ? '' : String(savedAge),
    sex: profile.sex,
    activity: activityBasis(profile).level,
    goal: profile.goal,
    protein: String(plan.proteinPerKg),
    fat: String(plan.fatPct),
  };
  const [w, setW] = useState(base.w);
  const [h, setH] = useState(base.h);
  const [age, setAge] = useState(base.age);
  const [sex, setSex] = useState<Sex>(base.sex);
  const [activity, setActivity] = useState<ActivityLevel>(base.activity);
  const [goal, setGoal] = useState<GoalType>(base.goal);
  const [selected, setSelected] = useState<string | null>(savedTarget);
  const [protein, setProtein] = useState(base.protein);
  const [fat, setFat] = useState(base.fat);
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({ w: false, h: false, age: false });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const savingRef = useRef(false);

  // Untouched fields keep the exact stored value (display rounding must not count as a change).
  const kg = w === base.w && latest ? latest.kg : u.parseWeight(w);
  const cm = h === base.h && profile.heightCm ? profile.heightCm : u.parseHeight(h);
  const ageN = age ? Number(age) : null;
  const errs: Record<FieldKey, string | null> = {
    w: numberError(w, kg, LIMITS.weightKg),
    h: numberError(h, cm, LIMITS.heightCm),
    age: numberError(age, ageN, LIMITS.age),
  };
  const shown = (k: FieldKey) => (touched[k] || submitted ? errs[k] : null);
  const valid = !errs.w && !errs.h && !errs.age;
  const raw = valid ? calculateEnergy({ kg: kg!, heightCm: cm!, age: ageN!, sex, activityLevel: activity, goal, healthFlags: flags }) : null;
  const result = raw ? { ...raw, ...guardDeficit(raw, kg!, cm!, ageN!) } : null;
  const target = result ? (result.targets.find((t) => t.id === selected) ?? result.targets.find((t) => t.recommended) ?? result.targets[0]!) : null;
  const macros = result && target && kg ? calculateMacros(target.kcal, kg, Number(protein), Number(fat)) : null;
  const sexConst = sex === 'male' ? '+ 5' : sex === 'female' ? '− 161' : '− 78';
  const last = history?.[0];

  const dirty =
    !sameNumber(kg, latest?.kg, 0.01) ||
    !sameNumber(cm, profile.heightCm, 0.05) ||
    ageN !== (savedAge ?? null) ||
    sex !== base.sex ||
    activity !== base.activity ||
    goal !== base.goal ||
    protein !== base.protein ||
    fat !== base.fat ||
    (target !== null && target.id !== savedTarget);

  const edit = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setSavedMsg(null);
  };

  const save = async () => {
    if (savingRef.current) return; // double taps / Enter while saving
    setSubmitted(true);
    if (!valid || !result) {
      const first = (['w', 'h', 'age'] as FieldKey[]).find((k) => errs[k]);
      // After the errors render, so the field is announced with its message.
      if (first) requestAnimationFrame(() => document.getElementById(`kcal-${first}`)?.focus());
      return;
    }
    if (!dirty) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await applyCalculation({
        kg: kg!,
        heightCm: cm!,
        age: ageN!,
        sex,
        activityLevel: activity,
        goal,
        targetId: target?.id,
        proteinPerKg: Number(protein),
        fatPct: Number(fat),
      });
      const kcal = target ? formatInt(target.kcal) : formatInt(result.maintenance);
      setSavedMsg(`Guardado. Tus calorías diarias ahora son ${kcal} kcal.`);
      setSubmitted(false);
      setTouched({ w: false, h: false, age: false });
      toast('Cálculo actualizado');
      // The save button turns disabled (nothing left to save): keep focus inside the panel.
      requestAnimationFrame(() => document.getElementById('kcal-close')?.focus());
    } catch (e) {
      toastError(e);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const reset = () => {
    setW(base.w);
    setH(base.h);
    setAge(base.age);
    setSex(base.sex);
    setActivity(base.activity);
    setGoal(base.goal);
    setSelected(savedTarget);
    setProtein(base.protein);
    setFat(base.fat);
    setTouched({ w: false, h: false, age: false });
    setSubmitted(false);
    setSavedMsg(null);
  };

  return (
    <form
      className="split kcal-form"
      noValidate
      aria-busy={saving || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="vstack">
        <GlassCard variant="strong" aria-labelledby="kcal-title" rise={false}>
          <h2 id="kcal-title" className="card__title" style={{ marginBottom: 4 }} tabIndex={-1} data-autofocus>
            <SlidersHorizontal aria-hidden="true" />
            Datos del cálculo
          </h2>
          <p className="t-small" style={{ marginBottom: 16 }}>
            Al guardar, actualizamos tu perfil y tus calorías. Si cambias el peso, queda registrado como tu peso de hoy.
          </p>
          <fieldset className="vstack kcal-fields" disabled={saving}>
            <legend className="sr-only">Datos del cálculo</legend>
            <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))' }}>
              <NumberField
                id="kcal-w"
                label="Peso"
                value={w}
                onChange={(e) => edit(setW)(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, w: true }))}
                suffix={u.w}
                error={shown('w')}
                required
              />
              <NumberField
                id="kcal-h"
                label="Altura"
                value={h}
                onChange={(e) => edit(setH)(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, h: true }))}
                suffix={u.h}
                error={shown('h')}
                required
              />
              <NumberField
                id="kcal-age"
                label="Edad"
                value={age}
                onChange={(e) => edit(setAge)(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onBlur={() => setTouched((t) => ({ ...t, age: true }))}
                decimals={false}
                suffix="años"
                error={shown('age')}
                required
              />
            </div>
            <div className="field">
              <span className="field__label" id="kcal-sex-label">
                Sexo biológico (para la ecuación)
              </span>
              <Segmented label="Sexo biológico" options={SEX_OPTIONS} value={sex} onChange={(v) => { setSex(v); setSavedMsg(null); }} block />
            </div>
            <SelectField
              label="Nivel de actividad (incluye tu entrenamiento habitual)"
              value={activity}
              onChange={(e) => {
                setActivity(e.target.value as ActivityLevel);
                setSavedMsg(null);
              }}
              options={(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((k) => ({
                value: k,
                label: `${ACTIVITY_LEVELS[k].label} · ${ACTIVITY_LEVELS[k].description}`,
              }))}
            />
            <SelectField
              label="Objetivo"
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value as GoalType);
                setSelected(null); // the targets offered depend on the goal
                setSavedMsg(null);
              }}
              options={GOALS.map((g) => ({ value: g.id, label: g.label }))}
            />
          </fieldset>
        </GlassCard>
      </div>

      <div className="vstack">
        {!result ? (
          <GlassCard rise={false}>
            <p className="t-body" role="status">
              {submitted ? 'Revisa los campos marcados para calcular tu gasto energético.' : 'Completa peso, altura y edad para estimar tu gasto energético.'}
            </p>
          </GlassCard>
        ) : (
          <>
            <GlassCard variant="glow" aria-labelledby="kcal-res" rise={false}>
              <h3 id="kcal-res" className="sr-only">
                Resultado
              </h3>
              <div className="energy-grid" aria-live="polite">
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

            <GlassCard aria-labelledby="kcal-targets" rise={false}>
              <h3 id="kcal-targets" className="card__title" style={{ marginBottom: 12 }}>
                Objetivo calórico orientativo
              </h3>
              <div className="energy-grid energy-grid--targets" role="group" aria-labelledby="kcal-targets">
                {result.targets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="energy-target pressable"
                    aria-pressed={target?.id === t.id}
                    disabled={saving}
                    onClick={() => {
                      setSelected(t.id);
                      setSavedMsg(null);
                    }}
                  >
                    <span className="energy-target__name">
                      {t.label} {t.recommended && <span className="badge badge--accent energy-target__badge">Sugerido</span>}
                    </span>
                    <span className="energy-target__kcal">
                      {formatInt(t.kcal)}
                      <small>kcal</small>
                    </span>
                    <span className="t-small">{keepUnitsTogether(t.description)}</span>
                  </button>
                ))}
              </div>

              {macros && target && (
                <div style={{ marginTop: 20 }}>
                  <h4 className="card__title" style={{ marginBottom: 10 }}>
                    Macronutrientes (opcional)
                  </h4>
                  <div className="kcal-macro-controls">
                    <div className="field">
                      <span className="field__label">Proteína por kg</span>
                      <Segmented
                        label="Proteína por kilo de peso"
                        options={['1.2', '1.6', '2'].map((v) => ({ value: v, label: `${formatNumber(Number(v), 1)} g` }))}
                        value={protein}
                        onChange={edit(setProtein)}
                        block
                      />
                    </div>
                    <div className="field">
                      <span className="field__label">Grasas</span>
                      <Segmented label="Porcentaje de grasas" options={['25', '30', '35'].map((v) => ({ value: v, label: `${v} %` }))} value={fat} onChange={edit(setFat)} block />
                    </div>
                  </div>
                  <MacroSplitView macros={macros} />
                  {!macros.valid && <p className="field__error" style={{ marginTop: 8 }}>La proteína y las grasas superan las calorías del objetivo. Ajusta la distribución.</p>}
                  <p className="field__hint" style={{ marginTop: 10 }}>
                    Proteína = peso × g/kg (4 kcal/g) · Grasas = % de las calorías (9 kcal/g) · Carbohidratos = resto (4 kcal/g).
                  </p>
                </div>
              )}
            </GlassCard>

            <GlassCard className="kcal-formula-card" aria-labelledby="kcal-how" rise={false}>
              <h3 id="kcal-how" className="card__title" style={{ marginBottom: 8 }}>
                Cómo se calcula
              </h3>
              <dl className="formula">
                <div>
                  <dt>Metabolismo basal (Mifflin-St Jeor)</dt>
                  <dd>
                    10 × {formatNumber(kg!, 1)} + 6,25 × {formatNumber(cm!, 0)} − 5 × {ageN} {sexConst}{' '}
                    <span className="kcal-formula__result">= {formatInt(mifflinStJeor(kg!, cm!, ageN!, sex))} kcal</span>
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
                  <li key={n} className="t-small energy-note">
                    <Info aria-hidden="true" />
                    {keepUnitsTogether(n)}
                  </li>
                ))}
                <li className="t-small energy-note">
                  <Info aria-hidden="true" />
                  RUMBO no registra lo que comes: estas cifras son estimaciones de gasto, no de ingesta.
                </li>
              </ul>
            </GlassCard>
          </>
        )}

        <div className="kcal-actions">
          <p className="kcal-actions__status" role="status" aria-live="polite">
            {savedMsg ?? (dirty ? 'Tienes cambios sin guardar.' : 'Sin cambios respecto a tus datos guardados.')}
          </p>
          <div className="kcal-actions__row">
            <Button
              type="submit"
              icon={<Save aria-hidden="true" />}
              loading={saving}
              disabled={!dirty && !submitted}
              // Keeps focus in the field on press: its blur would show the field's error and
              // shift this button down between press and release, losing the tap.
              onMouseDown={(e) => e.preventDefault()}
            >
              {saving ? 'Guardando…' : 'Guardar y actualizar'}
            </Button>
            <Button
              id="kcal-close"
              variant="ghost"
              onClick={() => {
                reset();
                onCancel();
              }}
              disabled={saving}
            >
              {dirty ? 'Descartar y cerrar' : 'Cerrar'}
            </Button>
          </div>
          {last && (
            <p className="t-small t-muted">
              Último cálculo guardado el {formatDate.long(last.date)}: {formatInt(last.tdee)} kcal de gasto
              {last.target ? ` · objetivo ${formatInt(last.target)} kcal` : ''}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
