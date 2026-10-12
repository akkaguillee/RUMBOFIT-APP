import type { MascotExpression } from './expression';
import { eyePath, GAZE_RANGE, placeEyes, POSES, type EyePlacement, type Pose } from './pose';

/*
 * Rumbi's rig: a small physics + timeline engine with no DOM or React in it.
 * Every expression is a set of spring targets, so any face morphs fluidly into
 * any other; blinks, glances, hops and the wake-up flicker are short timed
 * curves layered on top. The rig only runs a frame loop while Rumbi is on
 * screen, the page is visible and motion is allowed; a renderer receives one
 * `RigFrame` per frame and writes the few SVG attributes that changed.
 */

/** What the renderer writes into the SVG each frame. */
export interface RigFrame {
  /** transform of the body group (hop, squash and stretch, breathing). */
  body: string;
  /** transform and opacity of the contact shadow. */
  shadow: string;
  shadowOpacity: number;
  /** transform of the face group (head tilt). */
  face: string;
  left: string;
  right: string;
  eyeOpacity: number;
  glow: number;
  glowTransform: string;
  rim: number;
  warm: number;
  cool: number;
  badge: number;
  badgeTransform: string;
  dots: [number, number, number];
}

export interface RigRenderer {
  render(frame: RigFrame): void;
}

export interface RigOptions {
  reduced?: boolean;
  /** Seed of the deterministic blink and glance sequence. */
  seed?: number;
  /** Start with the eyes off and switch them on the first time Rumbi is seen. */
  wake?: boolean;
}

export type TapReaction = 'squint' | 'hop' | 'wink';
export const TAP_REACTIONS: readonly TapReaction[] = ['squint', 'hop', 'wink'];

/** Badge centre (thinking dots), top left of the body. */
const BADGE = { x: 21, y: 19 } as const;

/** Critically-to-lightly damped spring, integrated with small fixed steps. */
export class Spring {
  v = 0;
  target: number;
  constructor(
    public x: number,
    public k: number,
    public c: number,
  ) {
    this.target = x;
  }
  step(dt: number) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (-this.k * (this.x - this.target) - this.c * this.v) * h;
      this.x += this.v * h;
    }
  }
  snap(value = this.target) {
    this.target = value;
    this.x = value;
    this.v = 0;
  }
  get settled() {
    return Math.abs(this.x - this.target) < 1e-3 && Math.abs(this.v) < 1e-3;
  }
}

/** Mulberry32: small, fast, deterministic. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Eyelid curve for a blink of `dur` seconds at local time `tau`: closes fast
 * (ease-in), holds a moment and opens more slowly (ease-out). 0 open, 1 shut.
 */
export function blinkCurve(tau: number, dur: number): number {
  if (tau <= 0 || tau >= dur) return 0;
  const u = tau / dur;
  if (u < 0.32) return (u / 0.32) ** 2;
  if (u < 0.46) return 1;
  const o = (u - 0.46) / 0.54;
  return 1 - (1 - (1 - o) ** 3);
}

type ShapeKey = 'w' | 'h' | 'bend' | 'tilt' | 'y' | 'gap' | 'roll';
type MoodKey = 'glow' | 'rim' | 'warm' | 'cool' | 'badge';
const SHAPE: ShapeKey[] = ['w', 'h', 'bend', 'tilt', 'y', 'gap', 'roll'];
const MOOD: MoodKey[] = ['glow', 'rim', 'warm', 'cool', 'badge'];

interface Hop {
  start: number;
  height: number;
  crouched: boolean;
  landed: boolean;
}

/** Duration of a hop's flight (s) and of the crouch before it. */
const HOP_AIR = 0.4;
const HOP_CROUCH = 0.08;

const fx = (n: number) => n.toFixed(3);

export class MascotRig {
  private expression: MascotExpression;
  private reduced: boolean;
  private rand: () => number;
  private renderer: RigRenderer | null = null;

