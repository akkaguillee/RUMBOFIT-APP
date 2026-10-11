import { AnimatePresence } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useProfile } from '@/db/hooks';
import { syncAchievements } from '@/db/sync';
import type { Profile } from '@/domain/types';
import { UnlockCelebration } from '@/features/milestones/UnlockCelebration';
import { Loader } from '@/ui/Loader';
import { ToastViewport } from '@/ui/ToastViewport';
import { sectionOf } from './nav';
import { AppBackground } from './shell/AppBackground';
import { Sidebar } from './shell/Sidebar';
import { TabBar } from './shell/TabBar';
import { TopBar } from './shell/TopBar';
import { introModeForThisLoad, markIntroSeen } from './intro';
import { Splash } from './Splash';

const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'));
const Progress = lazy(() => import('@/features/progress/ProgressPage'));
const Calendar = lazy(() => import('@/features/calendar/CalendarPage'));
const Training = lazy(() => import('@/features/training/TrainingPage'));
const ActiveSession = lazy(() => import('@/features/training/ActiveSessionPage'));
const Habits = lazy(() => import('@/features/habits/HabitsPage'));
const Milestones = lazy(() => import('@/features/milestones/MilestonesPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const About = lazy(() => import('@/features/about/AboutPage'));
const Onboarding = lazy(() => import('@/features/onboarding/OnboardingPage'));

/** Warm up the other sections once the app is idle so navigation never waits on a chunk. */
function prefetchSections() {
  const load = () => {
    void import('@/features/progress/ProgressPage');
    void import('@/features/calendar/CalendarPage');
    void import('@/features/training/TrainingPage');
    void import('@/features/training/ActiveSessionPage');
    void import('@/features/habits/HabitsPage');
    void import('@/features/milestones/MilestonesPage');
    void import('@/features/profile/ProfilePage');
    void import('@/features/about/AboutPage');
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(load);
  else window.setTimeout(load, 1500);
}

function Shell({ profile }: { profile: Profile }) {
  const location = useLocation();
  const section = sectionOf(location.pathname);
  const key = location.pathname.startsWith('/entreno/sesion') ? '/entreno/sesion' : section;
  return (
    <div className="shell">
      <Sidebar profile={profile} />
      <div className="shell__main">
        <TopBar profile={profile} />
        <main id="main">
          <Suspense fallback={<Loader />}>
            <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
              <Routes location={location} key={key}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/progresos" element={<Progress />} />
                <Route path="/calendario" element={<Calendar />} />
                <Route path="/entreno" element={<Training />} />
                <Route path="/entreno/sesion" element={<ActiveSession />} />
                <Route path="/habitos" element={<Habits />} />
                <Route path="/hitos" element={<Milestones />} />
                <Route path="/perfil" element={<ProfilePage />} />
                <Route path="/quien-soy" element={<About />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
      <TabBar />
    </div>
  );
}

export function App() {
  const profile = useProfile();
  const [introMode] = useState(introModeForThisLoad);
  const [splash, setSplash] = useState(introMode !== null);
  const finishSplash = useCallback(() => {
    markIntroSeen();
    setSplash(false);
  }, []);

  const loading = profile === undefined;
  const hasProfile = !!profile;

  useEffect(() => {
    if (!hasProfile) return;
    // Records can change outside a mutation (imports, older versions): reconcile once per launch.
    void syncAchievements();
    prefetchSections();
  }, [hasProfile]);

  return (
    <>
      <a href="#main" className="sr-only">
        Saltar al contenido
      </a>
      <AppBackground />
      {!loading && profile === null && (
        <Suspense fallback={<Loader />}>
          <Onboarding />
        </Suspense>
      )}
      {!loading && profile && <Shell profile={profile} />}
      {loading && !splash && <Loader />}
      <AnimatePresence>
        {splash && introMode && <Splash key="splash" mode={introMode} ready={!loading} onDone={finishSplash} />}
      </AnimatePresence>
      <ToastViewport />
      {profile && <UnlockCelebration enabled={!splash} />}
    </>
  );
}
