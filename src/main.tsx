import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/base.css';
import './styles/glass.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/splash.css';
import './styles/milestones.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { App } from './app/App';
import { ThemeProvider } from './app/ThemeProvider';
import { initStorage } from './db/backend';

// The single-file build is opened from disk (file://), where only hash URLs work.
const Router = import.meta.env.MODE === 'standalone' ? HashRouter : BrowserRouter;

// Pick the storage backend (persistent IndexedDB or the temporary in-memory
// fallback) before the first database query.
void initStorage().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <Router>
            <App />
          </Router>
        </MotionConfig>
      </ThemeProvider>
    </StrictMode>,
  );
});
