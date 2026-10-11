import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { useProfile } from '@/db/hooks';
import { Loader } from '@/ui/Loader';
import { riseVariants } from '@/ui/motion';
import { Page, PageHead } from '@/ui/Page';
import { Segmented } from '@/ui/Segmented';
import { ExercisesPanel } from './ExercisesPanel';
import { HistoryPanel } from './HistoryPanel';
import { PlanPanel } from './PlanPanel';
import { StatsPanel } from './StatsPanel';
import { TemplatesPanel } from './TemplatesPanel';
import './training.css';

const TABS = [
  { value: 'plan', label: 'Plan' },
  { value: 'historial', label: 'Historial' },
  { value: 'ejercicios', label: 'Ejercicios' },
  { value: 'plantillas', label: 'Plantillas' },
  { value: 'stats', label: 'Estadísticas' },
] as const;

type Tab = (typeof TABS)[number]['value'];

export default function TrainingPage() {
  const profile = useProfile();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'plan') as Tab;
  if (!profile) return <Loader />;
  return (
    <Page>
      <PageHead eyebrow="Entrenamiento" title="Tu entrenamiento" subtitle="Planifica, registra cada serie y mira cómo progresas." />
      <motion.div variants={riseVariants} style={{ marginBottom: 20 }}>
        <Segmented
          mode="tabs"
          idPrefix="training"
          label="Secciones de entrenamiento"
          options={[...TABS]}
          value={tab}
          onChange={(v) => setParams(v === 'plan' ? {} : { tab: v }, { replace: true })}
          block
        />
      </motion.div>
      <motion.div
        key={tab}
        id="training-panel"
        role="tabpanel"
        aria-labelledby={`training-tab-${tab}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        {tab === 'plan' && <PlanPanel profile={profile} />}
        {tab === 'historial' && <HistoryPanel />}
        {tab === 'ejercicios' && <ExercisesPanel />}
        {tab === 'plantillas' && <TemplatesPanel />}
        {tab === 'stats' && <StatsPanel />}
      </motion.div>
    </Page>
  );
}
