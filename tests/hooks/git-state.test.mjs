import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  checkedIndex,
  checkedHead,
  checkPushRefs,
  git,
} from '../../scripts/hooks/git-state.mjs';

// Hooks export repository-local Git variables. A fixture must never inherit them.
for (const name of execFileSync('git', ['rev-parse', '--local-env-vars'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')) {
  delete process.env[name];
}

async function repository(run) {
  const cwd = await mkdtemp(join(tmpdir(), 'pad hook '));
  try {
    git(cwd, 'init', '-q');
    git(cwd, 'config', 'user.name', 'Hook test');
    git(cwd, 'config', 'user.email', 'hook@example.invalid');
    git(cwd, 'config', 'commit.gpgsign', 'false');
    git(cwd, 'config', 'core.hooksPath', '.git/hooks');
    await writeFile(join(cwd, 'file.txt'), 'initial\n');
    git(cwd, 'add', '.');
    git(cwd, 'commit', '-qm', 'fixture');
    await run(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
test('index gate accepts staged changes but rejects partially staged content and untracked files', async () => {
  await repository(async (cwd) => {
    await writeFile(join(cwd, 'file.txt'), 'staged\n');
    git(cwd, 'add', '.');
    assert.match(checkedIndex(cwd), /^[a-f0-9]{40,64}$/);
    await writeFile(join(cwd, 'file.txt'), 'unstaged\n');
    assert.throws(() => checkedIndex(cwd), /HOOK001/);
    git(cwd, 'add', '.');
    await writeFile(join(cwd, 'other.txt'), 'untracked\n');
    assert.throws(() => checkedIndex(cwd), /HOOK001/);
  });
});
test('push gate rejects staging that would package a different tree from HEAD', async () => {
  await repository(async (cwd) => {
    assert.equal(checkedHead(cwd), git(cwd, 'rev-parse', 'HEAD'));
    await writeFile(join(cwd, 'file.txt'), 'new\n');
    git(cwd, 'add', '.');
    assert.throws(() => checkedHead(cwd), /HOOK002/);
  });
});
test('push refs must identify the checked-out commit; deletions do not need packaging', async () => {
  await repository(async (cwd) => {
    const head = checkedHead(cwd);
    const zero = '0'.repeat(40);
    assert.equal(
      checkPushRefs(
        cwd,
        `refs/heads/main ${head} refs/heads/main ${zero}\n`,
        head,
      ),
      true,
    );
    assert.equal(
      checkPushRefs(
        cwd,
        `refs/heads/main ${zero} refs/heads/main ${head}\n`,
        head,
      ),
      false,
    );
    assert.throws(() => checkPushRefs(cwd, 'malformed', head), /HOOK003/);
    await writeFile(join(cwd, 'file.txt'), 'next\n');
    git(cwd, 'add', '.');
    git(cwd, 'commit', '-qm', 'next');
    assert.throws(
      () =>
        checkPushRefs(
          cwd,
          `refs/heads/main ${head} refs/heads/main ${zero}\n`,
          checkedHead(cwd),
        ),
      /HOOK004/,
    );
  });
});
test('a real git commit is blocked by the production hook when the index and worktree differ', async () => {
  await repository(async (cwd) => {
    const before = git(cwd, 'rev-parse', 'HEAD');
    const script = fileURLToPath(
      new URL('../../scripts/hooks/pre-commit.mjs', import.meta.url),
    );
    const quoted = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
    await writeFile(
      join(cwd, '.git/hooks/pre-commit'),
      `#!/bin/sh\n${quoted(process.execPath)} ${quoted(script)}\n`,
      { mode: 0o755 },
    );
    await writeFile(join(cwd, 'file.txt'), 'staged\n');
    git(cwd, 'add', '.');
    await writeFile(join(cwd, 'file.txt'), 'different\n');
    const result = spawnSync('git', ['commit', '-qm', 'must fail'], {
      cwd,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /HOOK001/);
    assert.equal(
      execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd,
        encoding: 'utf8',
      }).trim(),
      before,
    );
  });
});
