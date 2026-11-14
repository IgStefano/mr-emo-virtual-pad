export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.mjs', related: false },
  mutate: [
    'src/domain/**/*.ts',
    'src/contracts/{catalog,operations,desktop}.ts',
    'src/main/{storage,library,ipc}/**/*.ts',
    'src/renderer/playback/**/*.ts',
    'src/preload/desktop-bridge.ts',
  ],
  reporters: ['clear-text', 'html', 'json'],
  thresholds: { high: 100, low: 100, break: 100 },
  concurrency: 2,
  incremental: false,
};
