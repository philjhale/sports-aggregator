import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served from the GitHub Pages project sub-path: https://<user>.github.io/sports-aggregator/
  base: '/sports-aggregator/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Other agents' git worktrees live under .claude/worktrees/.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
