import { TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { storageMode } from '@/db/backend';

/**
 * Shown when the browser blocks IndexedDB and RUMBO runs on the temporary
 * in-memory store: the user must know their records won't be kept.
 */
export function StorageNotice() {
  const [hidden, setHidden] = useState(false);
  if (storageMode() !== 'memory' || hidden) return null;
  return (
    <div className="storage-notice" role="alert">
      <TriangleAlert aria-hidden="true" />
      <p>
        <strong>Modo temporal.</strong> Este navegador no permite guardar datos aquí, así que lo que registres se perderá al cerrar. Abre RUMBO en
        una ventana normal de Chrome, Safari, Edge o Firefox para conservar tu progreso.
      </p>
      <button type="button" className="icon-btn icon-btn--sm icon-btn--plain" aria-label="Ocultar aviso" onClick={() => setHidden(true)}>
        <X />
      </button>
    </div>
  );
}
