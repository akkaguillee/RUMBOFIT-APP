import { useSyncExternalStore } from 'react';

export type DockSide = 'left' | 'right';

/**
 * Floating Rumbi preferences. Kept on this device (like the theme): whether it
 * is shown and where it rests, as the edge it docks to plus its height inside
 * the free band between the header and the navigation (0 = top, 1 = bottom),
 * so the spot survives rotations and different screen sizes.
 */
export interface RumbiPrefs {
  enabled: boolean;
  side: DockSide;
  y: number;
}

export const RUMBI_KEY = 'rumbo.rumbi';
export const DEFAULT_RUMBI: RumbiPrefs = { enabled: true, side: 'right', y: 0.78 };

/** Reads a stored value defensively: anything malformed falls back to the defaults, field by field. */
export function parseRumbiPrefs(raw: string | null): RumbiPrefs {
  if (!raw) return DEFAULT_RUMBI;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return DEFAULT_RUMBI;
  }
  if (typeof v !== 'object' || v === null) return DEFAULT_RUMBI;
  const o = v as Record<string, unknown>;
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULT_RUMBI.enabled,
    side: o.side === 'left' || o.side === 'right' ? o.side : DEFAULT_RUMBI.side,
    y: typeof o.y === 'number' && Number.isFinite(o.y) ? Math.min(1, Math.max(0, o.y)) : DEFAULT_RUMBI.y,
  };
}

function load(): RumbiPrefs {
  try {
    return parseRumbiPrefs(localStorage.getItem(RUMBI_KEY));
  } catch {
    return DEFAULT_RUMBI;
  }
}

let current: RumbiPrefs = typeof window === 'undefined' ? DEFAULT_RUMBI : load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setRumbiPrefs(patch: Partial<RumbiPrefs>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(RUMBI_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: the choice lasts for this session only */
  }
  emit();
}

/** Back to the default spot (bottom right). */
export function resetRumbiPosition() {
  setRumbiPrefs({ side: DEFAULT_RUMBI.side, y: DEFAULT_RUMBI.y });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed it: follow along.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== RUMBI_KEY) return;
    current = load();
    emit();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useRumbiPrefs(): RumbiPrefs {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
