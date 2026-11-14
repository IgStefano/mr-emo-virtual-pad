const layerRule = (layer, allowed) => ({
  name: `architecture/${layer}`,
  severity: 'error',
  comment: `${layer}: use a public contract or inject an adapter; implementation imports must follow the layer matrix.`,
  from: { path: `^src/${layer}/` },
  to: { path: `^src/(?!(${allowed.join('|')})/)` },
});
module.exports = {
  forbidden: [
    {
      name: 'architecture/electron-entrypoints',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: '^src/(main/main|preload/preload)\\.ts$',
      },
      to: { path: '^node_modules/electron/' },
    },
    layerRule('domain', ['domain']),
    layerRule('contracts', ['contracts']),
    layerRule('main', ['main', 'domain', 'contracts']),
    layerRule('preload', ['preload', 'contracts']),
    layerRule('renderer', ['renderer', 'domain', 'contracts']),
    {
      name: 'architecture/known-layer',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^src/(?!(domain|contracts|main|preload|renderer)/)' },
    },
    {
      name: 'architecture/no-cycles',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'architecture/resolved',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'architecture/domain-is-pure',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { pathNot: '^src/domain/' },
    },
    {
      name: 'architecture/contracts-dependencies',
      severity: 'error',
      from: { path: '^src/contracts/' },
      to: { pathNot: '^(src/contracts/|node_modules/zod/)' },
    },
    {
      name: 'architecture/renderer-no-node',
      severity: 'error',
      from: { path: '^src/renderer/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'architecture/renderer-no-electron',
      severity: 'error',
      from: { path: '^src/renderer/' },
      to: { path: '^node_modules/electron/' },
    },
    {
      name: 'architecture/storage-owns-metadata',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/main/storage/' },
      to: { path: '^node_modules/music-metadata/' },
    },
    {
      name: 'architecture/storage-owns-disk',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/main/storage/' },
      to: { path: '^(node:)?(fs($|/)|sqlite$)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
      conditionNames: ['import', 'node', 'default'],
      exportsFields: ['exports'],
    },
    reporterOptions: { dot: { collapsePattern: 'node_modules/[^/]+' } },
  },
};