  private readonly shape = {} as Record<ShapeKey, Spring>;
  private readonly mood = {} as Record<MoodKey, Spring>;
  private readonly gazeX = new Spring(0, 150, 21);
  private readonly gazeY = new Spring(0, 150, 21);
  private readonly squashX = new Spring(1, 540, 19);
  private readonly squashY = new Spring(1, 540, 19);
  private readonly open: Spring;
  private readonly breath = new Spring(4.2, 6, 5);
  private readonly depth = new Spring(0.012, 6, 5);

  /** Rig clock (s): only advances while the loop runs, so nothing bursts after a pause. */
  private t = 0;
  private phase = 0;
  private nextBlink = 1.2;
  private blinks: { start: number; dur: number; eyes: 'both' | 'right' }[] = [];
  private nextGlance = 3;
  private glanceUntil = -1;
  private glanceSide = 1;
  private nextDrowsy = 4;
  private drowsy: { start: number; dur: number } | null = null;
  private hops: Hop[] = [];
  private overrides: { expression: MascotExpression; until: number }[] = [];
  private overrideRoll: { value: number; until: number } | null = null;
  private look: { x: number; y: number; at: number } | null = null;
  private wakeAt: number | null;
  private seen = false;
  private tapCount = 0;

  private visible = false;
  private pageVisible = true;
  private raf = 0;
  private last = 0;
  private timer = 0;
  private destroyed = false;

  constructor(expression: MascotExpression, options: RigOptions = {}) {
    this.expression = expression;
    this.reduced = !!options.reduced;
    this.rand = prng(options.seed ?? 7);
    const pose = POSES[expression];
    for (const key of SHAPE) this.shape[key] = new Spring(pose[key], 380, 26);
    this.shape.roll.k = 120;
    this.shape.roll.c = 18;
    for (const key of MOOD) this.mood[key] = new Spring(pose[key], 90, 19);
    this.gazeX.snap(pose.gazeX);
    this.gazeY.snap(pose.gazeY);
    this.breath.snap(pose.breath);
    this.depth.snap(pose.breathDepth);
    const sleeping = !!options.wake && !this.reduced;
    this.open = new Spring(sleeping ? 0 : 1, 260, 17);
    this.wakeAt = sleeping ? -1 : null;
  }

  /** The current frame, without advancing time (first paint, reduced motion, tests). */
  frame(): RigFrame {
    const s = this.shape;
    const wave = Math.sin(this.phase);
    const depth = this.reduced ? 0 : this.depth.x;
    const bx = 1 - depth * 0.5 * wave;
    const by = 1 + depth * wave;
    const bob = this.reduced ? 0 : -70 * depth * Math.sin(this.phase - 0.5);
    const lift = this.hopLift();
    const sx = this.squashX.x;
    const sy = this.squashY.x;
    const a = sx * bx;
    const d = sy * by;
    // Breathing scales around the centre, squash and stretch around the base (y 90).
    const body = `matrix(${fx(a)} 0 0 ${fx(d)} ${fx(50 * (1 - a))} ${fx(90 - 40 * sy - 50 * sy * by + bob - lift)})`;

    const away = Math.min(1, lift / 14);
    const ss = 1 - 0.35 * away;
    const shadow = `matrix(${fx(ss * sx)} 0 0 ${fx(ss)} ${fx(50 * (1 - ss * sx))} ${fx(94 * (1 - ss))})`;

    const [le, re] = placeEyes(this.gazeX.x, this.gazeY.x + s.y.x, s.gap.x);
    const open = Math.max(0, this.open.x);
    const lid = this.drowsyLift();
    const blink = this.blinkLevels();
    const eye = (p: EyePlacement, b: number, side: -1 | 1) => {
      const h = Math.max(0.7, (s.h.x + lid * 3.4) * p.sy * (1 - 0.9 * b) * Math.min(open, 1.15));
      const w = s.w.x * p.sx * (1 + 0.08 * b);
      return eyePath(p.x, p.y, w, h, s.bend.x * (1 - 0.6 * lid), side * s.tilt.x);
    };
    const roll = this.overrideRoll ? this.overrideRoll.value : s.roll.x;

    const glow = clamp01(this.mood.glow.x);
    const gs = 0.9 + 0.16 * glow;
    const badge = clamp01(this.mood.badge.x);
    const beat = (i: number) => {
      if (this.reduced) return 0.75;
      const u = 0.5 + 0.5 * Math.sin((this.t / 1.1) * Math.PI * 2 - i * 0.9);
      return 0.35 + 0.65 * u * u;
    };
    return {
      body,
      shadow,
      shadowOpacity: 1 - 0.6 * away,
      face: `rotate(${fx(roll)} 50 50)`,
      left: eye(le, blink.left, -1),
      right: eye(re, blink.right, 1),
      eyeOpacity: clamp01(open * 1.6),
      glow,
      glowTransform: `matrix(${fx(gs)} 0 0 ${fx(gs)} ${fx(50 * (1 - gs))} ${fx(50 * (1 - gs))})`,
      rim: clamp01(this.mood.rim.x),
      warm: clamp01(this.mood.warm.x),
      cool: clamp01(this.mood.cool.x),
      badge: clamp01(badge * 1.4),
      badgeTransform: `matrix(${fx(badge)} 0 0 ${fx(badge)} ${fx(BADGE.x * (1 - badge))} ${fx(BADGE.y * (1 - badge))})`,
      dots: [beat(0), beat(1), beat(2)],
    };
  }

