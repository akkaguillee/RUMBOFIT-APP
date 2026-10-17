import { Barcode, Camera, Database, ShieldCheck, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';

/** What the scanner does with photos and codes, in plain words. */
export function ScanInfo() {
  return (
    <ul className="scan-info">
      <li>
        <span className="scan-info__icon">
          <Camera aria-hidden="true" />
        </span>
        <span>
          <strong>Fotos.</strong> Se reducen en tu móvil y se envían de forma segura al servicio de análisis de RUMBO, que usa la IA de
          Anthropic (Claude) solo para reconocer los alimentos. RUMBO no guarda la foto.
        </span>
      </li>
      <li>
        <span className="scan-info__icon">
          <Barcode aria-hidden="true" />
        </span>
        <span>
          <strong>Códigos de barras.</strong> Se leen en tu móvil y solo se consulta el número en Open Food Facts, una base de datos abierta de
          productos. La imagen no sale del dispositivo.
        </span>
      </li>
      <li>
        <span className="scan-info__icon">
          <Database aria-hidden="true" />
        </span>
        <span>
          <strong>Valores.</strong> Salen de USDA FoodData Central y Open Food Facts. Las cantidades que se ven en una foto son estimaciones:
          revísalas antes de guardar.
        </span>
      </li>
      <li>
        <span className="scan-info__icon">
          <ShieldCheck aria-hidden="true" />
        </span>
        <span>
          <strong>Tu registro.</strong> Lo que guardas se queda en este dispositivo, como el resto de tus datos. Es orientativo y no sustituye
          el consejo de un profesional sanitario.
        </span>
      </li>
    </ul>
  );
}

export function ConsentView({ onAccept, onClose }: { onAccept: () => void; onClose: () => void }) {
  return (
    <motion.div className="scan-consent" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
      <div className="scan-consent__top">
        <button type="button" className="scan-btn scan-consent__close" aria-label="Cerrar escáner" onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="scan-consent__card">
        <span className="scan-consent__badge" aria-hidden="true">
          <Camera />
        </span>
        <h2 className="scan-consent__title">Antes de escanear</h2>
        <p className="scan-consent__lead">Registra lo que comes con una foto del plato o el código de barras del envase.</p>
        <ScanInfo />
        <div className="scan-consent__actions">
          <Button block size="lg" onClick={onAccept} data-autofocus>
            Entendido, empezar
          </Button>
          <Button block variant="ghost" onClick={onClose}>
            Ahora no
          </Button>
        </div>
        <p className="scan-consent__foot">También puedes elegir una foto de la galería o buscar los alimentos por su nombre.</p>
      </div>
    </motion.div>
  );
}

export function InfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Cómo funciona el escáner">
      <ScanInfo />
    </Sheet>
  );
}
