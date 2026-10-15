import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeights } from '@/db/hooks';
import { getActiveWorkout } from '@/db/repos/training';
import { addWater } from '@/db/repos/tracking';
import { todayKey } from '@/domain/dates';
import type { Profile } from '@/domain/types';
import { latestWeight } from '@/domain/weight';
import { spring } from '@/ui/motion';
import { cheer, subscribeCheer } from '@/ui/cheer';
import { toast, toastError } from '@/ui/toast';
import { isLateHour, type MascotExpression } from '../mascot/expression';
import { Mascot, type MascotHandle } from '../mascot/Mascot';
import { StepsSheet } from '../shared/sheets/StepsSheet';
import { WaterSheet } from '../shared/sheets/WaterSheet';
import { WeightSheet } from '../shared/sheets/WeightSheet';
import { unitsApi } from '../shared/units';
import { dockPoint, rubberBand, settle, type DockArea } from './geometry';
import { setRumbiPrefs, useRumbiPrefs } from './prefs';
import { RumbiPanel, type QuickLog } from './RumbiPanel';
import './assistant.css';

const SIZE = 56;
/** Rumbi tucks into the edge after this long without being touched. */
const IDLE_MS = 2800;
const FIRST_IDLE_MS = 4500;
/** Movement (px) before a press becomes a drag. */
const DRAG_SLOP = 6;

let safeProbe: HTMLDivElement | null = null;
/** The bottom safe-area inset (home indicator), read from a hidden probe since env() is CSS-only. */
function safeBottom(): number {
  if (!safeProbe) {
    safeProbe = document.createElement('div');
    safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)';
    document.body.appendChild(safeProbe);
  }
  return parseFloat(getComputedStyle(safeProbe).paddingBottom) || 0;
}

const visibleRect = (selector: string) => {
  const r = document.querySelector(selector)?.getBoundingClientRect();
  return r && r.width > 0 && r.height > 0 ? r : null;
};

/**
 * The free band Rumbi may rest in: below the header (and a sticky session
 * bar), above the tab bar and anything docked over it (the rest timer, a
 * toast), clear of the desktop sidebar.
 */
function measureArea(): DockArea {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = vw < 640 ? 8 : 18;
  const header = visibleRect('.topbar');
  let top = (header?.bottom ?? 0) + 10;
  const bar = document.querySelector<HTMLElement>('.session-bar');
  if (bar?.offsetHeight) top = Math.max(top, (header?.bottom ?? 0) + bar.offsetHeight + 14);
  let bottom = vh - safeBottom() - 14;
  for (const sel of ['.tabbar', '.rest']) {
    const r = visibleRect(sel);
    if (r) bottom = Math.min(bottom, r.top - 10);
  }
  for (const el of document.querySelectorAll('.toast')) {
    const r = el.getBoundingClientRect();
    if (r.height) bottom = Math.min(bottom, r.top - 10);
  }
  const sidebar = visibleRect('.sidebar');
  // Never let the band collapse on tiny or landscape screens.
  if (bottom - top < SIZE + 20) bottom = Math.min(vh - 8, top + SIZE + 20);
  return { left: sidebar ? sidebar.right + margin : margin, right: vw - margin, top, bottom, edgeToEdge: !sidebar };
}

const sameArea = (a: DockArea, b: DockArea) =>
  a.left === b.left && a.right === b.right && Math.abs(a.top - b.top) < 1 && Math.abs(a.bottom - b.bottom) < 1 && a.edgeToEdge === b.edgeToEdge;

const isTextField = (el: Element | null) =>
  !!el?.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]), textarea, select, [contenteditable="true"]');

interface DockProps {
  hidden: boolean;
  onOpen: () => void;
}

/**
 * The floating button: Rumbi rests on a screen edge like the iPhone's
 * AssistiveTouch. Drag it anywhere; on release it springs to the nearer edge
 * (or the one a flick points to) and remembers the spot. After a few seconds
 * untouched it tucks partly into the edge and holds still, so it never
 * covers navigation, forms or charts for long; it steps aside for dialogs,
 * the on-screen keyboard, the rest timer and toasts.
 */
