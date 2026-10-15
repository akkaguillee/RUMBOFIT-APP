import { useEffect, useState } from 'react';
import { cancelRender, Composition, continueRender, delayRender, staticFile } from 'remotion';
import { Cinematic } from './cine/Cinematic';
import { FPS as CINE_FPS, FRAMES as CINE_FRAMES } from './cine/timing';
import { Promo } from './Promo';
import timeline from './timeline.json';

/** Inter (the app's typeface) and Krophed (the wordmark's display face), loaded before any frame is captured. */
function useInter() {
  const [handle] = useState(() => delayRender('Loading fonts'));
  useEffect(() => {
    const faces = [
      new FontFace('Inter', `url(${staticFile('fonts/inter.woff2')}) format('woff2')`, { weight: '100 900' }),
      new FontFace('Krophed', `url(${staticFile('fonts/krophed.woff2')}) format('woff2')`),
    ];
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        loaded.forEach((f) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(f));
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);
}

function CinematicWithFonts() {
  useInter();
  return <Cinematic />;
}

function PromoWithFont() {
  useInter();
  return <Promo />;
}

export function Root() {
  return (
    <>
      <Composition id="RumboPromo" component={PromoWithFont} durationInFrames={timeline.frames} fps={timeline.fps} width={1080} height={1920} />
      <Composition id="RumboCinematic" component={CinematicWithFonts} durationInFrames={CINE_FRAMES} fps={CINE_FPS} width={1080} height={1920} />
    </>
  );
}
