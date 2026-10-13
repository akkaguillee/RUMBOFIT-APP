import path from 'node:path';
import { Config } from '@remotion/cli/config';

// Pre-installed Chromium headless shell (no download needed) with software GL for backdrop-filter.
Config.setBrowserExecutable('/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell');
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(96);
Config.setConcurrency(4);
Config.setOverwriteOutput(true);

// The video reuses the app's own sources (mascot rig, logo paths, flame artwork):
// resolve the app's "@/…" alias and make sure only one copy of React is bundled.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      '@': path.resolve(process.cwd(), '../src'),
      react: path.resolve(process.cwd(), 'node_modules/react'),
      'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom'),
    },
  },
}));
