import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import { setTimeout } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import { _electron } from 'playwright';
import { drive } from '../../tests/electron/shell.mjs';
import { fixtures } from './fixtures.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const command = process.argv[2] ?? 'drive';
assert.ok(
  ['doctor', 'drive', 'fixtures'].includes(command),
  'use doctor, drive or fixtures',
);
const directory = await mkdtemp(
  path.join(
    await mkdir(path.join(root, 'reports/verification'), {
      recursive: true,
    }).then(() => path.join(root, 'reports/verification')),
    'run-',
  ),
);
const evidence = async (name, value) =>
  writeFile(
    path.join(directory, name),
    typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n',
  );
evidence.directory = directory;
console.log(directory);
if (command === 'fixtures') {
  await fixtures(directory);
} else {
  const probe = spawnSync(electron, ['--version'], {
    encoding: 'utf8',
    timeout: 15000,
  });
  const doctor = {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    host: os.release(),
    cpu: os.cpus()[0]?.model,
    executable: electron,
    display: process.env.DISPLAY ?? null,
    waylandDisplay: process.env.WAYLAND_DISPLAY ?? null,
    probe: {
      exitCode: probe.status,
      signal: probe.signal,
      stdout: probe.stdout,
      stderr: probe.stderr,
      error: probe.error?.message,
    },
  };
  await evidence('doctor.json', doctor);
  if (command === 'doctor') {
    process.exitCode = probe.status === 0 ? 0 : 2;
  } else {
    let application;
    let profile;
    const result = { status: 'ISSUES', mode: 'unpackaged', steps: [] };
    try {
      const pkg = JSON.parse(
        await readFile(path.join(root, 'package.json'), 'utf8'),
      );
      const hashes = {};
      async function hashTree(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) await hashTree(file);
          else
            hashes[path.relative(root, file)] = createHash('sha256')
              .update(await readFile(file))
              .digest('hex');
        }
      }
      await hashTree(path.join(root, '.vite'));
      await evidence('build.json', {
        sha: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8',
        }).trim(),
        diff: execFileSync('git', ['diff', 'HEAD'], {
          cwd: root,
          encoding: 'utf8',
        }),
        untracked: execFileSync(
          'git',
          ['ls-files', '--others', '--exclude-standard'],
          { cwd: root, encoding: 'utf8' },
        ),
        version: pkg.version,
        hashes,
      });
      await fixtures(path.join(directory, 'fixtures'));
      profile = await mkdtemp(path.join(os.tmpdir(), 'pad-verification-'));
      await evidence('profile.json', { profile });
      if (probe.status !== 0) {
        result.status = 'BLOCKED';
        throw new Error(
          `Electron runtime doctor failed: ${probe.stderr ?? probe.error?.message}`,
        );
      }
      application = await _electron.launch({
        executablePath: electron,
        args: [root],
        cwd: root,
        timeout: 20000,
        env: { ...process.env, PAD_VERIFICATION_DATA_DIR: profile },
      });
      result.steps.push('launch');
      await application
        .context()
        .tracing.start({ screenshots: true, snapshots: true });
      const logs = [];
      application
        .process()
        .stdout?.on('data', (data) => logs.push(String(data)));
      application
        .process()
        .stderr?.on('data', (data) => logs.push(String(data)));
      try {
        result.journey = await Promise.race([
          drive(application, profile, pkg.version, evidence),
          setTimeout(30000, null, { ref: false }).then(() => {
            throw new Error('Shell journey exceeded 30 seconds');
          }),
        ]);
        result.status = 'PASS';
      } finally {
        await evidence('electron.log', logs.join(''));
        await application
          .context()
          .tracing.stop({ path: path.join(directory, 'trace.zip') });
      }
    } catch (error) {
      result.error = error.stack;
      if (
        /shared libraries|cannot open shared object|Missing X server|no DISPLAY|Failed to connect to.*bus/i.test(
          error.message,
        )
      )
        result.status = 'BLOCKED';
    } finally {
      try {
        if (application) await application.close();
        if (profile) {
          await evidence(
            'profile-files.json',
            await readdir(profile, { recursive: true }),
          );
          await rm(profile, { recursive: true, force: true });
          result.steps.push('profile removed');
        }
      } catch (error) {
        result.status = 'ISSUES';
        result.cleanupError = error.stack;
      }
      await evidence('result.json', result);
      console.log(result.status);
      process.exitCode =
        result.status === 'PASS' ? 0 : result.status === 'BLOCKED' ? 2 : 1;
    }
  }
}
