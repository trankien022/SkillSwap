import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // See apps/api/jest.config.cjs: cap the pool so running the whole
    // workspace does not oversubscribe every core.
    maxWorkers: '50%',
  },
});
