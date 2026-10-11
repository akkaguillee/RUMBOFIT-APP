export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, opts: { tone?: ToastTone; action?: Toast['action']; duration?: number } = {}): void {
  const t: Toast = { id: nextId++, message, tone: opts.tone ?? 'success', action: opts.action };
  toasts = [...toasts.slice(-2), t];
  emit();
  setTimeout(() => dismissToast(t.id), opts.duration ?? (opts.action ? 5200 : 3200));
}

export function toastError(err: unknown): void {
  const message = err instanceof Error ? err.message : 'Algo no ha ido bien. Inténtalo de nuevo.';
  toast(message, { tone: 'error', duration: 4500 });
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const subscribeToasts = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};


export const getToasts = () => toasts;
