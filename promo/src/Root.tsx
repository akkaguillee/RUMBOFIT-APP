import { useEffect, useState } from 'react';
import { cancelRender, Composition, continueRender, delayRender, staticFile } from 'remotion';
import { Cinematic } from './cine/Cinematic';
import { FPS as CINE_FPS, FRAMES as CINE_FRAMES } from './cine/timing';
import { Pasos, type PasosProps } from './pasos/Pasos';
import { FPS as PASOS_TL_FPS, FRAMES as PASOS_FRAMES, RENDER_FPS as PASOS_FPS } from './pasos/theme';
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

/** The app's brand faces for «Cada pequeño paso cuenta» (Krophed, 212 Baby Girl) and Inter. */
function useBrandFonts() {
  const [handle] = useState(() => delayRender('Loading brand fonts'));
  useEffect(() => {
    const faces = [
      new FontFace('Inter', `url(${staticFile('fonts/inter.woff2')}) format('woff2')`, { weight: '100 900' }),
      new FontFace('Krophed', `url(${staticFile('pasos/fonts/krophed.woff2')}) format('woff2')`, { weight: '500' }),
      new FontFace('212 Baby Girl', `url(${staticFile('pasos/fonts/baby-girl.woff2')}) format('woff2')`),
    ];
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        loaded.forEach((f) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(f));
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);
}

function PasosWithFonts(props: PasosProps) {
  useBrandFonts();
  return <Pasos {...props} />;
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
      <Composition
        id="RumboPasos"
        component={PasosWithFonts}
        durationInFrames={(PASOS_FRAMES * PASOS_FPS) / PASOS_TL_FPS}
        fps={PASOS_FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: 'story' } satisfies PasosProps}
      />
      <Composition
        id="RumboPasos45"
        component={PasosWithFonts}
        durationInFrames={(PASOS_FRAMES * PASOS_FPS) / PASOS_TL_FPS}
        fps={PASOS_FPS}
        width={1080}
        height={1350}
        defaultProps={{ format: 'feed' } satisfies PasosProps}
      />
      {/* The 4:5 cut at 30 fps, for a quick 1080 × 1350 delivery (the animation reads time, so it is the same motion). */}
      <Composition
        id="RumboPasos45x30"
        component={PasosWithFonts}
        durationInFrames={PASOS_FRAMES}
        fps={PASOS_TL_FPS}
        width={1080}
        height={1350}
        defaultProps={{ format: 'feed' } satisfies PasosProps}
      />
    </>
  );
}
