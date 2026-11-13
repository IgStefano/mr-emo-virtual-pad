import { execFileSync, spawnSync } from 'node:child_process';

export function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}
export function checkedIndex(cwd) {
  if (
    git(cwd, 'diff', '--name-only') ||
    git(cwd, 'ls-files', '--others', '--exclude-standard')
  ) {
    throw new Error(
      'HOOK001: stage the complete change before committing. Checks must inspect the same files as the index; unstaged or untracked files remain.',
    );
  }
  return git(cwd, 'write-tree');
}
export function checkedHead(cwd) {
  const tree = checkedIndex(cwd);
  if (tree !== git(cwd, 'rev-parse', 'HEAD^{tree}'))
    throw new Error(
      'HOOK002: commit staged changes before pushing; packaging must match HEAD.',
    );
  return git(cwd, 'rev-parse', 'HEAD');
}
export function checkPushRefs(cwd, input, head) {
  const live = input
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) => !/^0{40,64}$/.test(fields[1] ?? ''));
  for (const fields of live) {
    if (fields.length !== 4 || !/^[a-f0-9]{40,64}$/.test(fields[1] ?? ''))
      throw new Error('HOOK003: malformed pre-push ref input.');
    if (git(cwd, 'rev-parse', `${fields[1]}^{commit}`) !== head)
      throw new Error(
        'HOOK004: push the checked-out commit; packaging another branch would verify the wrong artifact.',
      );
  }
  return live.length > 0;
}
export function npm(args) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Hook check failed: npm ${args.join(' ')}`);
}
