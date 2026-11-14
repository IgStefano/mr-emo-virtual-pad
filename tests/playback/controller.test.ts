import { expect, it } from 'vitest';
import { PlaybackController } from '../../src/renderer/playback/controller';
import {
  attemptIdSchema,
  assetIdSchema,
  padIdSchema,
  sessionIdSchema,
  leaseIdSchema,
} from '../../src/contracts/catalog';
import { AudioEventKind } from '../../src/contracts/operations';
import type {
  AudioEvent,
  AudioExecutor,
  Lease,
  LeaseAuthority,
} from '../../src/contracts/operations';

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('uninitialized');
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const sessionId = sessionIdSchema.parse('00000000-0000-4000-8000-000000000001');
const pad = padIdSchema.parse('00000000-0000-4000-8000-000000000002');
const asset = assetIdSchema.parse('00000000-0000-4000-8000-000000000003');
function setup(failAcquire = false, failStart = false) {
  const grant = deferred<Lease>();
  const started = deferred<undefined>();
  const released = deferred<undefined>();
  let listener: (event: AudioEvent) => void = () => {};
  const active = new Set<number>();
  const requests: Parameters<AudioExecutor['start']>[0][] = [];
  let lease: Lease | null = null;
  let failRelease = false;
  let acquisitions = 0;
  let releaseCalls = 0;
  const leaseRequests: Parameters<LeaseAuthority['acquire']>[0][] = [];
  let disposed = false;
  let stopFails = false;
  let subscriptions = 1;
  const audio: AudioExecutor = {
    start: async (request) => {
      if (failStart) throw new Error('start');
      requests.push(request);
      active.add(request.attemptId);
      await started.promise;
    },
    stop: (id) => {
      if (stopFails) return Promise.reject(new Error('stop'));
      active.delete(id);
      return Promise.resolve();
    },
    subscribe: (callback) => {
      listener = callback;
      return () => {
        subscriptions--;
        listener = () => {};
      };
    },
    dispose: () => {
      disposed = true;
      return Promise.resolve();
    },
  };
  const leases: LeaseAuthority = {
    acquire: async (request) => {
      acquisitions++;
      leaseRequests.push(request);
      if (failAcquire) throw new Error('acquire');
      lease = {
        ...request,
        leaseId: leaseIdSchema.parse('00000000-0000-4000-8000-000000000004'),
      };
      return grant.promise;
    },
    release: async () => {
      releaseCalls++;
      if (failRelease) throw new Error('release');
      await released.promise;
      lease = null;
    },
    disposeSession: () => Promise.resolve(),
  };
  const controller = new PlaybackController(audio, leases, sessionId);
  return {
    controller,
    active,
    requests,
    started,
    released,
    grant,
    grantNow: () => {
      if (!lease) throw new Error('no lease');
      grant.resolve(lease);
    },
    emit: (kind: AudioEvent['kind'], attemptId = requests[0]?.attemptId) => {
      if (!attemptId) throw new Error('no attempt');
      listener({ kind, attemptId, positionSeconds: 3, durationSeconds: 10 });
    },
    failRelease: () => {
      failRelease = true;
    },
    repair: () => {
      failRelease = false;
    },
    acquisitions: () => acquisitions,
    leaseRequests,
    releaseCalls: () => releaseCalls,
    disposed: () => disposed,
    subscriptions: () => subscriptions,
    setStopFailure: (value: boolean) => {
      stopFails = value;
    },
    lease: () => lease,
  };
}