function RumbiDock({ hidden, onOpen }: DockProps) {
  const prefs = useRumbiPrefs();
  const reduce = !!useReducedMotion();
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const mascot = useRef<MascotHandle>(null);
  const [area, setArea] = useState<DockArea | null>(null);
  const [modal, setModal] = useState(false);
  const [typing, setTyping] = useState(false);
  const [tucked, setTucked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [beat, setBeat] = useState<MascotExpression | null>(null);
  const drag = useRef<{ id: number; px: number; py: number; x: number; y: number; moved: boolean; lastX: number; lastT: number; vx: number } | null>(null);
  const suppressClick = useRef(false);
  const idleTimer = useRef(0);
  const placed = useRef(false);
  /** Where the drop animation is already heading, so the re-dock that follows doesn't restart it. */
  const aimed = useRef<{ x: number; y: number } | null>(null);

  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  });

  // Watch the page for what Rumbi must make room for or hide behind. Checks are
  // batched (a counting number or a timer changes the DOM many times a second).
  useEffect(() => {
    let timer = 0;
    const check = () => {
      timer = 0;
      setModal(!!document.querySelector('[aria-modal="true"]'));
      const next = measureArea();
      if (!placed.current) {
        // Place Rumbi before the button first renders, so it appears on its spot.
        const p = dockPoint(prefsRef.current.side, prefsRef.current.y, next, SIZE, false);
        x.set(p.x);
        y.set(p.y);
        placed.current = true;
      }
      setArea((prev) => (prev && sameArea(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (!timer) timer = window.setTimeout(check, 90);
    };
    check();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      mo.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [x, y]);

  // On touch screens the keyboard covers the bottom half: Rumbi steps out while typing.
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const update = () => setTyping(coarse.matches && isTextField(document.activeElement));
    const onFocusOut = () => window.setTimeout(update, 0);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const scheduleTuck = useCallback((ms = IDLE_MS) => {
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      if (!drag.current) setTucked(true);
    }, ms);
  }, []);

  const wake = useCallback(
    (ms?: number) => {
      setTucked(false);
      scheduleTuck(ms);
    },
    [scheduleTuck],
  );

  useEffect(() => {
    scheduleTuck(FIRST_IDLE_MS);
    // Reading or scrolling: get out of the way at once.
    const onScroll = () => {
      if (!drag.current) setTucked(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(idleTimer.current);
      window.removeEventListener('scroll', onScroll);
    };
  }, [scheduleTuck]);

  // A record saved or a workout finished gets a small celebration.
  useEffect(() => {
    let timer = 0;
    const unsubscribe = subscribeCheer(() => {
      wake();
      setBeat('proud');
      mascot.current?.tap();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBeat(null), 1800);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [wake]);

  // Rest on the remembered edge; follow layout changes (rotation, tab bar, rest timer…).
  useLayoutEffect(() => {
    if (!area || drag.current) return;
    const target = dockPoint(prefs.side, prefs.y, area, SIZE, tucked);
    const heading = aimed.current;
    aimed.current = null;
    if (heading && Math.abs(heading.x - target.x) < 0.5 && Math.abs(heading.y - target.y) < 0.5) return;
    if (reduce) {
      x.set(target.x);
      y.set(target.y);
      return;
    }
    const cx = animate(x, target.x, spring.soft);
    const cy = animate(y, target.y, spring.soft);
    return () => {
      cx.stop();
      cy.stop();
    };
  }, [area, prefs.side, prefs.y, tucked, reduce, x, y]);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, px: e.clientX, py: e.clientY, x: x.get(), y: y.get(), moved: false, lastX: e.clientX, lastT: e.timeStamp, vx: 0 };
    suppressClick.current = false;
    window.clearTimeout(idleTimer.current);
    mascot.current?.press();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) return;
      d.moved = true;
      window.clearTimeout(idleTimer.current);
      setDragging(true);
      setTucked(false);
      mascot.current?.cancelPress();
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.vx = d.vx * 0.4 + ((e.clientX - d.lastX) / dt) * 1000 * 0.6;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    x.set(rubberBand(d.x + dx, -SIZE / 2, window.innerWidth - SIZE / 2));
    y.set(rubberBand(d.y + dy, 0, window.innerHeight - SIZE));
  };

  const finish = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) {
      mascot.current?.cancelPress();
      scheduleTuck();
      return;
    }
    suppressClick.current = true;
    setDragging(false);
    setTucked(false);
    const now = area ?? measureArea();
    const spot = settle({ x: x.get(), y: y.get() }, now, SIZE, e.timeStamp - d.lastT < 80 ? d.vx : 0);
    // Even when the spot is unchanged, spring back onto the edge.
    const target = dockPoint(spot.side, spot.y, now, SIZE, false);
    if (reduce) {
      x.set(target.x);
      y.set(target.y);
    } else {
      animate(x, target.x, { ...spring.bouncy, velocity: d.vx });
      animate(y, target.y, spring.soft);
    }
    aimed.current = target;
    setRumbiPrefs({ side: spot.side, y: spot.y });
    scheduleTuck();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = 0.08;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setRumbiPrefs({ y: Math.min(1, Math.max(0, prefs.y + (e.key === 'ArrowUp' ? -step : step))) });
      wake();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setRumbiPrefs({ side: e.key === 'ArrowLeft' ? 'left' : 'right' });
      wake();
    }
  };

  const away = hidden || modal || typing || !area;
  // Stepping aside mid-drag (a dialog opened) ends the drag; Rumbi comes back to its spot.
  const [wasAway, setWasAway] = useState(away);
  if (away !== wasAway) {
    setWasAway(away);
    if (away && dragging) setDragging(false);
  }
  useEffect(() => {
    if (away) drag.current = null;
  }, [away]);
  const face: MascotExpression = beat ?? (dragging ? 'surprised' : isLateHour(new Date().getHours()) ? 'sleepy' : 'happy');

  return (
    <AnimatePresence>
      {!away && (
        <motion.button
          key="rumbi-fab"
          type="button"
          className="rumbi-fab"
          data-dragging={dragging}
          data-tucked={tucked && !dragging}
          style={{ x, y }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: tucked && !dragging ? 0.82 : 1, scale: dragging ? 1.1 : tucked ? 0.88 : 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, transition: { duration: 0.16 } }}
          transition={spring.bouncy}
          aria-label="Abrir a Rumbi: consejos, atajos y ayuda"
          aria-haspopup="dialog"
          aria-describedby="rumbi-fab-hint"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (!drag.current) wake();
          }}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            mascot.current?.tap();
            onOpen();
          }}
        >
          <span className="rumbi-fab__disc" aria-hidden="true" />
          <Mascot handle={mascot} expression={face} size={SIZE - 8} paused={tucked && !dragging && !beat} className="rumbi-fab__mascot" />
          <span id="rumbi-fab-hint" className="sr-only">
            Arrástralo o usa las flechas para moverlo.
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/**
 * Floating Rumbi on every screen of the app (when enabled in Perfil ›
 * Apariencia), with its panel and the quick-logging sheets it opens.
 */
