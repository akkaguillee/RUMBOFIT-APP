import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { useProfile } from '@/db/hooks';
import { Loader } from '@/ui/Loader';
import { riseVariants } from '@/ui/motion';
import { Page, PageHead } from '@/ui/Page';
import { TabPanel } from '@/ui/TabPanel';
import { Segmented } from '@/ui/Segmented';
import { StepsPanel } from './StepsPanel';
import { WaterPanel } from './WaterPanel';
import './habits.css';

export default function HabitsPage() {
  const profile = useProfile();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'pasos' ? 'pasos' : 'agua';
  if (!profile) return <Loader />;
  return (
    <Page>
      <PageHead eyebrow="Hábitos" title="Agua y movimiento" subtitle="Pequeños gestos diarios que suman." />
      <motion.div className="tabs-row" variants={riseVariants} style={{ marginBottom: 20 }}>
        <Segmented
          mode="tabs"
          idPrefix="habits"
          label="Hábitos"
          options={[
            { value: 'agua', label: 'Agua' },
            { value: 'pasos', label: 'Pasos' },
          ]}
          value={tab}
          onChange={(v) => setParams(v === 'agua' ? {} : { tab: v }, { replace: true })}
          block
        />
      </motion.div>
      <TabPanel tab={tab} idPrefix="habits">
        {tab === 'agua' ? <WaterPanel profile={profile} /> : <StepsPanel profile={profile} />}
      </TabPanel>
    </Page>
  );
}
