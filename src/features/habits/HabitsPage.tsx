import { motion } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { useProfile } from '@/db/hooks';
import { Loader } from '@/ui/Loader';
import { riseVariants } from '@/ui/motion';
import { Page, PageHead } from '@/ui/Page';
import { TabPanel } from '@/ui/TabPanel';
import { Segmented } from '@/ui/Segmented';
import { FoodLogPanel } from '../food/FoodLogPanel';
import { StepsPanel } from './StepsPanel';
import { WaterPanel } from './WaterPanel';
import './habits.css';

export default function HabitsPage() {
  const profile = useProfile();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab = requested === 'pasos' || requested === 'comidas' ? requested : 'agua';
  if (!profile) return <Loader />;
  return (
    <Page>
      <PageHead eyebrow="Hábitos" display="Rutina" title="Agua, pasos y comidas" subtitle="Pequeños gestos diarios que suman." note="poco a poco, suma" />
      <motion.div className="tabs-row" variants={riseVariants} style={{ marginBottom: 20 }}>
        <Segmented
          mode="tabs"
          idPrefix="habits"
          label="Hábitos"
          options={[
            { value: 'agua', label: 'Agua' },
            { value: 'pasos', label: 'Pasos' },
            { value: 'comidas', label: 'Comidas' },
          ]}
          value={tab}
          onChange={(v) => setParams(v === 'agua' ? {} : { tab: v }, { replace: true })}
          block
        />
      </motion.div>
      <TabPanel tab={tab} idPrefix="habits">
        {tab === 'agua' ? <WaterPanel profile={profile} /> : tab === 'pasos' ? <StepsPanel profile={profile} /> : <FoodLogPanel profile={profile} />}
      </TabPanel>
    </Page>
  );
}
