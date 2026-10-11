import { GlassWater } from 'lucide-react';
import { useEffect, useState } from 'react';
import { addWater } from '@/db/repos/tracking';
import { formatDate, nowTime, todayKey } from '@/domain/dates';
import { WATER_PRESETS_ML } from '@/domain/habits';
import type { Units } from '@/domain/types';
import { checkRange, LIMITS } from '@/domain/validation';
import { Button } from '@/ui/Button';
import { NumberField, TextField } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { toast, toastError } from '@/ui/toast';
import { useUnits } from '../units';

interface Props {
  open: boolean;
  onClose: () => void;
  units: Units;
  date?: string;
}

export function WaterSheet({ open, onClose, units, date: dateProp }: Props) {
  const u = useUnits(units);
  const today = todayKey();
  const [custom, setCustom] = useState('');
  const [date, setDate] = useState(dateProp ?? today);
  const [time, setTime] = useState(nowTime());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(dateProp ?? todayKey());
      setTime(nowTime());
      setCustom('');
      setError(null);
    }
  }, [open, dateProp]);

  const add = async (ml: number) => {
    const err = checkRange(ml, LIMITS.waterMl);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    try {
      await addWater(date, ml, time);
      toast(`+${u.volume(ml)} de agua${date !== today ? ` · ${formatDate.dayMonth(date)}` : ''}`);
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Registrar agua" locked={busy}>
      <div className="vstack">
        <div className="preset-grid" role="group" aria-label="Cantidades habituales">
          {WATER_PRESETS_ML.map((ml) => (
            <button key={ml} type="button" className="preset" onClick={() => add(ml)} disabled={busy}>
              <GlassWater aria-hidden="true" />
              <span className="preset__value">{u.volume(ml)}</span>
            </button>
          ))}
        </div>
        <form
          className="hstack"
          style={{ alignItems: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault();
            const ml = u.parseVolume(custom);
            if (ml === null) setError('Introduce una cantidad válida.');
            else void add(ml);
          }}
        >
          <NumberField
            label="Cantidad personalizada"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setError(null);
            }}
            suffix={u.v}
            error={error}
            fieldClassName="grow"
          />
          <Button type="submit" variant="secondary" disabled={!custom || busy} style={{ marginBottom: error ? 26 : 0 }}>
            Añadir
          </Button>
        </form>
        <div className="grid-2">
          <TextField label="Fecha" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          <TextField label="Hora" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
    </Sheet>
  );
}
