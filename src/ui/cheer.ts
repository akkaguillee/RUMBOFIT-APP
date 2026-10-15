/**
 * A small app-wide signal for moments worth celebrating: a record saved
 * (water, steps, weight) or a workout finished. Deletions and settings
 * changes never cheer. Floating Rumbi listens and reacts with a little hop.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function cheer(): void {
  listeners.forEach((l) => l());
}

export function subscribeCheer(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
