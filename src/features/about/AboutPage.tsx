import { Camera, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { RunnerMark, Wordmark } from '@/brand/Logo';
import { BrandIcon, type Brand } from '@/ui/BrandIcons';
import { riseVariants } from '@/ui/motion';
import { Page } from '@/ui/Page';
import './about.css';

/**
 * The creator's original photo goes in src/assets/creator/ (guille.jpg, .jpeg,
 * .png or .webp). It is bundled at build time, so it also works inside the
 * single-file HTML. If it is missing we show a neutral, clearly-labelled frame
 * instead of inventing or substituting an image.
 */
const photos = import.meta.glob<string>('/src/assets/creator/guille.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' });
const PHOTO_SRC: string | undefined = Object.values(photos)[0];

const SOCIALS: { brand: Brand; label: string; handle: string; url: string }[] = [
  { brand: 'instagram', label: 'Instagram', handle: '@akkaguillee', url: 'https://www.instagram.com/akkaguillee' },
  { brand: 'tiktok', label: 'TikTok', handle: '@akkaguillee', url: 'https://www.tiktok.com/@akkaguillee' },
  { brand: 'youtube', label: 'YouTube', handle: '@akkaguillee', url: 'https://www.youtube.com/@akkaguillee' },
];

const PARAGRAPHS = [
  'RUMBO nace de algo muy sencillo: las ganas de cambiar, crecer y convertirnos en nuestra mejor versión.',
  'Yo también estoy en ese camino. No tengo una vida perfecta, no siempre tengo motivación y también hay días en los que cuesta seguir. Pero he aprendido que no se trata de hacerlo todo perfecto, sino de seguir avanzando, incluso cuando vas despacio.',
  'Creé RUMBO para convertir ese proceso en algo más fácil de entender, disfrutar y mantener. Para que puedas ver tus avances, conocer tus hábitos, cuidar de ti y recordar por qué empezaste.',
  'Porque creo que todos tenemos un lugar al que queremos llegar.',
  'Y aunque a veces no sepamos exactamente cómo hacerlo, cada pequeño paso cuenta.',
];

export default function AboutPage() {
  const [photoState, setPhotoState] = useState<'loading' | 'ok' | 'missing'>(PHOTO_SRC ? 'loading' : 'missing');
  return (
    <Page>
      <article className="about glass glass--strong" aria-labelledby="about-title">
        <span className="glass__sheen" aria-hidden="true" />
        <motion.div className="about__photo-wrap" variants={riseVariants}>
          <div className="about__halo" aria-hidden="true" />
          <div className="about__photo" data-state={photoState}>
            {PHOTO_SRC && photoState !== 'missing' ? (
              <img
                src={PHOTO_SRC}
                alt="Guille, creador de RUMBO"
                width={220}
                height={220}
                decoding="async"
                onLoad={() => setPhotoState('ok')}
                onError={() => setPhotoState('missing')}
              />
            ) : (
              <div className="about__photo-missing" role="img" aria-label="Fotografía pendiente de añadir">
                <Camera aria-hidden="true" />
                <span>Foto pendiente</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.h1 id="about-title" className="about__title" variants={riseVariants}>
          Hola, soy Guille
        </motion.h1>

        <div className="about__text">
          {PARAGRAPHS.map((p) => (
            <motion.p key={p} variants={riseVariants}>
              {p}
            </motion.p>
          ))}
          <motion.p className="about__signature" variants={riseVariants}>
            Este es mi RUMBO.
          </motion.p>
          <motion.p className="about__closing" variants={riseVariants}>
            Ahora es el momento de encontrar el tuyo.
          </motion.p>
        </div>

        <motion.ul className="about__socials" variants={riseVariants} aria-label="Redes sociales de Guille">
          {SOCIALS.map((s) => (
            <li key={s.brand}>
              <a className={`social social--${s.brand}`} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.label} de Guille (${s.handle}), se abre en una pestaña nueva`}>
                <span className="social__icon">
                  <BrandIcon brand={s.brand} />
                </span>
                <span className="social__text">
                  <span className="social__name">{s.label}</span>
                  <span className="social__handle">{s.handle}</span>
                </span>
                <ExternalLink aria-hidden="true" className="social__ext" />
              </a>
            </li>
          ))}
        </motion.ul>

        <motion.div className="about__brand" variants={riseVariants} aria-hidden="true">
          <RunnerMark size={36} />
          <Wordmark height={13} />
        </motion.div>
      </article>
    </Page>
  );
}
