import { Droplets, Dumbbell, Footprints, Pencil, Plus, Scale, Sparkles, StickyNote, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/db';
import { useNote, useWaterDay } from '@/db/hooks';
import { deleteSteps, deleteWater, setNote } from '@/db/repos/tracking';
import { findAchievementDef } from '@/domain/achievements/catalog';
import { formatDate, formatMinutes, todayKey } from '@/domain/dates';
import type { DaySummary } from '@/domain/summary';
import type { Profile, WeightEntry } from '@/domain/types';
import { formatInt } from '@/domain/units';
import { Button, IconButton } from '@/ui/Button';
import { TextAreaField } from '@/ui/Field';
import { ProgressBar } from '@/ui/ProgressBar';
import { StatusBadge } from '@/ui/StatusBadge';
import { toast, toastError } from '@/ui/toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { StepsSheet } from '../shared/sheets/StepsSheet';
import { WaterSheet } from '../shared/sheets/WaterSheet';
import { WeightSheet } from '../shared/sheets/WeightSheet';
import { useUnits } from '../shared/units';

interface Props {
  date: string;
  summary?: DaySummary;
  profile: Profile;
}

export function DayDetail({ date, summary, profile }: Props) {
  const u = useUnits(profile.units);
  const navigate = useNavigate();
  const future = date > todayKey();
  const water = useWaterDay(date);
  const weights = useLiveQuery(() => db.weights.where('date').equals(date).toArray(), [date]);
  const note = useNote(date);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [sheet, setSheet] = useState<'weight' | 'water' | 'steps' | null>(null);
  const [editing, setEditing] = useState<WeightEntry | null>(null);

  // Reset the draft when the day (or its stored note) changes.
  const noteKey = `${date}|${note === undefined ? '…' : (note?.text ?? '')}`;
  const [syncedKey, setSyncedKey] = useState(noteKey);
  if (syncedKey !== noteKey) {
    setSyncedKey(noteKey);
    setNoteDraft(note?.text ?? '');
    setNoteDirty(false);
  }

  const saveNote = async () => {
    try {
      await setNote(date, noteDraft);
      setNoteDirty(false);
      toast(noteDraft.trim() ? 'Nota guardada' : 'Nota eliminada');
    } catch (e) {
      toastError(e);
    }
  };

  const s = summary;
  const waterGoal = s?.waterGoalMl ?? profile.waterGoalMl;
  const stepsGoal = s?.stepsGoal ?? profile.stepsGoal;

  return (
    <div className="day-detail vstack">
      <div>
        <p className="t-eyebrow">{formatDate.relative(date)}</p>
        <h2 className="t-heading" style={{ fontSize: 'var(--text-xl)', marginTop: 2 }}>
          {formatDate.full(date)}
        </h2>
        {!future && s && s.goalsTracked > 0 && (
          <div style={{ marginTop: 8 }}>
            <StatusBadge
              tone={s.goalsMet === s.goalsTracked ? 'good' : 'neutral'}
              label={`${s.goalsMet} de ${s.goalsTracked} objetivos de hábitos cumplidos`}
              icon={s.goalsMet === s.goalsTracked ? 'check' : 'flat'}
            />
          </div>
        )}
        {!future && (!s || !s.hasData) && <p className="t-small" style={{ marginTop: 6 }}>Sin registros este día. Puedes añadir datos si los recuerdas.</p>}
        {future && <p className="t-small" style={{ marginTop: 6 }}>Es una fecha futura: podrás registrar datos cuando llegue.</p>}
      </div>

      {/* Weight */}
      <section className="dd-section" aria-label="Peso">
        <div className="dd-section__head">
          <span className="dd-section__title">
            <Scale aria-hidden="true" /> Peso
          </span>
          {!future && (
            <IconButton label="Añadir peso" size="sm" onClick={() => setSheet('weight')}>
              <Plus />
            </IconButton>
          )}
        </div>
        {weights?.length ? (
          <ul>
            {weights.map((w) => (
              <li key={w.id} className="dd-row">
                <span className="grow">
                  <strong>{u.weight(w.kg)}</strong>
                  <span className="t-small"> {w.time ? `· ${w.time}` : ''}</span>
                  {w.note && <span className="t-small" style={{ display: 'block' }}>“{w.note}”</span>}
                </span>
                <IconButton label="Editar registro de peso" size="sm" tone="plain" onClick={() => setEditing(w)}>
                  <Pencil />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-small t-muted">Sin pesaje.</p>
        )}
      </section>

      {/* Water */}
      <section className="dd-section" aria-label="Agua">
        <div className="dd-section__head">
          <span className="dd-section__title">
            <Droplets aria-hidden="true" style={{ color: 'var(--series-water)' }} /> Agua
          </span>
          {!future && (
            <IconButton label="Añadir agua" size="sm" onClick={() => setSheet('water')}>
              <Plus />
            </IconButton>
          )}
        </div>
        <p className="t-small" style={{ marginBottom: 8 }}>
          <strong style={{ color: 'var(--text)' }}>{u.volume(s?.waterMl ?? 0)}</strong> de {u.volume(waterGoal)}
        </p>
        <ProgressBar value={(s?.waterMl ?? 0) / waterGoal} tone="water" label="Agua del día" />
        {!!water?.length && (
          <ul style={{ marginTop: 8 }}>
            {water.map((w) => (
              <li key={w.id} className="dd-row">
                <span className="grow t-small">
                  {w.time} · <strong style={{ color: 'var(--text)' }}>{u.volume(w.ml)}</strong>
                </span>
                <IconButton
                  label={`Eliminar ${u.volume(w.ml)} de las ${w.time}`}
                  size="sm"
                  tone="plain"
                  onClick={async () => {
                    await deleteWater(w.id!);
                    toast('Registro de agua eliminado');
                  }}
                >
                  <Trash2 />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Steps */}
      <section className="dd-section" aria-label="Pasos">
        <div className="dd-section__head">
          <span className="dd-section__title">
            <Footprints aria-hidden="true" style={{ color: 'var(--series-steps)' }} /> Pasos
          </span>
          <div className="hstack" style={{ gap: 6 }}>
            {!!s?.steps && (
              <IconButton
                label="Eliminar pasos del día"
                size="sm"
                tone="plain"
                onClick={async () => {
                  await deleteSteps(date);
                  toast('Pasos eliminados');
                }}
              >
                <Trash2 />
              </IconButton>
            )}
            {!future && (
              <IconButton label="Registrar pasos" size="sm" onClick={() => setSheet('steps')}>
                <Plus />
              </IconButton>
            )}
          </div>
        </div>
        <p className="t-small" style={{ marginBottom: 8 }}>
          <strong style={{ color: 'var(--text)' }}>{formatInt(s?.steps ?? 0)}</strong> de {formatInt(stepsGoal)} pasos
        </p>
        <ProgressBar value={(s?.steps ?? 0) / stepsGoal} tone="steps" label="Pasos del día" />
      </section>

      {/* Workouts */}
      <section className="dd-section" aria-label="Entrenamiento">
        <div className="dd-section__head">
          <span className="dd-section__title">
            <Dumbbell aria-hidden="true" /> Entrenamiento
          </span>
        </div>
        {s?.workouts.length ? (
          <ul>
            {s.workouts.map((w) => (
              <li key={w.id} className="dd-row">
                <span className="grow">
                  <strong>{w.name}</strong>
                  <span className="t-small"> · {formatMinutes(w.durationSec)}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/entreno?tab=historial&w=${w.id}`)}>
                  Ver
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-small t-muted">Sin entrenamientos.</p>
        )}
      </section>

      {/* Milestones */}
      {!!s?.unlocked.length && (
        <section className="dd-section" aria-label="Hitos desbloqueados">
          <div className="dd-section__head">
            <span className="dd-section__title">
              <Sparkles aria-hidden="true" style={{ color: 'var(--accent)' }} /> Hitos desbloqueados
            </span>
          </div>
          <ul className="hstack wrap" style={{ gap: 6 }}>
            {s.unlocked.slice(0, 8).map((id) => (
              <li key={id} className="badge badge--accent">
                {findAchievementDef(id)?.name ?? id}
              </li>
            ))}
            {s.unlocked.length > 8 && <li className="badge">y {s.unlocked.length - 8} más</li>}
          </ul>
        </section>
      )}

      {/* Note */}
      {!future && (
        <section className="dd-section" aria-label="Nota del día">
          <TextAreaField
            label={
              <span className="hstack" style={{ gap: 6 }}>
                <StickyNote aria-hidden="true" style={{ width: 16, height: 16 }} /> Nota del día
              </span>
            }
            value={noteDraft}
            maxLength={1000}
            rows={3}
            placeholder="Cómo te has sentido, qué ha ido bien, qué quieres recordar…"
            onChange={(e) => {
              setNoteDraft(e.target.value);
              setNoteDirty(true);
            }}
          />
          {noteDirty && (
            <Button size="sm" onClick={saveNote} style={{ marginTop: 8 }}>
              Guardar nota
            </Button>
          )}
        </section>
      )}

      <WeightSheet open={sheet === 'weight'} onClose={() => setSheet(null)} units={profile.units} defaultDate={date} />
      <WeightSheet open={editing !== null} onClose={() => setEditing(null)} units={profile.units} entry={editing} />
      <WaterSheet open={sheet === 'water'} onClose={() => setSheet(null)} units={profile.units} date={date} />
      <StepsSheet open={sheet === 'steps'} onClose={() => setSheet(null)} date={date} />
    </div>
  );
}
