import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  exercisesForMuscle,
  LOAD_LEVELS,
  muscleDef,
  muscleName,
  MUSCLES,
  type BodyView,
  type MuscleHit,
  type MuscleId,
  type MuscleRole,
  type SessionExercise,
  type SessionMuscles,
  type WeekMuscles,
} from "@/domain/training/anatomy";
import { muscleLabel } from "@/domain/training/catalog";
import type { BodyFigure, Exercise } from "@/domain/types";
import { formatNumber } from "@/domain/units";
import { Segmented } from "@/ui/Segmented";
import { joinList } from "../../onboarding/preferences";
import { BodyMap, type RegionTone } from "./BodyMap";
import "./bodymap.css";

export type MuscleMapData =
  | {
      mode: "session";
      session: SessionMuscles;
      /** «esta sesión», «la sesión de hoy»… */ scope: string;
    }
  | {
      mode: "week";
      week: WeekMuscles;
      /** «esta semana» or «la semana pasada» */ scope: string;
    };

interface Props {
  figure: BodyFigure;
  data: MuscleMapData;
  /** Exercises offered as ideas for a muscle the data does not reach. */
  library: readonly Exercise[];
  /** Shown instead of the summary when nothing is drawn. */
  empty?: ReactNode;
  className?: string;
}

const VIEWS: { value: BodyView; label: string }[] = [
  { value: "front", label: "Frente" },
  { value: "back", label: "Espalda" },
];

const roleLabel = (r: MuscleRole) =>
  r === "primary" ? "principal" : "secundario";
const sets = (n: number) =>
  `${formatNumber(n, 1)} ${n === 1 ? "serie" : "series"}`;

function tonesOf(data: MuscleMapData): Partial<Record<MuscleId, RegionTone>> {
  const out: Partial<Record<MuscleId, RegionTone>> = {};
  if (data.mode === "session") {
    for (const st of Object.values(data.session.muscles))
      out[st.id] = { fill: st.done, pending: st.pending };
  } else {
    for (const st of Object.values(data.week.muscles))
      out[st.id] = { fill: `l${st.level}`, pending: null };
  }
  return out;
}

/** The view that shows most of what is drawn, so the first look lands on the work. */
function mainView(data: MuscleMapData): BodyView {
  let front = 0;
  let back = 0;
  const add = (id: MuscleId, w: number) => {
    if (muscleDef(id).views[0] === "back") back += w;
    else front += w;
  };
  if (data.mode === "session") {
    for (const st of Object.values(data.session.muscles))
      add(st.id, st.done === "primary" || st.pending === "primary" ? 2 : 1);
  } else {
    for (const st of Object.values(data.week.muscles)) add(st.id, st.effective);
  }
  return back > front ? "back" : "front";
}

/** Short notes for work the map cannot draw, so an empty region is never mistaken for missing data. */
function mapNotes(
  unmapped: readonly SessionExercise[],
  approximate: readonly SessionExercise[],
): string[] {
  const notes: string[] = [];
  const names = (xs: readonly SessionExercise[]) =>
    joinList([...new Set(xs.map((x) => x.name))]);
  const conditioning = unmapped.filter(
    (e) => e.muscles.reason === "conditioning",
  );
  const general = unmapped.filter((e) => e.muscles.reason === "general");
  const unknown = unmapped.filter((e) => e.muscles.reason === "unknown");
  if (conditioning.length)
    notes.push(
      `${names(conditioning)}: cardio, movilidad o recuperación, no marcan músculos.`,
    );
  if (general.length)
    notes.push(`${names(general)}: cuerpo completo sin detalle de músculos.`);
  if (unknown.length)
    notes.push(
      unknown.length === 1
        ? "Un ejercicio eliminado no tiene datos musculares."
        : `${unknown.length} ejercicios eliminados no tienen datos musculares.`,
    );
  if (approximate.length)
    notes.push(
      `${names(approximate)}: ejercicio personalizado, se marca su grupo muscular completo.`,
    );
  return notes;
}

