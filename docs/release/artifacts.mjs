import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const root = 'out/make';
const entries = await readdir(root, { recursive: true, withFileTypes: true });
const artifacts = [];
for (const entry of entries) {
  if (!entry.isFile() || !['.zip', '.dmg'].includes(path.extname(entry.name)))
    continue;
  const file = path.join(entry.parentPath, entry.name);
  const bytes = await readFile(file);
  artifacts.push({
    path: file,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
if (artifacts.length === 0) throw new Error('No ZIP or DMG artifacts');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
await mkdir('reports/release', { recursive: true });
await writeFile(
  'reports/release/artifacts.json',
  JSON.stringify(
    {
      sourceCommit: git('rev-parse', 'HEAD'),
      sourceTree: git('rev-parse', 'HEAD^{tree}'),
      worktreeStatus: git('status', '--porcelain'),
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      node: process.version,
      signing: 'No Developer ID signing or notarization configured',
      runtimeResult: 'Consult scenario reports and CI step outcomes separately',
      artifacts,
    },
    null,
    2,
  ) + '\n',
);
