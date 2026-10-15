import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * `next-intl`'s ESM build imports `next/navigation` without an extension, and
 * Vite's resolver only honours an explicit `extensions` list — so a suite that
 * renders a page using next-intl's `Link` fails to collect. Listing the
 * TypeScript sources in `resolve.extensions` fixes that, and is harmless for
 * every other module. (`resolve.extensionAlias` would be the surgical form of
 * this, but Vite 7 dropped it from the config types, and `next build`
 * type-checks this file.)
 *
 * `server.deps.inline` keeps `next-intl` inside Vite's module graph, otherwise
 * the same import is resolved by Node instead of by the resolver above.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // See apps/api/jest.config.cjs: cap the pool so running the whole
    // workspace does not oversubscribe every core.
    maxWorkers: '50%',
    server: {
      deps: {
        inline: ['next-intl'],
      },
    },
  },
});
