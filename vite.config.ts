/// <reference types="vitest/config" />
import { readFileSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const src = fileURLToPath(new URL('./src', import.meta.url));

/**
 * `vite build --mode standalone` produces a single self-contained
 * `dist-html/rumbo.html` (scripts, styles, font and icons inlined) that can be
 * opened directly from disk without a server.
 */
function standaloneHtml(): Plugin {
  const favicon = readFileSync(fileURLToPath(new URL('./public/favicon.svg', import.meta.url)), 'utf8');
  const faviconUri = `data:image/svg+xml,${encodeURIComponent(favicon)}`;
  return {
    name: 'rumbo-standalone-html',
    transformIndexHtml(html) {
      return html
        .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/svg+xml" href="${faviconUri}" />`)
        .replace(/<link rel="apple-touch-icon"[^>]*>/, `<link rel="apple-touch-icon" href="${faviconUri}" />`)
        .replace(/\s*<link rel="manifest"[^>]*>/, '');
    },
    closeBundle() {
      const out = fileURLToPath(new URL('./dist-html/index.html', import.meta.url));
      if (existsSync(out)) renameSync(out, out.replace(/index\.html$/, 'rumbo.html'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  return {
    base: standalone ? './' : '/',
    plugins: [react(), ...(standalone ? [viteSingleFile({ removeViteModuleLoader: true }), standaloneHtml()] : [])],
    resolve: {
      alias: [
        // The standalone file embeds only the Latin subset of Inter (covers Spanish).
        ...(standalone ? [{ find: /^@fontsource-variable\/inter$/, replacement: `${src}/styles/fonts-standalone.css` }] : []),
        { find: '@', replacement: src },
      ],
    },
    build: {
      target: 'es2022',
      ...(standalone
        ? { outDir: 'dist-html', emptyOutDir: true, copyPublicDir: false, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 4000 }
        : {
            rollupOptions: {
              output: {
                manualChunks(id: string) {
                  if (!id.includes('node_modules')) return undefined;
                  if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return 'react';
                  if (/node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//.test(id)) return 'motion';
                  if (/node_modules\/(dexie|dexie-react-hooks)\//.test(id)) return 'data';
                  if (id.includes('lucide-react')) return 'icons';
                  return 'vendor';
                },
              },
            },
          }),
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['src/test/setup.ts'],
    },
  };
});
