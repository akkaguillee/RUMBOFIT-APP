import { AlertTriangle, Download, Home, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { downloadJson, exportAll } from '@/db/repos/data';
import { todayKey } from '@/domain/dates';

interface Props {
  children: ReactNode;
  /** When this value changes (e.g. the route), the boundary clears its error. */
  resetKey?: string;
  variant: 'section' | 'root';
}

interface State {
  error: Error | null;
  key?: string;
}

async function saveBackup() {
  try {
    downloadJson(await exportAll(), `rumbo-copia-${todayKey()}.json`);
  } catch {
    /* the database itself may be what failed; nothing else to do here */
  }
}

/**
 * Keeps a rendering error from blanking the app. Inside the shell it replaces
 * only the broken section; at the root it offers a reload and a way to save
 * the user's data before anything else.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('RUMBO: error al mostrar la interfaz', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const root = this.props.variant === 'root';
    return (
      <div className={root ? 'crash crash--root' : 'crash'} role="alert">
        <div className="crash__card glass glass--strong">
          <span className="crash__icon" aria-hidden="true">
            <AlertTriangle />
          </span>
          <h1 className="crash__title">{root ? 'RUMBO no se ha podido abrir' : 'Esta sección no se ha podido mostrar'}</h1>
          <p className="crash__text">
            {root
              ? 'Ha ocurrido un error inesperado. Tus datos siguen guardados en este dispositivo: puedes descargar una copia antes de volver a intentarlo.'
              : 'Ha ocurrido un error inesperado. Tus datos no se han modificado.'}
          </p>
          <div className="crash__actions">
            <button type="button" className="btn btn--primary" onClick={() => (root ? location.reload() : this.setState({ error: null }))}>
              <RotateCcw aria-hidden="true" />
              {root ? 'Volver a cargar' : 'Reintentar'}
            </button>
            {root ? (
              <button type="button" className="btn btn--secondary" onClick={() => void saveBackup()}>
                <Download aria-hidden="true" />
                Descargar copia de mis datos
              </button>
            ) : (
              // A router link: a full reload would wipe data in temporary (memory) mode.
              <Link className="btn btn--secondary" to="/">
                <Home aria-hidden="true" />
                Ir al inicio
              </Link>
            )}
          </div>
          <details className="crash__details">
            <summary>Detalles técnicos</summary>
            <code>{error.message || String(error)}</code>
          </details>
        </div>
      </div>
    );
  }
}
