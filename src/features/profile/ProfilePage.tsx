import { Download, HeartPulse, Info, Palette, ShieldCheck, Sparkles, Target, Trash2, Upload, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme, type Effects, type Theme } from '@/app/theme';
import { introEnabled, setIntroEnabled } from '@/app/intro';
import { storageMode } from '@/db/backend';
import { useProfile, useSetting, useWeights } from '@/db/hooks';
import { deleteAllData, downloadJson, exportAll, importAll, parseExport, type ExportFile } from '@/db/repos/data';
import { updateProfile } from '@/db/repos/profile';
import { formatDate, todayKey } from '@/domain/dates';
import { ACTIVITY_LEVELS, currentAge, estimateActivityLevel } from '@/domain/health';
import type { ActivityLevel, Profile, Sex, Units } from '@/domain/types';
import { checkRange, LIMITS } from '@/domain/validation';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { NumberField, SelectField, TextField } from '@/ui/Field';
import { GlassCard } from '@/ui/GlassCard';
import { Loader } from '@/ui/Loader';
import { Page, PageHead } from '@/ui/Page';
import { AccentPicker } from '@/ui/AccentPicker';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { Switch } from '@/ui/Switch';
import { toast, toastError } from '@/ui/toast';
import { DayPicker } from '../onboarding/PrefControls';
import { activityWithDays, inputOrStored, mainGoalLabel, TARGET_NEEDS_HEIGHT, targetWeightError } from '../onboarding/preferences';
import { SEX_OPTIONS, usesWeightGoal } from '../shared/labels';
import { unitsApi } from '../shared/units';
import { HEIGHT_IN_PERSONAL, PreferencesCard, PreferencesSheet, type PrefGroup } from './PreferencesForm';
import './profile.css';

/** A Perfil card. Its `id` is also the anchor other pages link to (/perfil#personal). */
function Section({ icon, title, children, id }: { icon: ReactNode; title: string; children: ReactNode; id: string }) {
  return (
    <GlassCard id={id} className="profile-sec" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="card__title" tabIndex={-1} style={{ marginBottom: 16 }}>
        {icon}
        {title}
      </h2>
      {children}
    </GlassCard>
  );
}

export default function ProfilePage() {
  const profile = useProfile();
  if (!profile) return <Loader />;
  return <ProfileContent profile={profile} />;
}

function ProfileContent({ profile }: { profile: Profile }) {
  const weights = useWeights();
  const latest = weights?.[weights.length - 1];
  const today = todayKey();
  const age = currentAge(profile.age, profile.ageRecordedOn, today);
  useScrollToAnchor();
  // The edit sheet keeps its key while closing (so it can animate out) and gets a new one each time it opens.
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<{ group: PrefGroup; n: number }>({ group: 'goals', n: 0 });
  const edit = (group: PrefGroup) => {
    setSheet((s) => ({ group, n: s.n + 1 }));
    setEditing(true);
  };

  return (
    <Page>
      <PageHead eyebrow="Perfil" display="Perfil" title="Perfil y ajustes" />
      <GlassCard variant="glow" className="profile-hero">
        <span className="profile-hero__avatar" aria-hidden="true">
          {profile.name.charAt(0).toUpperCase()}
        </span>
        <div className="grow">
          <h2 className="t-title" style={{ fontSize: 'var(--text-2xl)' }}>
            {profile.name}
          </h2>
          <p className="t-small profile-hero__goal">{mainGoalLabel(profile)}</p>
          <p className="t-small t-muted">En RUMBO desde el {formatDate.long(profile.startDate)}</p>
        </div>
      </GlassCard>

      {/* Each form starts from the saved values: a new key when they change elsewhere (units, an imported copy…), so no field keeps a stale value. */}
      <div className="profile-grid">
        <PersonalForm
          key={[profile.name, profile.age, profile.ageRecordedOn, profile.sex, profile.units, profile.heightCm].join('|')}
          profile={profile}
          age={age}
        />
        <GoalForm
          key={[profile.goal, profile.startWeightKg, profile.goalWeightKg, profile.activityLevel, profile.units].join('|')}
          profile={profile}
          age={age}
          latestKg={latest?.kg}
          onEditGoals={() => edit('goals')}
        />
        <PreferencesCard profile={profile} onEdit={edit} />
        <HabitsForm key={[profile.waterGoalMl, profile.stepsGoal, profile.trainingDays.join(), profile.units].join('|')} profile={profile} />
        <AppearanceSection />
        <DataSection />
        <Section icon={<HeartPulse aria-hidden="true" />} title="Uso responsable" id="about-sec">
          <div className="vstack t-small" style={{ gap: 10 }}>
            <p>
              RUMBO es una herramienta de seguimiento personal, no un dispositivo médico. Las estimaciones de calorías, IMC o distancia son orientativas
              y no sustituyen el consejo de un profesional sanitario.
            </p>
            <p>RUMBO no promete resultados en una fecha concreta: cada cuerpo tiene su ritmo, y las pausas por descanso o enfermedad forman parte del camino.</p>
            <Link to="/quien-soy" className="link-btn">
              <Sparkles aria-hidden="true" style={{ marginRight: 4 }} />
              Conoce al creador de RUMBO
            </Link>
          </div>
        </Section>
      </div>
      <PreferencesSheet
        key={`${sheet.group}-${sheet.n}`}
        group={sheet.group}
        open={editing}
        onClose={() => setEditing(false)}
        profile={profile}
        latestKg={latest?.kg}
      />
    </Page>
  );
}