export function MuscleMap({ figure, data, library, empty, className }: Props) {
  const [view, setView] = useState<BodyView>(() => mainView(data));
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const tones = tonesOf(data);
  const drawn = Object.keys(tones).length > 0;

  const select = (id: MuscleId | null) => {
    setSelected((cur) => (cur === id ? null : id));
    if (id && !muscleDef(id).views.includes(view))
      setView(muscleDef(id).views[0]!);
  };

  const describe = (id: MuscleId) => {
    const name = muscleName(id);
    if (data.mode === "week") {
      const st = data.week.muscles[id];
      return st
        ? `${name}: ${sets(st.effective)} ${data.scope}`
        : `${name}: sin trabajar ${data.scope}`;
    }
    const st = data.session.muscles[id];
    if (!st) return `${name}: sin trabajar`;
    const parts = [
      st.done && `${roleLabel(st.done)}, hecho`,
      st.pending && `${roleLabel(st.pending)}, pendiente`,
    ].filter(Boolean);
    return `${name}: ${parts.join("; ")}`;
  };

  const figs = (["front", "back"] as const).map((v) => (
    <figure key={v} className={`mmap__fig mmap__fig--${v}`}>
      <BodyMap
        figure={figure}
        view={v}
        tones={tones}
        selected={selected}
        onSelect={select}
        describe={describe}
      />
      <figcaption className="mmap__cap">
        {v === "front" ? "Frente" : "Espalda"}
      </figcaption>
    </figure>
  ));

  return (
    <div
      className={["mmap", className].filter(Boolean).join(" ")}
      data-view={view}
      data-mode={data.mode}
    >
      <div className="mmap__body">
        <div className="mmap__figs">{figs}</div>
        <div className="mmap__side">
          <div className="mmap__toggle">
            <Segmented
              label="Vista del cuerpo"
              options={VIEWS}
              value={view}
              onChange={setView}
              block
            />
          </div>
          <div className="mmap__panel" aria-live="polite">
            {selected ? (
              <MuscleInfo
                id={selected}
                data={data}
                library={library}
                onClose={() => setSelected(null)}
              />
            ) : drawn ? (
              <Summary data={data} onPick={select} />
            ) : (
              <div className="mmap__empty">
                {empty}
                <p className="mmap__hint">
                  Toca un músculo para ver qué ejercicios lo trabajan.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ data }: { data: MuscleMapData }) {
  if (data.mode === "week") {
    return (
      <ul className="mmap__legend" aria-label="Leyenda">
        {LOAD_LEVELS.map((l) => (
          <li key={l.level}>
            <span
              className="mmap__key"
              data-fill={`l${l.level}`}
              aria-hidden="true"
            />
            {l.label}
          </li>
        ))}
      </ul>
    );
  }
  const states = Object.values(data.session.muscles);
  const pending = states.some((s) => s.pending);
  const done = states.some((s) => s.done);
  return (
    <ul className="mmap__legend" aria-label="Leyenda">
      {done && (
        <>
          <li>
            <span
              className="mmap__key"
              data-fill="primary"
              aria-hidden="true"
            />
            Principal
          </li>
          <li>
            <span
              className="mmap__key"
              data-fill="secondary"
              aria-hidden="true"
            />
            Secundario
          </li>
        </>
      )}
      {pending && (
        <li>
          <span
            className="mmap__key"
            data-pending="primary"
            aria-hidden="true"
          />
          {done ? "Pendiente" : "Planificado"}
        </li>
      )}
    </ul>
  );
}

const CHIP_LIMIT = 5;

function Summary({
  data,
  onPick,
}: {
  data: MuscleMapData;
  onPick: (id: MuscleId) => void;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const order = (id: MuscleId) => MUSCLES.findIndex((m) => m.id === id);
  let groups: {
    label: string;
    neutral?: boolean;
    items: { id: MuscleId; note?: string; pending?: boolean }[];
  }[];
  let notes: string[];
  if (data.mode === "session") {
    const states = Object.values(data.session.muscles).sort(
      (a, b) => order(a.id) - order(b.id),
    );
    const strongest = (s: (typeof states)[number]) =>
      s.done === "primary" || s.pending === "primary" ? "primary" : "secondary";
    groups = [
      {
        label: "Principales",
        items: states
          .filter((s) => strongest(s) === "primary")
          .map((s) => ({ id: s.id, pending: !s.done })),
      },
      {
        label: "Secundarios",
        items: states
          .filter((s) => strongest(s) === "secondary")
          .map((s) => ({ id: s.id, pending: !s.done })),
      },
    ];
    notes = mapNotes(data.session.unmapped, data.session.approximate);
  } else {
    const states = Object.values(data.week.muscles).sort(
      (a, b) => b.effective - a.effective,
    );
    const untouched = MUSCLES.filter((m) => !data.week.muscles[m.id]);
    groups = [
      {
        label: "Más trabajados",
        items: states
          .slice(0, 5)
          .map((s) => ({ id: s.id, note: formatNumber(s.effective, 1) })),
      },
      {
        label: "Sin trabajar",
        neutral: true,
        items: untouched.map((m) => ({ id: m.id })),
      },
    ];
    notes = mapNotes(data.week.unmapped, data.week.approximate);
  }
  return (
    <div className="mmap__summary">
      <Legend data={data} />
      {groups
        .filter((g) => g.items.length)
        .map((g) => {
          const expanded =
            open.includes(g.label) || g.items.length <= CHIP_LIMIT + 1;
          const shown = expanded ? g.items : g.items.slice(0, CHIP_LIMIT);
          return (
            <div key={g.label} className="mmap__group">
              <p className="mmap__label">{g.label}</p>
              <div className="mmap__chips">
                {shown.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="mmap__chip"
                    data-pending={it.pending || undefined}
                    data-neutral={g.neutral || undefined}
                    onClick={() => onPick(it.id)}
                  >
                    {muscleName(it.id)}
                    {it.note && <span className="mmap__chip-n">{it.note}</span>}
                  </button>
                ))}
                {!expanded && (
                  <button
                    type="button"
                    className="mmap__chip"
                    data-neutral
                    onClick={() => setOpen((o) => [...o, g.label])}
                    aria-label={`Ver ${g.items.length - CHIP_LIMIT} más en ${g.label.toLowerCase()}`}
                  >
                    +{g.items.length - CHIP_LIMIT}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      {data.mode === "week" && (
        <p className="mmap__fine">
          Series hechas {data.scope}; las secundarias cuentan la mitad.
        </p>
      )}
      {notes.map((n) => (
        <p key={n} className="mmap__note">
          {n}
        </p>
      ))}
      <p className="mmap__hint">Toca un músculo para ver sus ejercicios.</p>
    </div>
  );
}

function HitList({ hits, week }: { hits: MuscleHit[]; week: boolean }) {
  return (
    <ul className="mmap__hits">
      {hits.map((h) => (
        <li key={`${h.exerciseId}-${h.role}`}>
          <span className="mmap__hit-name">{h.name}</span>
          <span className="mmap__hit-meta">
            {h.role === "primary" ? "Principal" : "Secundario"} ·{" "}
            {week
              ? sets(h.done)
              : h.total
                ? `${h.done}/${h.total} series`
                : "sin series"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MuscleInfo({
  id,
  data,
  library,
  onClose,
}: {
  id: MuscleId;
  data: MuscleMapData;
  library: readonly Exercise[];
  onClose: () => void;
}) {
  const def = muscleDef(id);
  let state: ReactNode;
  let hits: MuscleHit[] = [];
  if (data.mode === "session") {
    const st = data.session.muscles[id];
    hits = st?.hits ?? [];
    if (!st) state = `No se trabaja en ${data.scope}.`;
    else {
      const parts: string[] = [];
      if (st.done)
        parts.push(
          `${st.done === "primary" ? "Principal" : "Secundario"} · ${st.direct + st.indirect} ${st.direct + st.indirect === 1 ? "serie hecha" : "series hechas"}`,
        );
      if (st.pending)
        parts.push(
          `${st.pending === "primary" ? "Principal" : "Secundario"} pendiente`,
        );
      state = parts.join(" · ");
    }
  } else {
    const st = data.week.muscles[id];
    hits = st?.hits ?? [];
    state = st
      ? `${sets(st.direct)} directas · ${sets(st.indirect)} indirectas · ${st.sessions} ${st.sessions === 1 ? "sesión" : "sesiones"}`
      : `Sin series ${data.scope}.`;
  }
  const ideas = hits.length ? [] : exercisesForMuscle(id, library).slice(0, 4);
  return (
    <div className="mmap__info">
      <div className="mmap__info-head">
        <h3 className="mmap__info-name">{def.label}</h3>
        <button
          type="button"
          className="mmap__close"
          onClick={onClose}
          aria-label="Cerrar detalle del músculo"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <p className="mmap__info-group">Grupo: {muscleLabel(def.group)}</p>
      <p className="mmap__info-state">{state}</p>
      {hits.length > 0 && <HitList hits={hits} week={data.mode === "week"} />}
      {ideas.length > 0 && (
        <>
          <p className="mmap__label">Ejercicios que lo trabajan</p>
          <ul className="mmap__hits">
            {ideas.map(({ exercise, role }) => (
              <li key={exercise.id}>
                <span className="mmap__hit-name">{exercise.name}</span>
                <span className="mmap__hit-meta">
                  {role === "primary" ? "Principal" : "Secundario"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