it('reserves synchronously, ignores busy clicks, stops pending play and waits for release', async () => {
  const s = setup();
  const padB = padIdSchema.parse('00000000-0000-4000-8000-000000000005');
  const assetB = assetIdSchema.parse('00000000-0000-4000-8000-000000000006');
  const play = s.controller.play(pad, asset);
  await s.controller.play(padB, assetB);
  expect(s.acquisitions()).toBe(1);
  s.grantNow();
  await Promise.resolve();
  await Promise.resolve();
  expect(s.active.size).toBe(1);
  const stop = s.controller.stop();
  expect(s.active.size).toBe(0);
  s.emit(AudioEventKind.Started);
  expect(s.controller.snapshot().state.status).toBe('stopped');
  s.started.resolve(undefined);
  await Promise.resolve();
  expect(s.controller.snapshot().busy).toBe(true);
  s.released.resolve(undefined);
  await Promise.all([play, stop]);
  expect(s.controller.snapshot().busy).toBe(false);
  expect(s.lease()).toBeNull();
  await s.controller.play(padB, assetB);
  expect(s.requests.map((r) => r.assetId)).toEqual([asset, assetB]);
  expect(s.requests.map((r) => r.offset)).toEqual([0, 0]);
  expect(s.active.size).toBe(1);
  await s.controller.stop();
});

it('releases a late grant without starting and retains the gate after failed release', async () => {
  const s = setup();
  const play = s.controller.play(pad, asset);
  const stop = s.controller.stop();
  s.failRelease();
  s.grantNow();
  await Promise.all([play, stop]);
  expect(s.requests).toEqual([]);
  expect(s.controller.snapshot()).toMatchObject({ busy: true, failed: true });
  await s.controller.play(pad, asset);
  expect(s.acquisitions()).toBe(1);
  s.repair();
  s.released.resolve(undefined);
  await s.controller.stop();
  expect(s.controller.snapshot().busy).toBe(false);
});

it('publishes progress, cleans up natural end and cannot restart after disposal', async () => {
  const s = setup();
  let updates = 0;
  const unsubscribe = s.controller.subscribe(() => {
    updates++;
  });
  const play = s.controller.play(pad, asset);
  s.grantNow();
  s.started.resolve(undefined);
  s.released.resolve(undefined);
  await play;
  s.emit(AudioEventKind.Started);
  s.emit(AudioEventKind.Progress);
  expect(s.controller.snapshot()).toMatchObject({
    state: { status: 'playing' },
    positionSeconds: 3,
    durationSeconds: 10,
  });
  s.emit(AudioEventKind.Ended);
  await s.controller.stop();
  expect(s.active.size).toBe(0);
  expect(updates).toBeGreaterThan(0);
  unsubscribe();
  await s.controller.dispose();
  await s.controller.play(pad, asset);
  expect(s.acquisitions()).toBe(1);
  expect(s.disposed()).toBe(true);
  expect(s.controller.snapshot().busy).toBe(false);
});

it('cleans up rejected acquisition and start without advancing playback', async () => {
  const denied = setup(true);
  await denied.controller.play(pad, asset);
  expect(denied.controller.snapshot()).toMatchObject({
    busy: false,
    failed: true,
    state: { status: 'stopped' },
  });
  const broken = setup(false, true);
  const play = broken.controller.play(pad, asset);
  broken.grantNow();
  broken.released.resolve(undefined);
  await play;
  expect(broken.controller.snapshot()).toMatchObject({
    busy: false,
    failed: true,
  });
  expect(broken.lease()).toBeNull();
});

it('ignores old callbacks during a new attempt and treats current failure as STOP', async () => {
  const s = setup();
  const first = s.controller.play(pad, asset);
  s.grantNow();
  s.started.resolve(undefined);
  s.released.resolve(undefined);
  await first;
  const old = s.requests[0];
  if (!old) throw new Error('no request');
  await s.controller.stop();
  await s.controller.play(pad, asset);
  s.emit(AudioEventKind.Ended, old.attemptId);
  expect(s.controller.snapshot().busy).toBe(true);
  const current = s.requests[1];
  if (!current) throw new Error('no request');
  s.emit(AudioEventKind.Failed, current.attemptId);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(s.controller.snapshot()).toMatchObject({ busy: false, failed: true });
  expect(s.active.size).toBe(0);
});

