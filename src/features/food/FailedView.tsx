import { Barcode, Camera, CloudOff, RefreshCw, Search, SearchX, ServerCrash, Timer, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/ui/Button';
import type { FoodApiError, FoodErrorCode, PreparedImage } from './api';

interface Props {
  error: FoodApiError;
  image?: PreparedImage;
  code?: string;
  onRetry: (() => void) | null;
  onRescan: () => void;
  onManual: () => void;
  onBarcode: () => void;
  onClose: () => void;
}

const TITLES: Record<FoodErrorCode, string> = {
  offline: 'Sin conexión',
  unavailable: 'Escáner no disponible',
  not_configured: 'Análisis por foto sin configurar',
  rate_limited: 'Demasiados intentos seguidos',
  timeout: 'Está tardando demasiado',
  refused: 'No se ha podido analizar',
  not_found: 'No lo hemos reconocido',
  bad_request: 'Revisa la foto',
  upstream: 'Algo no ha ido bien',
  aborted: 'Análisis cancelado',
};

const RETRYABLE: FoodErrorCode[] = ['offline', 'timeout', 'upstream', 'rate_limited', 'unavailable'];

/** A scan that could not finish, with what went wrong and real ways forward. */
export function FailedView({ error, image, code, onRetry, onRescan, onManual, onBarcode, onClose }: Props) {
  const Icon = error.code === 'offline' ? CloudOff : error.code === 'timeout' ? Timer : error.code === 'not_found' ? SearchX : ServerCrash;
  const title = code && error.code === 'not_found' ? 'Producto no encontrado' : TITLES[error.code];
  const canRetry = onRetry && RETRYABLE.includes(error.code);
  // Barcode lookups work without the photo service: offer them when photos cannot be analysed.
  const offerBarcode = !code && (error.code === 'not_configured' || error.code === 'unavailable' || error.code === 'refused');
  // Another photo cannot help when the photo service itself is missing.
  const photoUseless = !code && (error.code === 'not_configured' || error.code === 'unavailable');

  return (
    <motion.div className="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }}>
      {image && <img src={image.url} alt="" className="failed__photo" />}
      <button type="button" className="scan-btn failed__close" aria-label="Cerrar escáner" onClick={onClose}>
        <X />
      </button>
      <motion.div className="failed__card" role="alert" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
        <span className="failed__icon" aria-hidden="true">
          <Icon />
        </span>
        <h2 className="failed__title">{title}</h2>
        <p className="failed__text">{error.message}</p>
        {code && <p className="failed__code t-num">Código {code}</p>}
        <div className="failed__actions">
          {canRetry && (
            <Button block size="lg" icon={<RefreshCw />} onClick={onRetry}>
              Reintentar
            </Button>
          )}
          {offerBarcode && (
            <Button block size={canRetry ? 'md' : 'lg'} variant={canRetry ? 'secondary' : 'primary'} icon={<Barcode />} onClick={onBarcode}>
              Escanear el código de barras
            </Button>
          )}
          {!photoUseless && (
            <Button
              block
              size={canRetry || offerBarcode ? 'md' : 'lg'}
              variant={canRetry || offerBarcode ? 'secondary' : 'primary'}
              icon={code ? <Barcode /> : <Camera />}
              onClick={onRescan}
            >
              {code ? 'Escanear otro código' : 'Probar con otra foto'}
            </Button>
          )}
          <Button block variant="ghost" icon={<Search />} onClick={onManual}>
            Buscar por nombre o añadir a mano
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
