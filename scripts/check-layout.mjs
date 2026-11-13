import { readdir } from 'node:fs/promises';
const allowed = new Set(['domain', 'contracts', 'main', 'preload', 'renderer']);
for (const entry of await readdir('src', { withFileTypes: true })) {
  if (!entry.isDirectory() || !allowed.has(entry.name)) {
    throw new Error(
      `ARCH000: src/${entry.name} is outside the layer matrix; place code in an approved layer or revise the architecture explicitly.`,
    );
  }
}
