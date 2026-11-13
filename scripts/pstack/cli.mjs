import { createHash } from 'node:crypto';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  TaskStatus,
  parseWork,
  readyTasks,
  selectTasks,
  selectReservedTasks,
  validateChangedPaths,
} from './plan.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = async (name) =>
  JSON.parse(await readFile(resolve(root, name), 'utf8'));
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${path}`);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else files.push(path);
  }
  return files;
}
async function doctor(work) {
  const lock = await json('.pstack/upstream-lock.json');
  const vendor = resolve(root, lock.root);
  const actual = await filesUnder(vendor);
  if (actual.length !== Object.keys(lock.files).length)
    throw new Error('Upstream file inventory changed.');
  for (const path of actual) {
    const name = relative(vendor, path).split(sep).join('/');
    const hash = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
    if (hash !== lock.files[name]) throw new Error(`Upstream drift: ${name}`);
  }
  const skills = actual.filter((path) => path.endsWith(`${sep}SKILL.md`));
  if (skills.length !== lock.skillCount)
    throw new Error('Upstream skill count changed.');
  const models = await json('.pstack/models.json');
  if (models.budget !== 'small' || models.reasoningEffort !== 'medium')
    throw new Error('Model budget changed; revise the T3 settings mapping.');
  if (Object.keys(models.roles).length !== 17 || !models.roles['swarm workers'])
    throw new Error('The upstream role mapping is incomplete.');
  for (const value of Object.values(models.roles)) {
    if (!value.split(',').every((entry) => entry.trim() === 'inherit-parent'))
      throw new Error(
        'Unconfigured model family; validate availability before dispatch.',
      );
  }
  for (const task of work.tasks) {
    await access(resolve(root, task.brief));
    for (const path of task.evidence) await access(resolve(root, path));
    if (task.status === TaskStatus.Accepted)
      git('merge-base', '--is-ancestor', task.acceptedSha, 'HEAD');
  }
  return {
    upstream: lock.version,
    commit: lock.commit,
    skills: skills.length,
    budget: models.budget,
    roles: models.roles,
    ready: readyTasks(work).map((task) => task.id),
  };
}

const work = parseWork(await json('.pstack/work.json'));
const command = process.argv[2] ?? 'doctor';
if (command === 'doctor') {
  console.log(JSON.stringify(await doctor(work), null, 2));
} else if (command === 'ready') {
  console.log(
    JSON.stringify(
      readyTasks(work).map(({ id, title, dependsOn }) => ({
        id,
        title,
        dependsOn,
      })),
      null,
      2,
    ),
  );
} else if (command === 'brief') {
  await doctor(work);
  const reserved = process.argv[3] === '--reserved';
  const selected = reserved
    ? selectReservedTasks(work, process.argv.slice(4))
    : selectTasks(work, process.argv.slice(3));
  if (git('status', '--porcelain'))
    throw new Error(
      'Commit the setup before generating dispatch requests; the tool must receive an exact clean base.',
    );
  const base = git('rev-parse', 'HEAD');
  if (base !== git('rev-parse', 'origin/main'))
    throw new Error(
      'Publish/reconcile the base with origin/main before dispatch.',
    );
  const requests = [];
  for (const task of selected) {
    const prompt = await readFile(resolve(root, task.brief), 'utf8');
    requests.push({
      mode: 'async',
      isolation: 'worktree',
      role: 'implementation',
      title: `${task.id}: ${task.title}`,
      target: { options: { reasoningEffort: 'medium' } },
      task: `${prompt}\nExact base SHA: ${base}. Refuse an unexpected base before editing.\nRead .pstack/codex-t3.md and ${task.brief} in your provided worktree. The read-only upstream poteto-mode reference is ${resolve(root, '.agents/skills/pstack/skills/poteto-mode/SKILL.md')}.\nOwned paths: ${task.ownedPaths.join(', ')}.\nThe worktree is provisioned by the orchestration tool. Return evidence before acceptance.`,
    });
  }
  console.log(
    JSON.stringify(
      { status: reserved ? 'RESERVED' : 'PREVIEW_ONLY', base, requests },
      null,
      2,
    ),
  );
} else if (command === 'scope') {
  const [id, base, head] = process.argv.slice(3);
  if (![base, head].every((sha) => /^[a-f0-9]{40}$/.test(sha ?? '')))
    throw new Error('Scope requires exact base/head SHAs.');
  const task = work.tasks.find((candidate) => candidate.id === id);
  if (!task) throw new Error('Unknown task.');
  const paths = git('diff', '--name-only', '-z', `${base}..${head}`)
    .split('\0')
    .filter(Boolean);
  validateChangedPaths(task, paths);
  console.log(JSON.stringify({ task: id, base, head, paths }, null, 2));
} else {
  throw new Error(
    'Usage: node scripts/pstack/cli.mjs doctor|ready|brief [--reserved] [TASK ...]|scope TASK BASE_SHA HEAD_SHA',
  );
}