  attach(renderer: RigRenderer) {
    this.renderer = renderer;
    this.paint();
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    window.clearTimeout(this.timer);
    this.renderer = null;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.sync();
  }

  setPageVisible(visible: boolean) {
    this.pageVisible = visible;
    this.sync();
  }

  setReduced(reduced: boolean) {
    if (reduced === this.reduced) return;
    this.reduced = reduced;
    if (reduced) {
      this.hops = [];
      this.blinks = [];
      this.drowsy = null;
      this.look = null;
      this.overrideRoll = null;
      this.open.snap(1);
      this.wakeAt = null;
      this.applyPose(true);
      this.squashX.snap(1);
      this.squashY.snap(1);
    }
    this.sync();
    this.paint();
  }

  setExpression(next: MascotExpression) {
    if (next === this.expression) return;
    const prev = this.expression;
    this.expression = next;
    // Nobody has seen Rumbi yet (or motion is reduced): no transition to show.
    const instant = this.reduced || !this.seen;
    this.applyPose(instant);
    if (instant) {
      this.paint();
      return;
    }
    this.flourish(prev, next);
    this.kick();
  }

  /** Pointer or finger position relative to Rumbi, each axis roughly in [-1, 1]. */
  lookAt(nx: number, ny: number) {
    if (this.reduced) return;
    this.look = { x: clamp(nx, -1, 1), y: clamp(ny, -1, 1), at: this.t };
    this.kick();
  }

  /** Finger down: a quick crouch, so the release can spring back. */
  press() {
    if (this.reduced) return;
    this.squashX.target = 1.05;
    this.squashY.target = 0.935;
    this.kick();
  }

  /** Finger lifted outside, or the press was cancelled. */
  cancelPress() {
    this.squashX.target = 1;
    this.squashY.target = 1;
    this.kick();
  }

