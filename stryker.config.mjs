export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.mjs', related: false },
  mutate: ['src/domain/**/*.ts'],
  reporters: ['clear-text', 'html', 'json'],
  thresholds: { high: 100, low: 100, break: 100 },
  concurrency: 2,
  incremental: false,
};
