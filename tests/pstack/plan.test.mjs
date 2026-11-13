import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseWork,
  readyTasks,
  selectTasks,
  selectReservedTasks,
  validateChangedPaths,
} from '../../scripts/pstack/plan.mjs';
const fixture = JSON.parse(
  await readFile(new URL('../../.pstack/work.json', import.meta.url), 'utf8'),
);
function fresh() {
  const work = structuredClone(fixture);
  for (const task of work.tasks) {
    task.status = 'planned';
    task.acceptedSha = null;
    task.evidence = [];
  }
  return work;
}
function accept(work, id) {
  const task = work.tasks.find((candidate) => candidate.id === id);
  task.status = 'accepted';
  task.acceptedSha = 'a'.repeat(40);
  task.evidence = [`.pstack/evidence/${id}/report.md`];
}
test('only contract freeze and probes are initially ready', () => {
  assert.deepEqual(
    readyTasks(parseWork(fresh())).map((task) => task.id),
    ['P0', 'S1'],
  );
});
test('contract acceptance enables three disjoint implementation lanes', () => {
  const work = fresh();
  accept(work, 'P0');
  assert.deepEqual(
    selectTasks(parseWork(work), ['A1', 'B1', 'C1']).map((task) => task.id),
    ['A1', 'B1', 'C1'],
  );
});
test('blocked prerequisites cannot be dispatched', () => {
  const work = fresh();
  work.tasks[0].status = 'blocked';
  assert.throws(() => selectTasks(parseWork(work), ['A1']), /not ready/);
});
test('cycle is rejected even when no task is active', () => {
  const work = fresh();
  work.tasks[0].dependsOn = ['A1'];
  assert.throws(() => parseWork(work), /cycle/);
});
test('unknown prerequisites and duplicate IDs are rejected', () => {
  const missing = fresh();
  missing.tasks[0].dependsOn = ['Z9'];
  assert.throws(() => parseWork(missing), /unknown dependency/);
  const duplicate = fresh();
  duplicate.tasks.push(duplicate.tasks[0]);
  assert.throws(() => parseWork(duplicate), /Duplicate/);
});
test('accepted work needs SHA and evidence, not merely a status flag', () => {
  const work = fresh();
  work.tasks[0].status = 'accepted';
  assert.throws(() => parseWork(work), /SHA and evidence/);
});
test('active work requires accepted prerequisites', () => {
  const work = fresh();
  work.tasks.find((task) => task.id === 'A1').status = 'active';
  assert.throws(() => parseWork(work), /not accepted/);
});
test('duplicate dispatch and worker capacity overflow are rejected', () => {
  const work = fresh();
  accept(work, 'P0');
  assert.throws(() => selectTasks(parseWork(work), ['A1', 'A1']), /twice/);
  assert.throws(
    () => selectTasks(parseWork(work), ['S1', 'A1', 'B1', 'C1']),
    /capacity/,
  );
});
test('a parent directory and child file cannot have concurrent writers', () => {
  const work = fresh();
  accept(work, 'P0');
  work.tasks
    .find((task) => task.id === 'B1')
    .ownedPaths.push('src/main/storage/catalog.ts');
  assert.throws(
    () => selectTasks(parseWork(work), ['A1', 'B1']),
    /Shared writer/,
  );
});
test('active tasks reserve capacity and paths', () => {
  const work = fresh();
  accept(work, 'P0');
  work.tasks.find((task) => task.id === 'A1').status = 'active';
  work.tasks
    .find((task) => task.id === 'B1')
    .ownedPaths.push('src/main/storage');
  assert.throws(() => selectTasks(parseWork(work), ['B1']), /Shared writer/);
});
test('two conflicting active reservations fail validation', () => {
  const work = fresh();
  accept(work, 'P0');
  work.tasks.find((task) => task.id === 'A1').status = 'active';
  const other = work.tasks.find((task) => task.id === 'B1');
  other.status = 'active';
  other.ownedPaths.push('src/main/storage');
  assert.throws(() => parseWork(work), /Shared writer/);
});
test('planned tasks cannot produce reserved launch requests', () => {
  assert.throws(
    () => selectReservedTasks(parseWork(fresh()), ['P0']),
    /no active reservation/,
  );
  const work = fresh();
  work.tasks[0].status = 'active';
  assert.equal(selectReservedTasks(parseWork(work), ['P0'])[0].id, 'P0');
});
test('handoff scope rejects shared config and directory-prefix tricks', () => {
  const task = fixture.tasks.find((candidate) => candidate.id === 'A1');
  assert.doesNotThrow(() =>
    validateChangedPaths(task, [
      'src/main/storage/catalog.ts',
      '.pstack/evidence/A1/report.md',
    ]),
  );
  assert.throws(() => validateChangedPaths(task, ['package.json']), /outside/);
  assert.throws(
    () => validateChangedPaths(task, ['src/main/storage-escape/catalog.ts']),
    /outside/,
  );
});
test('owned paths cannot escape repository', () => {
  const work = fresh();
  work.tasks[0].ownedPaths.push('../other-repository');
  assert.throws(() => parseWork(work));
});

test('accepted descendants cannot bypass unaccepted prerequisites', () => {
  const work = fresh();
  accept(work, 'A1');
  assert.throws(() => parseWork(work), /not accepted/);
});
