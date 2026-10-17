import { useState } from 'react';
import { isPlausiblePer100, OPTIONAL_NUTRIENTS, scaleNutrients } from '@/domain/nutrition/nutrients';
import type { Nutrients } from '@/domain/types';
import { parseDecimal } from '@/domain/units';
import { Button } from '@/ui/Button';
import { NumberField, TextField } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { MAX_GRAMS } from './draft';

export interface ManualFood {
  name: string;
  grams: number;
  per100: Nutrients;
}

interface Props {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onSubmit: (food: ManualFood) => void;
  title?: string;
  submitLabel?: string;
}

type Field = 'kcal' | 'protein' | 'carbs' | 'fat' | 'satFat' | 'fiber' | 'sugars';

const FIELDS: { key: Field; label: string; unit: string; required: boolean }[] = [
  { key: 'kcal', label: 'Calorías', unit: 'kcal', required: true },
  { key: 'protein', label: 'Proteína', unit: 'g', required: true },
  { key: 'carbs', label: 'Hidratos de carbono', unit: 'g', required: true },
  { key: 'fat', label: 'Grasa', unit: 'g', required: true },
  { key: 'satFat', label: 'Grasa saturada', unit: 'g', required: false },
  { key: 'fiber', label: 'Fibra', unit: 'g', required: false },
  { key: 'sugars', label: 'Azúcares', unit: 'g', required: false },
];

/** Values typed from a label: per 100 g or for the amount eaten. Nothing is filled in for the user. */
export function ManualFoodSheet({ open, onClose, ...rest }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={rest.title ?? 'Introducir valores'} description="Cópialos de la etiqueta o de una fuente fiable.">
      <ManualForm {...rest} />
    </Sheet>
  );
}

function ManualForm({ initialName, onSubmit, submitLabel }: Omit<Props, 'open' | 'onClose' | 'title'>) {
  const [name, setName] = useState(initialName ?? '');
  const [grams, setGrams] = useState('100');
  const [basis, setBasis] = useState<'per100' | 'amount'>('per100');
  const [values, setValues] = useState<Record<Field, string>>({ kcal: '', protein: '', carbs: '', fat: '', satFat: '', fiber: '', sugars: '' });
  const [errors, setErrors] = useState<Partial<Record<Field | 'name' | 'grams' | 'form', string>>>({});

  const submit = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Escribe el nombre del alimento.';
    const g = parseDecimal(grams);
    if (g === null || g <= 0 || g > MAX_GRAMS) next.grams = 'Escribe una cantidad entre 1 y 5.000 g.';
    const parsed: Partial<Record<Field, number>> = {};
    for (const f of FIELDS) {
      const raw = values[f.key].trim();
      if (!raw) {
        if (f.required) next[f.key] = 'Obligatorio.';
        continue;
      }
      const v = parseDecimal(raw);
      if (v === null || v < 0) next[f.key] = 'Número no válido.';
      else parsed[f.key] = v;
    }
    if (Object.keys(next).length || g === null) {
      setErrors(next);
      return;
    }
    const given: Nutrients = { kcal: parsed.kcal!, protein: parsed.protein!, carbs: parsed.carbs!, fat: parsed.fat! };
    for (const k of OPTIONAL_NUTRIENTS) if (parsed[k] !== undefined) given[k] = parsed[k];
    const per100 = basis === 'per100' ? given : scaleNutrients(given, (100 / g) * 100);
    if (!isPlausiblePer100(per100)) {
      setErrors({ form: 'Los valores no cuadran (por ejemplo, más de 100 g de nutrientes por cada 100 g). Revisa si son por 100 g o para la cantidad indicada.' });
      return;
    }
    setErrors({});
    onSubmit({ name: name.trim().slice(0, 80), grams: Math.round(g), per100 });
  };

  return (
    <form
      className="manual-food"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextField label="Alimento" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} error={errors.name} placeholder="Ej.: Yogur natural" data-autofocus />
      <NumberField label="Cantidad que has tomado" value={grams} onChange={(e) => setGrams(e.target.value)} suffix="g" error={errors.grams} />
      <Segmented
        label="Los valores son"
        options={[
          { value: 'per100', label: 'Por 100 g' },
          { value: 'amount', label: 'Para esa cantidad' },
        ]}
        value={basis}
        onChange={setBasis}
        block
      />
      <div className="manual-food__grid">
        {FIELDS.map((f) => (
          <NumberField
            key={f.key}
            label={f.required ? f.label : `${f.label} (opcional)`}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            suffix={f.unit}
            error={errors[f.key]}
          />
        ))}
      </div>
      {errors.form && (
        <p className="field__error" role="alert">
          {errors.form}
        </p>
      )}
      <Button type="submit" block>
        {submitLabel ?? 'Usar estos valores'}
      </Button>
    </form>
  );
}
