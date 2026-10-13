import { useEffect, useState } from 'react';
import { cancelRender, Composition, continueRender, delayRender, staticFile } from 'remotion';
import { Promo } from './Promo';
import timeline from './timeline.json';

/** Inter, the app's typeface, loaded before any frame is captured. */
function useInter() {
  const [handle] = useState(() => delayRender('Loading Inter'));
  useEffect(() => {
    const face = new FontFace('Inter', `url(${staticFile('fonts/inter.woff2')}) format('woff2')`, { weight: '100 900' });
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);
}

function PromoWithFont() {
  useInter();
  return <Promo />;
}

export function Root() {
  return (
    <Composition
      id="RumboPromo"
      component={PromoWithFont}
      durationInFrames={timeline.frames}
      fps={timeline.fps}
      width={1080}
      height={1920}
    />
  );
}