it('rejects disposal with a held lease, then releases it on retry', async () => {
  const s = setup();
  const play = s.controller.play(pad, asset);
  s.grantNow();
  s.started.resolve(undefined);
  await play;
  s.failRelease();
  await expect(s.controller.dispose()).rejects.toThrow('cleanup-required');
  expect(s.lease()).not.toBeNull();
  expect(s.controller.snapshot().busy).toBe(true);
  expect(s.disposed()).toBe(false);
  s.repair();
  s.released.resolve(undefined);
  await s.controller.dispose();
  expect(s.lease()).toBeNull();
  expect(s.active.size).toBe(0);
  expect(s.disposed()).toBe(true);
});

it('retains ownership after failed stop and retries before allowing a new pad', async () => {
  const s = setup();
  const play = s.controller.play(pad, asset);
  s.grantNow();
  s.started.resolve(undefined);
  s.released.resolve(undefined);
  await play;
  s.setStopFailure(true);
  await s.controller.stop();
  expect(s.active.size).toBe(1);
  expect(s.lease()).not.toBeNull();
  expect(s.controller.snapshot()).toMatchObject({ busy: true, failed: true });
  s.setStopFailure(false);
  await s.controller.stop();
  expect(s.active.size).toBe(0);
  expect(s.lease()).toBeNull();
});

it('disposes while start is pending and ignores callbacks without an attempt', async () => {
  const s = setup();
  s.emit(AudioEventKind.Started, attemptIdSchema.parse(1));
  const play = s.controller.play(pad, asset);
  s.grantNow();
  await Promise.resolve();
  await Promise.resolve();
  const dispose = s.controller.dispose();
  expect(s.subscriptions()).toBe(0);
  expect(s.active.size).toBe(0);
  expect(s.controller.snapshot().busy).toBe(true);
  s.started.resolve(undefined);
  s.released.resolve(undefined);
  await Promise.all([play, dispose]);
  expect(s.lease()).toBeNull();
  expect(s.disposed()).toBe(true);
});

it('notifies progress and completion independently and removes failing observers', async () => {
  const s = setup();
  const snapshots: ReturnType<PlaybackController['snapshot']>[] = [];
  let failures = 0;
  s.controller.subscribe(() => {
    failures++;
    throw new Error('observer');
  });
  const unsubscribe = s.controller.subscribe(() => {
    snapshots.push(s.controller.snapshot());
  });
  const play = s.controller.play(pad, asset);
  expect(snapshots.at(-1)).toMatchObject({
    busy: true,
    state: { status: 'starting' },
  });
  s.grantNow();
  s.started.resolve(undefined);
  s.released.resolve(undefined);
  await play;
  s.emit(AudioEventKind.Progress);
  expect(snapshots.at(-1)).toMatchObject({
    positionSeconds: 3,
    durationSeconds: 10,
  });
  s.emit(AudioEventKind.Ended);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(s.active.size).toBe(0);
  expect(s.lease()).toBeNull();
  expect(snapshots.at(-1)).toMatchObject({ busy: false, positionSeconds: 0 });
  expect(failures).toBe(1);
  unsubscribe();
  const count = snapshots.length;
  await s.controller.play(pad, asset);
  expect(snapshots).toHaveLength(count);
  expect(s.controller.snapshot()).toMatchObject({
    failed: false,
    positionSeconds: 0,
    durationSeconds: 0,
  });
  await s.controller.dispose();
});

it('starts healthy, authorizes its session and publishes STOP before release acknowledgment', async () => {
  const s = setup();
  expect(s.controller.snapshot()).toMatchObject({ failed: false, busy: false });
  const play = s.controller.play(pad, asset);
  expect(s.leaseRequests).toEqual([
    { sessionId, attemptId: 1, kind: 'playback' },
  ]);
  s.grantNow();
  s.started.resolve(undefined);
  await play;
  s.emit(AudioEventKind.Started);
  const snapshots: ReturnType<PlaybackController['snapshot']>[] = [];
  s.controller.subscribe(() => {
    snapshots.push(s.controller.snapshot());
  });
  const stop = s.controller.stop();
  expect(snapshots.at(-1)).toMatchObject({
    busy: true,
    state: { status: 'stopped' },
  });
  const again = s.controller.stop();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(s.releaseCalls()).toBe(1);
  s.released.resolve(undefined);
  await Promise.all([stop, again]);
});