export function RumbiAssistant({ profile }: { profile: Profile }) {
  const prefs = useRumbiPrefs();
  const navigate = useNavigate();
  const weights = useWeights();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<QuickLog | null>(null);
  const u = unitsApi(profile.units);

  if (!prefs.enabled) return null;

  const quickWater = async () => {
    try {
      await addWater(todayKey(), 250);
      toast(`+${u.volume(250)} de agua`, { tone: 'success' });
      cheer();
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <>
      <RumbiDock hidden={open} onOpen={() => setOpen(true)} />
      <RumbiPanel
        open={open}
        onClose={() => setOpen(false)}
        profile={profile}
        onLog={(what) => {
          setOpen(false);
          setLog(what);
        }}
        onQuickWater={quickWater}
        onTrain={async () => {
          setOpen(false);
          const active = await getActiveWorkout().catch(() => undefined);
          navigate(active ? '/entreno/sesion' : '/entreno');
        }}
        onHide={() => {
          setOpen(false);
          setRumbiPrefs({ enabled: false });
          toast('Rumbi se ha ocultado. Vuelve a mostrarlo en Perfil › Apariencia.', {
            tone: 'info',
            action: { label: 'Deshacer', onClick: () => setRumbiPrefs({ enabled: true }) },
          });
        }}
      />
      <WeightSheet open={log === 'weight'} onClose={() => setLog(null)} units={profile.units} lastKg={weights ? latestWeight(weights)?.kg : undefined} />
      <WaterSheet open={log === 'water'} onClose={() => setLog(null)} units={profile.units} />
      <StepsSheet open={log === 'steps'} onClose={() => setLog(null)} />
    </>
  );
}

export default RumbiAssistant;
