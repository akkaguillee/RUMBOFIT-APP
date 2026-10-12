import { useProfile } from '@/db/hooks';
import { Loader } from '@/ui/Loader';
import { Page, PageHead } from '@/ui/Page';

// Placeholder: replaced by the nutrition module implementation.
export default function NutritionPage() {
  const profile = useProfile();
  if (!profile) return <Loader />;
  return (
    <Page>
      <PageHead eyebrow="Nutrición" title="Tu alimentación" subtitle="Plan diario, recetas y lista de la compra." />
    </Page>
  );
}
