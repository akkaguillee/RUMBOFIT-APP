// Review stills: bundles once and renders the given frames of a composition.
// Frames are timeline frames at 30 fps (decimals allowed), whatever the render rate.
//   node scripts/stills.mjs RumboPasos out/stills 40 150 235 …
//   SCALE=1.3333333333 node scripts/stills.mjs …   (2K)
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const [id, outDir, ...frames] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, '..');
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const serveUrl = await bundle({
  entryPoint: path.join(root, 'src/index.ts'),
  webpackOverride: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...(config.resolve?.alias ?? {}),
        '@': path.resolve(root, '../src'),
        react: path.resolve(root, 'node_modules/react'),
        'react-dom': path.resolve(root, 'node_modules/react-dom'),
      },
    },
  }),
});
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions: { gl: 'swangle' } });
const scale = Number(process.env.SCALE ?? 1);
for (const f of frames) {
  const output = path.resolve(outDir, `${id}-${String(f).padStart(4, '0')}.jpg`);
  const frame = Math.round((Number(f) * composition.fps) / 30);
  await renderStill({ composition, serveUrl, output, frame, scale, imageFormat: 'jpeg', jpegQuality: 88, browserExecutable, chromiumOptions: { gl: 'swangle' } });
  console.log('·', output);
}
