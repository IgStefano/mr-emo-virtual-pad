import { z } from 'zod';

export const TaskStatus = Object.freeze({
  Planned: 'planned',
  Active: 'active',
  Accepted: 'accepted',
  Blocked: 'blocked',
});

const idSchema = z.string().regex(/^[A-Z][0-9]+$/);
const repoPath = z
  .string()
  .regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./-]+$/);
const taskSchema = z.strictObject({
  id: idSchema,
  title: z.string().min(1),
  status: z.enum(TaskStatus),
  dependsOn: z.array(idSchema),
  ownedPaths: z.array(repoPath).min(1),
  brief: repoPath,
  acceptedSha: z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .nullable(),
  evidence: z.array(repoPath),
});
const workSchema = z.strictObject({
  schemaVersion: z.literal(1),
  maxWorkers: z.number().int().min(1).max(3),
  tasks: z.array(taskSchema).min(1),
});
export function overlaps(left, right) {
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}
export function parseWork(raw) {
  const work = workSchema.parse(raw);
  const tasks = new Map(work.tasks.map((task) => [task.id, task]));
  if (tasks.size !== work.tasks.length) throw new Error('Duplicate task IDs.');
  for (const task of work.tasks) {
    if (
      task.status === TaskStatus.Accepted &&
      (task.acceptedSha === null || task.evidence.length === 0)
    )
      throw new Error(`${task.id}: accepted requires a SHA and evidence.`);
    if (task.status !== TaskStatus.Accepted && task.acceptedSha !== null)
      throw new Error(`${task.id}: only accepted work has acceptedSha.`);
    for (const dependency of task.dependsOn) {
      if (!tasks.has(dependency))
        throw new Error(`${task.id}: unknown dependency ${dependency}.`);
      if (
        [TaskStatus.Active, TaskStatus.Accepted].includes(task.status) &&
        tasks.get(dependency).status !== TaskStatus.Accepted
      )
        throw new Error(
          `${task.id}: prerequisite ${dependency} is not accepted.`,
        );
    }
  }
  function visit(id, trail) {
    if (trail.includes(id))
      throw new Error(`Dependency cycle: ${[...trail, id].join(' -> ')}`);
    for (const dependency of tasks.get(id).dependsOn)
      visit(dependency, [...trail, id]);
  }
  for (const task of work.tasks) visit(task.id, []);
  const active = work.tasks.filter((task) => task.status === TaskStatus.Active);
  if (active.length > work.maxWorkers)
    throw new Error('Worker capacity exceeded.');
  assertDisjoint(active);
  return work;
}
export function readyTasks(work) {
  const tasks = new Map(work.tasks.map((task) => [task.id, task]));
  return work.tasks.filter(
    (task) =>
      task.status === TaskStatus.Planned &&
      task.dependsOn.every(
        (id) => tasks.get(id).status === TaskStatus.Accepted,
      ),
  );
}
export function assertDisjoint(tasks) {
  for (const [index, task] of tasks.entries()) {
    for (const other of tasks.slice(index + 1)) {
      for (const left of task.ownedPaths) {
        for (const right of other.ownedPaths) {
          if (overlaps(left, right))
            throw new Error(
              `Shared writer: ${task.id} ${left} overlaps ${other.id} ${right}.`,
            );
        }
      }
    }
  }
}
export function selectTasks(work, ids) {
  if (new Set(ids).size !== ids.length) throw new Error('Task selected twice.');
  if (ids.length === 0) throw new Error('Select at least one ready task.');
  const active = work.tasks.filter((task) => task.status === TaskStatus.Active);
  if (ids.length + active.length > work.maxWorkers)
    throw new Error('Worker capacity exceeded.');
  const ready = new Map(readyTasks(work).map((task) => [task.id, task]));
  const selected = ids.map((id) => {
    const task = ready.get(id);
    if (!task)
      throw new Error(`${id} is not ready; inspect dependencies/status.`);
    return task;
  });
  assertDisjoint([...active, ...selected]);
  return selected;
}
export function selectReservedTasks(work, ids) {
  if (ids.length === 0 || new Set(ids).size !== ids.length)
    throw new Error('Select distinct reserved tasks.');
  return ids.map((id) => {
    const task = work.tasks.find((candidate) => candidate.id === id);
    if (task?.status !== TaskStatus.Active)
      throw new Error(`${id} has no active reservation.`);
    return task;
  });
}
export function validateChangedPaths(task, paths) {
  for (const path of paths) {
    if (
      !task.ownedPaths.some(
        (owned) => path === owned || path.startsWith(`${owned}/`),
      )
    ) {
      throw new Error(
        `${task.id}: ${path} is outside the owned paths; send a proposed patch to the integrator.`,
      );
    }
  }
}
