import '@fontsource-variable/inter';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/glass.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/liquid.css';
import './styles/interaction.css';
import './styles/identity.css';
import './styles/splash.css';
import './styles/milestones.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { ThemeProvider } from './app/ThemeProvider';
import { initStorage, switchToMemory } from './db/backend';
import { db } from './db/db';

// iOS Safari only shows :active press states when a touch listener exists.
document.addEventListener('touchstart', () => {}, { passive: true });

// Start loading the brand faces right away (bundled with the app): section
// titles and handwritten notes then render in them on first paint.
try {
  void document.fonts?.load('500 1em Krophed');
  void document.fonts?.load('400 1em "212 Baby Girl"');
} catch {
  /* Font Loading API not available: the CSS loads them on demand. */
}

// The single-file build is opened from disk (file://), where only hash URLs work.
const Router = import.meta.env.MODE === 'standalone' ? HashRouter : BrowserRouter;

// Pick the storage backend (persistent IndexedDB or the temporary in-memory
// fallback) before the first database query. If the real database still fails
// to open (disk full, corrupted store), run on the temporary store instead of
// showing an endless loader; the storage notice explains it.
async function boot() {
  try {
    await initStorage();
    await db.open();
  } catch (e) {
    console.error('RUMBO: no se pudo abrir la base de datos', e);
    db.close();
    await switchToMemory('open-failed');
    await db.open();
  }
}

void boot().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <ErrorBoundary variant="root">
            <Router>
              <App />
            </Router>
          </ErrorBoundary>
        </MotionConfig>
      </ThemeProvider>
    </StrictMode>,
  );
});
