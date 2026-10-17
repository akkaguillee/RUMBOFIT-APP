// Review stills: bundles once and renders the given frames of a composition.
//   node scripts/stills.mjs RumboPasos out/stills 40 150 235 …
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
for (const f of frames) {
  const output = path.resolve(outDir, `${id}-${String(f).padStart(4, '0')}.jpg`);
  await renderStill({ composition, serveUrl, output, frame: Number(f), imageFormat: 'jpeg', jpegQuality: 88, browserExecutable, chromiumOptions: { gl: 'swangle' } });
  console.log('·', output);
}
