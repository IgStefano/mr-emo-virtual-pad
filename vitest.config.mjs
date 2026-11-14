import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'tests/{domain,contracts,storage,playback,ipc,media,integration,ui,lifecycle,model}/**/*.test.ts',
    ],
    environment: 'node',
    clearMocks: true,
  },
});
