import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { sourceLabel } from '@/domain/nutrition/meals';
import { kcalToKj, scaleNutrients } from '@/domain/nutrition/nutrients';
import type { UsdaFood } from '@/domain/nutrition/usda';
import { formatInt, formatNumber, parseDecimal } from '@/domain/units';
import { Button, IconButton } from '@/ui/Button';
import { NumberField, TextField } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { clampGrams, dataTypeLabel, MAX_GRAMS, type DraftItem } from './draft';

interface Props {
  item: DraftItem | undefined;
  open: boolean;
  onClose: () => void;
  onGrams: (grams: number) => void;
  onRename: (name: string) => void;
  onChoose: (food: UsdaFood) => void;
  onSearch: () => void;
  onRemove: () => void;
}

/** One food of the meal: amount, name and which database entry it uses. */
export function ItemSheet({ item, open, onClose, ...actions }: Props) {
  return (
    <Sheet open={open && !!item} onClose={onClose} title={item?.name ?? 'Alimento'} footer={<Button block onClick={onClose}>Listo</Button>}>
      {item && <ItemEditor key={item.key} item={item} {...actions} />}
    </Sheet>
  );
}

function ItemEditor({ item, onGrams, onRename, onChoose, onSearch, onRemove }: Omit<Props, 'item' | 'open' | 'onClose'> & { item: DraftItem }) {
  const unit = item.unit ?? 'g';
  const [text, setText] = useState(String(item.grams));
  const [name, setName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(item.grams);
  // Follow amount changes made with the buttons.
  if (item.grams !== synced) {
    setSynced(item.grams);
    setText(String(item.grams));
  }

  const commit = (raw: string) => {
    const v = parseDecimal(raw);
    if (v === null || v <= 0 || v > MAX_GRAMS) {
      setError(`Escribe una cantidad entre 1 y ${formatInt(MAX_GRAMS)} ${unit}.`);
      return;
    }
    setError(null);
    onGrams(clampGrams(v));
  };
  const step = item.grams < 50 ? 5 : 10;
  const presets = item.serving
    ? [
        { label: `½ ración`, grams: item.serving.grams / 2 },
        { label: `1 ración (${formatInt(item.serving.grams)} ${unit})`, grams: item.serving.grams },
        { label: '2 raciones', grams: item.serving.grams * 2 },
      ]
    : [50, 100, 150, 200, 250].map((g) => ({ label: `${g} ${unit}`, grams: g }));
  const values = item.status === 'ok' && item.per100 ? scaleNutrients(item.per100, item.grams) : null;

  return (
    <div className="item-edit">
      <div className="item-edit__amount">
        <IconButton label={`Quitar ${step} ${unit}`} onClick={() => onGrams(clampGrams(item.grams - step))} disabled={item.grams <= 1}>
          <Minus />
        </IconButton>
        <NumberField
          label={`Cantidad (${unit})`}
          hideLabel
          value={text}
          suffix={unit}
          size="lg"
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          }}
          error={error}
          fieldClassName="item-edit__field"
        />
        <IconButton label={`Añadir ${step} ${unit}`} onClick={() => onGrams(clampGrams(item.grams + step))} disabled={item.grams >= MAX_GRAMS}>
          <Plus />
        </IconButton>
      </div>
      <div className="item-edit__presets" role="group" aria-label="Cantidades habituales">
        {presets.map((p) => (
          <button key={p.label} type="button" className="chip" aria-pressed={Math.round(p.grams) === item.grams} onClick={() => onGrams(clampGrams(p.grams))}>
            {p.label}
          </button>
        ))}
      </div>
      {item.amount === 'photo' && <p className="t-small">Cantidad estimada en la foto. Si la pesas o la conoces, ajústala.</p>}

      {values && item.per100 && (
        <div className="item-edit__values">
          <p>
            <strong className="t-num">{formatInt(values.kcal)} kcal</strong> <span className="t-small t-num">({formatInt(kcalToKj(values.kcal))} kJ)</span>
          </p>
          <p className="t-small t-num">
            Proteína {formatNumber(values.protein, 1)} g · Hidratos {formatNumber(values.carbs, 1)} g · Grasa {formatNumber(values.fat, 1)} g
          </p>
          <p className="t-small t-num">
            Por 100 {unit}: {formatInt(item.per100.kcal)} kcal · P {formatNumber(item.per100.protein, 1)} · H {formatNumber(item.per100.carbs, 1)} · G{' '}
            {formatNumber(item.per100.fat, 1)}
          </p>
          {item.source && <p className="item-edit__source">{sourceLabel(item.source)}</p>}
        </div>
      )}

      <TextField
        label="Nombre"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== item.name && onRename(name.trim())}
      />

      {item.alternatives.length > 0 && (
        <div className="item-edit__alts">
          <h3 className="t-eyebrow">Otras coincidencias</h3>
          <ul>
            {item.alternatives.slice(0, 4).map((f) => {
              const current = item.source?.kind === 'usda' && item.source.id === f.fdcId;
              return (
                <li key={f.fdcId}>
                  <button type="button" className="alt" aria-pressed={current} onClick={() => onChoose(f)}>
                    <span className="alt__name">{f.description}</span>
                    <span className="alt__meta t-num">
                      {formatInt(f.per100.kcal)} kcal/100 g · {dataTypeLabel(f.dataType)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="item-edit__actions">
        <Button variant="secondary" icon={<Search />} onClick={onSearch}>
          Buscar otro alimento
        </Button>
        <Button variant="ghost" icon={<Trash2 />} onClick={onRemove}>
          Quitar
        </Button>
      </div>
    </div>
  );
}
