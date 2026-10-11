import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { addSteps, setSteps } from '@/db/repos/tracking';
import { formatDate, todayKey } from '@/domain/dates';
import { formatInt } from '@/domain/units';
import { checkRange, LIMITS } from '@/domain/validation';
import { Button } from '@/ui/Button';
import { NumberField, TextField } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { toast, toastError } from '@/ui/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  date?: string;
}

export function StepsSheet({ open, onClose, date: dateProp }: Props) {
  const today = todayKey();
  const [date, setDate] = useState(dateProp ?? today);
  const [mode, setMode] = useState<'add' | 'set'>('add');
  const [value, setValue] = useState('');
  const [distance, setDistance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const existing = useLiveQuery(async () => (await db.steps.where('date').equals(date).first()) ?? null, [date]);

  useEffect(() => {
    if (open) {
      setDate(dateProp ?? todayKey());
      setValue('');
      setDistance('');
      setError(null);
    }
  }, [open, dateProp]);

  const save = async () => {
    const n = Number(value.replace(/\D/g, ''));
    const total = mode === 'add' ? (existing?.steps ?? 0) + n : n;
    const err = !value ? 'Introduce un número de pasos.' : checkRange(total, LIMITS.steps);
    if (err) {
      setError(err);
      return;
    }
    const km = distance ? Number(distance.replace(',', '.')) : undefined;
    if (km !== undefined && (Number.isNaN(km) || km < 0 || km > 1000)) {
      setError('La distancia no es válida.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'add' && km === undefined) await addSteps(date, n);
      else await setSteps(date, total, km ?? existing?.distanceKm);
      toast(`${formatInt(total)} pasos ${date === today ? 'hoy' : `el ${formatDate.dayMonth(date)}`}`);
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Registrar pasos"
      description="Registro manual. Puedes copiar el total de tu móvil o reloj."
      locked={busy}
      footer={
        <Button onClick={save} loading={busy} block>
          Guardar
        </Button>
      }
    >
      <form
        className="vstack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Segmented
          label="Modo de registro"
          options={[
            { value: 'add', label: 'Añadir pasos' },
            { value: 'set', label: 'Total del día' },
          ]}
          value={mode}
          onChange={setMode}
          block
        />
        <NumberField
          label={mode === 'add' ? 'Pasos a añadir' : 'Total de pasos del día'}
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/\D/g, ''));
            setError(null);
          }}
          decimals={false}
          suffix="pasos"
          size="lg"
          error={error}
          data-autofocus
          hint={existing ? `Llevas ${formatInt(existing.steps)} pasos este día.` : 'Aún no hay pasos registrados este día.'}
        />
        <div className="grid-2">
          <TextField label="Fecha" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          <NumberField label="Distancia real (opcional)" value={distance} onChange={(e) => setDistance(e.target.value)} suffix="km" />
        </div>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
