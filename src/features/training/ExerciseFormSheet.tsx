import { useEffect, useState } from 'react';
import { createExercise, updateExercise } from '@/db/repos/training';
import { MEASURE_LABELS, MUSCLE_GROUPS } from '@/domain/training/catalog';
import type { Exercise, ExerciseMeasure, MuscleGroup } from '@/domain/types';
import { Button } from '@/ui/Button';
import { SelectField, TextAreaField, TextField } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { toast, toastError } from '@/ui/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  exercise?: Exercise | null;
  defaultMuscle?: MuscleGroup;
  onCreated?: (id: string) => void;
}

export function ExerciseFormSheet({ open, onClose, exercise, defaultMuscle, onCreated }: Props) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [measure, setMeasure] = useState<ExerciseMeasure>('weight_reps');
  const [equipment, setEquipment] = useState('');
  const [tip, setTip] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(exercise?.name ?? '');
    setMuscle(exercise?.muscle ?? defaultMuscle ?? 'chest');
    setMeasure(exercise?.measure ?? 'weight_reps');
    setEquipment(exercise?.equipment === 'Personalizado' ? '' : (exercise?.equipment ?? ''));
    setTip(exercise?.tip ?? '');
    setError(null);
  }, [open, exercise, defaultMuscle]);

  const save = async () => {
    if (!name.trim()) {
      setError('Ponle un nombre al ejercicio.');
      return;
    }
    setBusy(true);
    try {
      const input = { name, muscle, measure, equipment, tip };
      if (exercise) {
        await updateExercise(exercise.id, input);
        toast('Ejercicio actualizado');
      } else {
        const id = await createExercise(input);
        onCreated?.(id);
        toast('Ejercicio creado');
      }
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
      title={exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}
      locked={busy}
      footer={
        <Button block onClick={save} loading={busy}>
          {exercise ? 'Guardar cambios' : 'Crear ejercicio'}
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
        <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} error={error} data-autofocus />
        <div className="grid-2">
          <SelectField label="Grupo muscular" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup)} options={MUSCLE_GROUPS.map((m) => ({ value: m.id, label: m.label }))} />
          <SelectField
            label="Se mide por"
            value={measure}
            onChange={(e) => setMeasure(e.target.value as ExerciseMeasure)}
            options={(Object.keys(MEASURE_LABELS) as ExerciseMeasure[]).map((k) => ({ value: k, label: MEASURE_LABELS[k] }))}
          />
        </div>
        <TextField label="Material (opcional)" value={equipment} onChange={(e) => setEquipment(e.target.value)} maxLength={40} placeholder="Mancuernas, polea, máquina…" />
        <TextAreaField label="Indicaciones técnicas (opcional)" value={tip} onChange={(e) => setTip(e.target.value)} rows={3} maxLength={280} />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
