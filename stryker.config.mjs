export default {
  testRunner: 'vitest',
  ignorePatterns: ['/out'],
  vitest: { configFile: 'vitest.config.mjs', related: false },
  mutate: [
    'src/domain/**/*.ts',
    'src/contracts/{catalog,operations,desktop}.ts',
    'src/main/{storage,library,ipc,lifecycle}/**/*.ts',
    'src/renderer/playback/**/*.ts',
    'src/renderer/runtime/**/*.ts',
    'src/renderer/{performance,editing}/**/*.ts',
    'src/renderer/lib/**/*.ts',
    'src/preload/desktop-bridge.ts',
  ],
  reporters: ['clear-text', 'html', 'json'],
  thresholds: { high: 100, low: 100, break: 100 },
  concurrency: 2,
  incremental: false,
};
