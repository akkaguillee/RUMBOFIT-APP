import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { addWeight, deleteWeight, updateWeight, weightsOn } from '@/db/repos/tracking';
import { nowTime, todayKey, formatDate } from '@/domain/dates';
import type { Units, WeightEntry } from '@/domain/types';
import { feedbackMessage } from '@/domain/messages';
import { checkRange, LIMITS } from '@/domain/validation';
import { Button } from '@/ui/Button';
import { cheer } from '@/ui/cheer';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { NumberField, TextAreaField, TextField } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { toast, toastError } from '@/ui/toast';
import { useUnits } from '../units';

interface Props {
  open: boolean;
  onClose: () => void;
  units: Units;
  entry?: WeightEntry | null;
  defaultDate?: string;
  lastKg?: number;
}

export function WeightSheet({ open, onClose, units, entry, defaultDate, lastKg }: Props) {
  const u = useUnits(units);
  const today = todayKey();
  const [value, setValue] = useState('');
  const [date, setDate] = useState(defaultDate ?? today);
  const [time, setTime] = useState(nowTime());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sameDay, setSameDay] = useState<WeightEntry[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(entry ? u.weightToInput(entry.kg) : '');
    setDate(entry?.date ?? defaultDate ?? todayKey());
    setTime(entry?.time ?? nowTime());
    setNote(entry?.note ?? '');
    setError(null);
  }, [open, entry, defaultDate, u]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    weightsOn(date).then((rows) => alive && setSameDay(rows.filter((r) => r.id !== entry?.id)));
    return () => {
      alive = false;
    };
  }, [open, date, entry]);

  const save = async () => {
    const kg = u.parseWeight(value);
    const err = checkRange(kg, { ...LIMITS.weightKg, label: 'El peso' });
    if (err) {
      setError(err);
      return;
    }
    if (date > today) {
      setError('No puedes registrar fechas futuras.');
      return;
    }
    setSaving(true);
    try {
      if (entry?.id !== undefined) {
        await updateWeight(entry.id, { date, time, kg: kg!, note });
        toast('Registro actualizado');
      } else {
        await addWeight({ date, time, kg: kg!, note });
        toast(feedbackMessage(Math.round(kg! * 10)));
        cheer();
      }
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        locked={saving}
        title={entry ? 'Editar registro de peso' : 'Registrar peso'}
        description={entry ? `Registro del ${formatDate.long(entry.date)}` : 'Para comparar mejor, pésate en condiciones similares (por ejemplo, por la mañana).'}
        footer={
          <>
            {entry && (
              <Button variant="secondary" icon={<Trash2 />} onClick={() => setConfirmDelete(true)} aria-label="Eliminar registro">
                Eliminar
              </Button>
            )}
            <Button onClick={save} loading={saving}>
              {entry ? 'Guardar cambios' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form
          className="vstack"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <NumberField
            label="Peso"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            suffix={u.w}
            size="lg"
            placeholder={lastKg ? u.weightToInput(lastKg) : '0,0'}
            error={error}
            data-autofocus
            hint={lastKg && !entry ? `Último registro: ${u.weight(lastKg)}` : undefined}
          />
          <div className="grid-2">
            <TextField label="Fecha" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
            <TextField label="Hora" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <TextAreaField label="Nota (opcional)" value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} placeholder="Cómo te sientes, contexto, etc." rows={3} />
          {sameDay.length > 0 && (
            <p className="callout callout--warn" role="note">
              Ya tienes {sameDay.length === 1 ? 'un registro' : `${sameDay.length} registros`} este día ({sameDay.map((s) => u.weight(s.kg)).join(', ')}). Se
              guardará como una medición adicional, sin sobrescribir las anteriores.
            </p>
          )}
          <button type="submit" hidden />
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="¿Eliminar este registro?"
        message="El registro desaparecerá de tu historial y de las gráficas. Los hitos se recalcularán con tus datos restantes."
        onConfirm={async () => {
          if (entry?.id === undefined) return;
          await deleteWeight(entry.id);
          toast('Registro eliminado');
          onClose();
        }}
      />
    </>
  );
}
