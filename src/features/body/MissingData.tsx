import { Check } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { addWeight } from '@/db/repos/tracking';
import { updateProfile, type ProfilePatch } from '@/db/repos/profile';
import { missingText, type MissingEnergyField } from '@/domain/body';
import { nowTime } from '@/domain/dates';
import type { Units } from '@/domain/types';
import { checkRange, LIMITS, type Range } from '@/domain/validation';
import { Button } from '@/ui/Button';
import { NumberField } from '@/ui/Field';
import { toast, toastError } from '@/ui/toast';
import { useToday } from '@/ui/useToday';
import { useUnits } from '../shared/units';

const RANGES = { weight: LIMITS.weightKg, height: LIMITS.heightCm, age: LIMITS.age } satisfies Record<MissingEnergyField, Range>;
const EMPTY: Record<MissingEnergyField, string> = { weight: 'Escribe tu peso.', height: 'Escribe tu altura.', age: 'Escribe tu edad.' };

interface Props {
  fields: MissingEnergyField[];
  units: Units;
  /** What the values unlock, e.g. "calcular tu IMC". */
  purpose: string;
}

/**
 * Asks only for the values an automatic estimate is missing. Weight is stored
 * as today's record; height and age go to the profile. Nothing is assumed.
 */
export function MissingData({ fields, units, purpose }: Props) {
  const u = useUnits(units);
  const today = useToday();
  const [values, setValues] = useState<Record<MissingEnergyField, string>>({ weight: '', height: '', age: '' });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const parsed: Record<MissingEnergyField, number | null> = {
    weight: u.parseWeight(values.weight),
    height: u.parseHeight(values.height),
    age: values.age ? Number(values.age) : null,
  };
  const errorOf = (f: MissingEnergyField) => {
    // Empty fields are flagged only after a save attempt; a typed but invalid value at once.
    if (!values[f]) return submitted ? EMPTY[f] : null;
    return checkRange(parsed[f], RANGES[f]);
  };
  const errors = Object.fromEntries(fields.map((f) => [f, errorOf(f)])) as Record<MissingEnergyField, string | null>;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (fields.some((f) => checkRange(parsed[f], RANGES[f]))) {
      // Take keyboard and screen-reader users straight to the first field that needs attention.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    try {
      const patch: ProfilePatch = {};
      if (fields.includes('height')) patch.heightCm = parsed.height!;
      if (fields.includes('age')) patch.age = parsed.age!;
      if (Object.keys(patch).length) await updateProfile(patch);
      if (fields.includes('weight')) await addWeight({ date: today, time: nowTime(), kg: parsed.weight! });
      toast('Datos guardados', { tone: 'success' });
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const set = (f: MissingEnergyField, v: string) => setValues((s) => ({ ...s, [f]: f === 'age' ? v.replace(/\D/g, '') : v }));

  return (
    <form ref={formRef} className="body-missing" onSubmit={save} noValidate>
      <p className="body-missing__lead">
        Para {purpose} {fields.length > 1 ? 'faltan' : 'solo falta'} {missingText(fields)}. Después se actualiza automáticamente con tus registros.
      </p>
      <div className="body-missing__fields">
        {fields.includes('weight') && (
          <NumberField
            label="Peso de hoy"
            value={values.weight}
            onChange={(e) => set('weight', e.target.value)}
            suffix={u.w}
            error={errors.weight}
            hint="Se guarda en tus registros."
          />
        )}
        {fields.includes('height') && (
          <NumberField
            label="Altura"
            value={values.height}
            onChange={(e) => set('height', e.target.value)}
            suffix={u.h}
            error={errors.height}
            hint="Se guarda en tu perfil."
          />
        )}
        {fields.includes('age') && (
          <NumberField
            label="Edad"
            value={values.age}
            onChange={(e) => set('age', e.target.value)}
            decimals={false}
            suffix="años"
            error={errors.age}
            hint="Se guarda en tu perfil."
          />
        )}
      </div>
      <Button type="submit" icon={<Check />} loading={busy} className="body-missing__submit">
        Guardar
      </Button>
    </form>
  );
}