  /** A tap (or Enter/Space): a playful but short reaction, cycling through a few. */
  tap(): TapReaction {
    const reaction = TAP_REACTIONS[this.tapCount++ % TAP_REACTIONS.length] ?? 'squint';
    if (this.reduced) {
      // No movement: just a brief content face.
      this.overrides = [{ expression: 'happy', until: Infinity }];
      this.applyPose(true);
      this.paint();
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        this.overrides = [];
        this.applyPose(true);
        this.paint();
      }, 900);
      return reaction;
    }
    this.squashX.target = 1;
    this.squashY.target = 1;
    this.squashY.v += 2.4;
    this.squashX.v -= 1.6;
    const t = this.t;
    if (reaction === 'squint') {
      this.overrides = [{ expression: 'happy', until: t + 0.95 }];
    } else if (reaction === 'hop') {
      this.hop(6.5, 0.05);
      this.overrides = [
        { expression: 'surprised', until: t + 0.38 },
        { expression: 'happy', until: t + 1.1 },
      ];
    } else {
      this.blinks.push({ start: t + 0.04, dur: 0.46, eyes: 'right' });
      this.overrideRoll = { value: 7, until: t + 0.6 };
      this.overrides = [];
    }
    this.applyPose(false);
    this.kick();
    return reaction;
  }

  // ── internals ──────────────────────────────────────────────────────

  private pose(): Pose {
    return POSES[this.overrides[0]?.expression ?? this.expression];
  }

  private applyPose(instant: boolean) {
    const pose = this.pose();
    for (const key of SHAPE) {
      if (instant) this.shape[key].snap(pose[key]);
      else this.shape[key].target = pose[key];
    }
    for (const key of MOOD) {
      if (instant) this.mood[key].snap(pose[key]);
      else this.mood[key].target = pose[key];
    }
    this.breath.target = pose.breath;
    this.depth.target = pose.breathDepth;
    if (instant) {
      this.gazeX.snap(pose.gazeX);
      this.gazeY.snap(pose.gazeY);
      this.breath.snap();
      this.depth.snap();
    }
  }

  /** A small physical accent when the face changes, so it reads as a reaction. */
  private flourish(prev: MascotExpression, next: MascotExpression) {
    const tall = (e: MascotExpression) => POSES[e].h > 8;
    if (next === 'proud') {
      this.hop(7, 0.08);
      this.hop(3.4, 0.08 + HOP_CROUCH + HOP_AIR + 0.06);
    } else if (next === 'surprised') {
      this.squashY.v += 2.4;
      this.squashX.v -= 1.6;
    } else if (tall(prev) && tall(next)) {
      // Pill to pill: a blink hides the change, like a real double take.
      this.blinks.push({ start: this.t + 0.02, dur: 0.22, eyes: 'both' });
    } else {
      this.squashY.v -= 1.2;
      this.squashX.v += 0.8;
    }
    this.glanceUntil = -1;
  }

  private hop(height: number, delay = 0) {
    this.hops.push({ start: this.t + delay, height, crouched: false, landed: false });
  }

  private hopLift(): number {
    let lift = 0;
    for (const h of this.hops) {
      const u = (this.t - h.start - HOP_CROUCH) / HOP_AIR;
      if (u > 0 && u < 1) lift += h.height * 4 * u * (1 - u);
    }
    return lift;
  }

  private blinkLevels(): { left: number; right: number } {
    let left = 0;
    let right = 0;
    for (const b of this.blinks) {
      const v = blinkCurve(this.t - b.start, b.dur);
      right = Math.max(right, v);
      if (b.eyes === 'both') left = Math.max(left, v);
    }
    return { left, right };
  }

  private drowsyLift(): number {
    if (!this.drowsy) return 0;
    const u = (this.t - this.drowsy.start) / this.drowsy.dur;
    if (u <= 0 || u >= 1) return 0;
    return Math.sin(Math.PI * u) ** 2;
  }

  private between([min, max]: readonly [number, number]) {
    return min + (max - min) * this.rand();
  }

  /** Advances the rig by `dt` seconds. Public for tests. */
  step(dt: number) {
    this.t += dt;
    const t = this.t;

    // A reaction that ran out hands the face to the next one, or back to the expression.
    if (this.overrides[0] && this.overrides[0].until <= t) {
      this.overrides = this.overrides.filter((o) => o.until > t);
      this.applyPose(false);
    }
    if (this.overrideRoll && this.overrideRoll.until <= t) this.overrideRoll = null;
    const pose = this.pose();

    // Wake up: the eyes flicker on the first time Rumbi is seen.
    if (this.wakeAt !== null) {
      if (this.wakeAt < 0) this.wakeAt = t;
      const tau = t - this.wakeAt;
      if (tau < 0.22) this.open.snap(0);
      else if (tau < 0.3) this.open.snap(0.62 * ((tau - 0.22) / 0.08));
      else if (tau < 0.38) this.open.snap(0.62 - 0.5 * ((tau - 0.3) / 0.08));
      else if (tau < 0.46) this.open.snap(0.12);
      else {
        this.open.target = 1;
        this.wakeAt = null;
      }
    }

    // Blinks, sometimes doubled.
    if (t >= this.nextBlink) {
      const dur = 0.2 * pose.blinkSlow;
      this.blinks.push({ start: t, dur, eyes: 'both' });
      if (this.rand() < 0.18) this.blinks.push({ start: t + dur + 0.07, dur, eyes: 'both' });
      this.nextBlink = t + this.between(pose.blinkEvery);
    }
    this.blinks = this.blinks.filter((b) => t - b.start < b.dur);

    // Gaze: the pointer wins for a moment, then idle glances, then the pose's own gaze.
    const reach = pose.glanceReach;
    if (this.look && t - this.look.at < 2.2) {
      this.gazeX.target = this.look.x * GAZE_RANGE.x * reach;
      this.gazeY.target = this.look.y * GAZE_RANGE.y * reach;
    } else {
      this.look = null;
      if (pose.glanceEvery && t >= this.nextGlance) {
        const thinking = pose.badge > 0;
        this.glanceSide = thinking ? -this.glanceSide : this.rand() < 0.5 ? -1 : 1;
        const x = thinking ? this.glanceSide * this.between([2.6, 4.2]) : this.glanceSide * this.between([2.4, 5.6]) * reach;
        const y = thinking ? -this.between([2.2, 3.4]) : this.between([-2, 1.6]) * reach;
        this.gazeX.target = x;
        this.gazeY.target = y;
        this.glanceUntil = t + (thinking ? this.between([1.4, 2.4]) : this.between([0.8, 1.6]));
        this.nextGlance = this.glanceUntil + this.between(pose.glanceEvery);
        if (this.rand() < 0.35) this.blinks.push({ start: t, dur: 0.18, eyes: 'both' });
      } else if (t >= this.glanceUntil) {
        this.gazeX.target = pose.gazeX;
        this.gazeY.target = pose.gazeY;
      }
    }

    // Sleepy: now and then the eyes try to open, then give up.
    if (this.expression === 'sleepy' && !this.overrides.length) {
      if (!this.drowsy && t >= this.nextDrowsy) this.drowsy = { start: t, dur: 1.8 };
      if (this.drowsy && t - this.drowsy.start > this.drowsy.dur) {
        this.drowsy = null;
        this.nextDrowsy = t + this.between([5, 9]);
      }
    } else {
      this.drowsy = null;
    }

    // Hops: squash on landing.
    for (const h of this.hops) {
      const k = h.height / 7;
      if (!h.crouched && t >= h.start) {
        // The crouch before take-off.
        h.crouched = true;
        this.squashY.v -= 1.1 * k;
        this.squashX.v += 0.7 * k;
      }
      if (!h.landed && t - h.start >= HOP_CROUCH + HOP_AIR) {
        h.landed = true;
        this.squashY.v -= 2.1 * k;
        this.squashX.v += 1.4 * k;
      }
    }
    this.hops = this.hops.filter((h) => !h.landed || t - h.start < 2);

    for (const key of SHAPE) this.shape[key].step(dt);
    for (const key of MOOD) this.mood[key].step(dt);
    this.gazeX.step(dt);
    this.gazeY.step(dt);
    this.squashX.step(dt);
    this.squashY.step(dt);
    this.open.step(dt);
    this.breath.step(dt);
    this.depth.step(dt);
    this.phase = (this.phase + (dt * Math.PI * 2) / Math.max(1, this.breath.x)) % (Math.PI * 2);
  }

  get running() {
    return this.raf !== 0;
  }

  private get canRun() {
    return !this.destroyed && !this.reduced && this.visible && this.pageVisible;
  }

  private sync() {
    if (this.canRun) {
      this.seen = true;
      this.start();
    } else {
      this.stop();
      if (this.visible) this.seen = true;
    }
  }

  private kick() {
    if (this.canRun) this.start();
    else this.paint();
  }

  private start() {
    if (this.raf || typeof requestAnimationFrame === 'undefined') return;
    this.last = 0;
    const loop = (now: number) => {
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
      this.last = now;
      this.step(dt);
      this.paint();
      this.raf = this.canRun ? requestAnimationFrame(loop) : 0;
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private paint() {
    this.renderer?.render(this.frame());
  }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
