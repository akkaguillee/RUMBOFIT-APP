import { TriangleAlert, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { memoryReason, storageMode } from '@/db/backend';

/**
 * Shown when the browser blocks IndexedDB and RUMBO runs on the temporary
 * in-memory store: the user must know their records won't be kept.
 * Its height is published as --notice-h so full-height layouts subtract it.
 */
export function StorageNotice() {
  const [hidden, setHidden] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visible = storageMode() === 'memory' && !hidden;

  useLayoutEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!visible || !el) {
      root.style.setProperty('--notice-h', '0px');
      return;
    }
    const update = () => root.style.setProperty('--notice-h', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty('--notice-h', '0px');
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div ref={ref} className="storage-notice" role="alert">
      <TriangleAlert aria-hidden="true" />
      {memoryReason() === 'open-failed' ? (
        <p>
          <strong>Modo temporal.</strong> No se han podido abrir tus datos guardados en este dispositivo. Cierra otras pestañas de RUMBO y vuelve a
          cargar la página para recuperarlos; lo que registres ahora no se conservará.
        </p>
      ) : (
        <p>
          <strong>Modo temporal.</strong> Este navegador no permite guardar datos aquí, así que lo que registres se perderá al cerrar. Abre RUMBO en
          una ventana normal de Chrome, Safari, Edge o Firefox para conservar tu progreso.
        </p>
      )}
      <button
        type="button"
        className="icon-btn icon-btn--sm icon-btn--plain"
        aria-label="Ocultar aviso"
        onClick={() => {
          setHidden(true);
          // Keep keyboard and screen-reader users in context.
          requestAnimationFrame(() => document.getElementById('main')?.focus());
        }}
      >
        <X />
      </button>
    </div>
  );
}
