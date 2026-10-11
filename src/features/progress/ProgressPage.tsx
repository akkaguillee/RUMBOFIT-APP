import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { useProfile, useWeights } from '@/db/hooks';
import { Loader } from '@/ui/Loader';
import { riseVariants } from '@/ui/motion';
import { Page, PageHead } from '@/ui/Page';
import { TabPanel } from '@/ui/TabPanel';
import { Segmented } from '@/ui/Segmented';
import { BmiPanel } from './BmiPanel';
import { EnergyPanel } from './EnergyPanel';
import { EvolutionPanel } from './EvolutionPanel';
import { WeightLogPanel } from './WeightLogPanel';
import './progress.css';

const TABS = [
  { value: 'evolucion', label: 'Evolución' },
  { value: 'registros', label: 'Registros' },
  { value: 'imc', label: 'IMC' },
  { value: 'calorias', label: 'Calorías' },
] as const;

type Tab = (typeof TABS)[number]['value'];

export default function ProgressPage() {
  const profile = useProfile();
  const weights = useWeights();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'evolucion') as Tab;

  if (!profile || !weights) return <Loader />;

  return (
    <Page>
      <PageHead eyebrow="Progresos" title="Tu evolución" subtitle="Peso, tendencia y calculadoras con tus datos reales." />
      <motion.div className="tabs-row" variants={riseVariants}>
        <Segmented
          mode="tabs"
          idPrefix="progress"
          label="Secciones de progresos"
          options={[...TABS]}
          value={tab}
          onChange={(v) => setParams(v === 'evolucion' ? {} : { tab: v }, { replace: true })}
          block
        />
      </motion.div>
      <TabPanel tab={tab} idPrefix="progress">
        {tab === 'evolucion' && <EvolutionPanel profile={profile} weights={weights} />}
        {tab === 'registros' && <WeightLogPanel profile={profile} weights={weights} />}
        {tab === 'imc' && <BmiPanel profile={profile} weights={weights} />}
        {tab === 'calorias' && <EnergyPanel profile={profile} weights={weights} />}
      </TabPanel>
    </Page>
  );
}