/**
 * /perfil#personal, /perfil#preferencias…: once the page cascade has settled,
 * land on that card and focus its title. The jump is instant (the page
 * transition already moves), so a slow device can never leave it half-way.
 */
function useScrollToAnchor() {
  const { hash } = useLocation();
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    let frame = 0;
    const t = window.setTimeout(() => {
      frame = requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (!el?.classList.contains('glass')) return;
        el.scrollIntoView({ block: 'start' });
        el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      });
    }, 320);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(frame);
    };
  }, [hash]);
}

function PersonalForm({ profile, age }: { profile: Profile; age?: number }) {
  const [name, setName] = useState(profile.name);
  const [ageS, setAge] = useState(age !== undefined ? String(age) : '');
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [units, setUnits] = useState<Units>(profile.units);
  const [height, setHeight] = useState(unitsApi(profile.units).heightToInput(profile.heightCm));
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const u = unitsApi(units);

  const save = async () => {
    const cm = height ? inputOrStored(height, profile.heightCm, u.heightToInput, u.parseHeight) : undefined;
    const e = {
      name: name.trim() ? null : 'El nombre es obligatorio.',
      age: ageS ? checkRange(Number(ageS), LIMITS.age) : null,
      height: height ? checkRange(cm ?? null, LIMITS.heightCm) : null,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    setBusy(true);
    try {
      // An emptied field removes the value: both are optional.
      await updateProfile({
        name,
        sex,
        units,
        ...(ageS ? { age: Number(ageS) } : { age: undefined, ageRecordedOn: undefined }),
        heightCm: cm ?? undefined,
      });
      toast('Datos personales guardados');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section icon={<UserRound aria-hidden="true" />} title="Datos personales" id="personal">
      <div className="vstack">
        <TextField label="Nombre o alias" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <div className="grid-2">
          <NumberField label="Edad" value={ageS} decimals={false} suffix="años" onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} error={errors.age} />
          <NumberField label="Altura" value={height} suffix={u.h} onChange={(e) => setHeight(e.target.value)} error={errors.height} />
        </div>
        <div className="field">
          <span className="field__label">Sexo biológico</span>
          <Segmented label="Sexo biológico" options={SEX_OPTIONS} value={sex} onChange={setSex} block />
          <span className="field__hint">Solo se usa para la ecuación del metabolismo basal.</span>
        </div>
        <div className="field">
          <span className="field__label">Unidades</span>
          <Segmented
            label="Unidades"
            options={[
              { value: 'metric', label: 'Métrico' },
              { value: 'imperial', label: 'Imperial' },
            ]}
            value={units}
            onChange={(v) => {
              const cm = height ? inputOrStored(height, profile.heightCm, u.heightToInput, u.parseHeight) : null;
              setUnits(v);
              setHeight(cm ? unitsApi(v).heightToInput(cm) : '');
            }}
            block
          />
        </div>
        <Button onClick={save} loading={busy}>
          Guardar datos
        </Button>
      </div>
    </Section>
  );
}

function GoalForm({ profile, age, latestKg, onEditGoals }: { profile: Profile; age?: number; latestKg?: number; onEditGoals: () => void }) {
  const u = unitsApi(profile.units);
  const goal = profile.goal;
  // Same rule as onboarding and the «Objetivos» sheet: no target weight under 18.
  const minor = age !== undefined && age < 18;
  const [start, setStart] = useState(u.weightToInput(profile.startWeightKg));
  const [target, setTarget] = useState(u.weightToInput(profile.goalWeightKg));
  const [activity, setActivity] = useState<ActivityLevel>(profile.activityLevel);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const estimate = profile.activity ? estimateActivityLevel(profile.activity) : null;

  const save = async () => {
    const s = start ? (inputOrStored(start, profile.startWeightKg, u.weightToInput, u.parseWeight) ?? NaN) : undefined;
    const t = target && !minor ? (inputOrStored(target, profile.goalWeightKg, u.weightToInput, u.parseWeight) ?? NaN) : undefined;
    if (start && checkRange(s ?? null, LIMITS.weightKg)) return setError(checkRange(s ?? null, LIMITS.weightKg));
    // Same rules as onboarding: direction for weight goals and never below a BMI of 18.5 (which needs the height).
    const targetError = t !== undefined ? targetWeightError(usesWeightGoal(goal) ? goal : 'maintain', t, s ?? null, profile.heightCm ?? null, u.weight) : null;
    if (targetError) return setError(targetError === TARGET_NEEDS_HEIGHT ? HEIGHT_IN_PERSONAL : targetError);
    setError(null);
    setBusy(true);
    try {
      await updateProfile({ startWeightKg: s, goalWeightKg: t, activityLevel: activity });
      toast('Objetivo actualizado');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section icon={<Target aria-hidden="true" />} title="Objetivo" id="goal">
      <div className="vstack">
        <div className="goal-main">
          <span className="goal-main__text">
            <span className="field__label">Objetivo principal</span>
            <span className="goal-main__value">{mainGoalLabel(profile)}</span>
          </span>
          <Button variant="secondary" size="sm" onClick={onEditGoals}>
            Cambiar
          </Button>
        </div>
        {minor ? (
          <NumberField label="Peso de partida" value={start} suffix={u.w} onChange={(e) => setStart(e.target.value)} />
        ) : (
          <div className="grid-2">
            <NumberField label="Peso de partida" value={start} suffix={u.w} onChange={(e) => setStart(e.target.value)} />
            <NumberField
              label={usesWeightGoal(goal) ? 'Peso objetivo' : 'Peso de referencia'}
              value={target}
              suffix={u.w}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        )}
        {latestKg !== undefined && (
          <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', textAlign: 'left' }} onClick={() => setStart(u.weightToInput(latestKg))}>
            Usar mi peso actual ({u.weight(latestKg)}) como punto de partida
          </button>
        )}
        {minor && (
          <p className="callout">
            <Info aria-hidden="true" />
            <span>Como eres menor de edad, no fijamos un peso objetivo. Si quieres cambiar tu peso, coméntalo antes con un profesional sanitario.</span>
          </p>
        )}
        <SelectField
          label="Nivel de actividad"
          value={activity}
          onChange={(e) => setActivity(e.target.value as ActivityLevel)}
          options={(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((k) => ({ value: k, label: ACTIVITY_LEVELS[k].label }))}
          hint={
            estimate
              ? activity === estimate
                ? 'Estimado con tus respuestas de «Actividad». Puedes ajustarlo aquí.'
                : `Según tus respuestas sería ${ACTIVITY_LEVELS[estimate].label.toLowerCase()}. Se usará el que elijas aquí.`
              : ACTIVITY_LEVELS[activity].description
          }
        />
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        {!minor && <p className="field__hint">Cambiar el peso objetivo inicia una nueva etapa. Tu historial y los hitos conseguidos se conservan.</p>}
        <Button onClick={save} loading={busy}>
          Guardar objetivo
        </Button>
      </div>
    </Section>
  );
}

function HabitsForm({ profile }: { profile: Profile }) {
  const u = unitsApi(profile.units);
  const [water, setWater] = useState(u.volumeToInput(profile.waterGoalMl));
  const [steps, setSteps] = useState(String(profile.stepsGoal));
  const [days, setDays] = useState<number[]>(profile.trainingDays);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const ml = inputOrStored(water, profile.waterGoalMl, u.volumeToInput, u.parseVolume);
    const st = Number(steps);
    const err = checkRange(ml, LIMITS.waterGoalMl) ?? checkRange(st, LIMITS.stepsGoal);
    if (err) return setError(err);
    setError(null);
    setBusy(true);
    // The training days are also an activity answer: keep both in step and re-estimate the level.
    const changedDays = days.length !== profile.trainingDays.length;
    const activity = changedDays ? activityWithDays(profile, days) : undefined;
    const level = activity ? estimateActivityLevel(activity) : undefined;
    try {
      await updateProfile({ waterGoalMl: ml!, stepsGoal: st, trainingDays: days, ...(activity ? { activity, activityLevel: level } : {}) });
      toast(level && level !== profile.activityLevel ? `Guardado · Nivel de actividad: ${ACTIVITY_LEVELS[level].label.toLowerCase()}` : 'Objetivos diarios guardados');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section icon={<Sparkles aria-hidden="true" />} title="Hábitos y días de entreno" id="habits-sec">
      <div className="vstack">
        <div className="grid-2">
          <NumberField label="Agua al día" value={water} suffix={u.v} onChange={(e) => setWater(e.target.value)} />
          <NumberField label="Pasos al día" value={steps} decimals={false} onChange={(e) => setSteps(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="field">
          <span className="field__label" id="habits-days">
            Días disponibles para entrenar
          </span>
          <DayPicker days={days} onChange={setDays} labelledBy="habits-days" />
        </div>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <Button onClick={save} loading={busy}>
          Guardar
        </Button>
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const { theme, setTheme, effects, setEffects } = useTheme();
  const [intro, setIntro] = useState(introEnabled);
  const [, setDismissed] = useSetting<string[]>('dismissedTips', []);
  return (
    <Section icon={<Palette aria-hidden="true" />} title="Apariencia" id="appearance">
      <div className="vstack">
        <div className="field">
          <span className="field__label">Tema</span>
          <Segmented
            label="Tema"
            options={[
              { value: 'dark', label: 'Oscuro' },
              { value: 'light', label: 'Claro' },
            ]}
            value={theme}
            onChange={(v: Theme) => setTheme(v)}
            block
          />
        </div>
        <div className="field">
          <span className="field__label">Color de la interfaz</span>
          <AccentPicker />
          <span className="field__hint">Cambia el color de botones, anillos y destacados. Los colores de estado no cambian.</span>
        </div>
        <div className="field">
          <span className="field__label">Efectos visuales</span>
          <Segmented
            label="Efectos visuales"
            options={[
              { value: 'auto', label: 'Automático' },
              { value: 'full', label: 'Completos' },
              { value: 'lite', label: 'Ligeros' },
            ]}
            value={effects}
            onChange={(v: Effects) => setEffects(v)}
            block
          />
          <span className="field__hint">«Ligeros» reduce el desenfoque y las animaciones de fondo en dispositivos con poca potencia.</span>
        </div>
        <div className="setting-row">
          <span className="grow">
            <span className="list-row__title" style={{ display: 'block' }}>
              Animación de bienvenida
            </span>
            <span className="list-row__sub">Breve al abrir la app en una nueva sesión</span>
          </span>
          <Switch
            checked={intro}
            label="Animación de bienvenida"
            onChange={(v) => {
              setIntro(v);
              setIntroEnabled(v);
            }}
          />
        </div>
        <div className="setting-row">
          <span className="grow">
            <span className="list-row__title" style={{ display: 'block' }}>
              Consejos
            </span>
            <span className="list-row__sub">Vuelve a mostrar los consejos que descartaste</span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await setDismissed([]);
              toast('Consejos restablecidos');
            }}
          >
            Restablecer
          </Button>
        </div>
      </div>
    </Section>
  );
}

function DataSection() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ExportFile | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Section icon={<ShieldCheck aria-hidden="true" />} title="Datos y privacidad" id="data">
      <div className="vstack">
        {storageMode() === 'memory' ? (
          <p className="t-small">
            <strong>Modo temporal:</strong> ahora mismo no se puede guardar en este dispositivo, así que todo se borrará al cerrar o recargar.
            Descarga una copia de seguridad antes de salir para restaurarla después. Nada se envía a ningún servidor.
          </p>
        ) : (
          <p className="t-small">
            Tus datos se guardan solo en este dispositivo (IndexedDB del navegador) y no se envían a ningún servidor. Si borras los datos del navegador
            los perderás, así que haz copias de seguridad de vez en cuando.
          </p>
        )}
        <div className="grid-2">
          <Button
            variant="secondary"
            icon={<Download />}
            onClick={async () => {
              try {
                downloadJson(await exportAll(), `rumbo-copia-${todayKey()}.json`);
                toast('Copia de seguridad descargada');
              } catch (e) {
                toastError(e);
              }
            }}
          >
            Exportar
          </Button>
          <Button variant="secondary" icon={<Upload />} onClick={() => fileRef.current?.click()}>
            Importar
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              setPending(parseExport(await f.text()));
            } catch (err) {
              toastError(err);
            }
          }}
        />
        <Button variant="ghost" icon={<Trash2 />} onClick={() => setDeleteOpen(true)} style={{ color: 'var(--bad-text)' }}>
          Eliminar todos mis datos
        </Button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="¿Restaurar esta copia?"
        message={`Se reemplazarán todos los datos actuales por los de la copia del ${pending ? new Date(pending.exportedAt).toLocaleString('es-ES') : ''}.`}
        confirmLabel="Restaurar"
        tone="primary"
        onConfirm={async () => {
          try {
            await importAll(pending!);
          } catch (e) {
            console.error(e);
            throw new Error('No se pudo restaurar la copia: contiene datos no válidos. Tus datos actuales no se han modificado.');
          }
          toast('Copia restaurada');
        }}
      />
      <Sheet
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmText('');
        }}
        title="Eliminar todos los datos"
        locked={busy}
        footer={
          <Button
            variant="danger"
            block
            disabled={confirmText.trim().toUpperCase() !== 'BORRAR'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await deleteAllData();
                // Re-onboarding should land on Inicio, not on this page.
                navigate('/', { replace: true });
                try {
                  localStorage.removeItem('rumbo.introSeen');
                } catch {
                  /* ignore */
                }
              } catch (e) {
                toastError(e);
                setBusy(false);
              }
            }}
          >
            Eliminar definitivamente
          </Button>
        }
      >
        <div className="vstack">
          <p className="t-body">
            Se borrarán tu perfil, pesos, agua, pasos, entrenamientos, plantillas, notas e hitos de este dispositivo. Esta acción no se puede deshacer.
          </p>
          <TextField label="Escribe BORRAR para confirmar" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" data-autofocus />
        </div>
      </Sheet>
    </Section>
  );
}
