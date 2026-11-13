import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/{domain,contracts,storage,playback}/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
  },
});
