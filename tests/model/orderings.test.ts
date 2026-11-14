import { expect, it } from 'vitest';
import { PlaybackController } from '../../src/renderer/playback/controller';
import {
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
const pad = padIdSchema.parse('00000000-0000-4000-8000-000000000001');
const asset = assetIdSchema.parse('00000000-0000-4000-8000-000000000002');
const sessionId = sessionIdSchema.parse('00000000-0000-4000-8000-000000000003');

async function ordering(
  stopBeforeGrant: boolean,
  stopBeforeStart: boolean,
  failRelease: boolean,
) {
  const grant = deferred<Lease>();
  const start = deferred<undefined>();
  const release = deferred<undefined>();
  let request: Lease | undefined;
  let listener: (event: AudioEvent) => void = () => {};
  const sounding = new Set<number>();
  let starts = 0;
  let acquisitions = 0;
  let brokenRelease = failRelease;
  const audio: AudioExecutor = {
    start: async (input) => {
      starts++;
      sounding.add(input.attemptId);
      await start.promise;
    },
    stop: (id) => {
      sounding.delete(id);
      return Promise.resolve();
    },
    subscribe: (callback) => {
      listener = callback;
      return () => {
        listener = () => {};
      };
    },
    dispose: () => Promise.resolve(),
  };
  const controller = new PlaybackController(
    audio,
    {
      acquire: (input) => {
        acquisitions++;
        request = {
          ...input,
          leaseId: leaseIdSchema.parse('00000000-0000-4000-8000-000000000004'),
        };
        return grant.promise;
      },
      release: async () => {
        if (brokenRelease) throw new Error('release unavailable');
        await release.promise;
      },
      disposeSession: () => Promise.resolve(),
    },
    sessionId,
  );
  const play = controller.play(pad, asset);
  let stop: Promise<void> | undefined;
  if (stopBeforeGrant) stop = controller.stop();
  if (!request) throw new Error('missing reservation');
  grant.resolve(request);
  await Promise.resolve();
  expect(starts).toBe(stopBeforeGrant ? 0 : 1);
  if (stopBeforeStart) stop = controller.stop();
  start.resolve(undefined);
  if (!stop) await play;
  stop ??= controller.stop();
  listener({
    kind: AudioEventKind.Started,
    attemptId: request.attemptId,
    positionSeconds: 0,
    durationSeconds: 10,
  });
  listener({
    kind: AudioEventKind.Progress,
    attemptId: request.attemptId,
    positionSeconds: 7,
    durationSeconds: 10,
  });
  expect(controller.snapshot().state.status).toBe('stopped');
  expect(controller.snapshot().busy).toBe(true);
  await controller.play(pad, asset);
  expect(acquisitions).toBe(1);
  release.resolve(undefined);
  await Promise.all([play, stop]);
  expect(controller.snapshot().busy).toBe(failRelease);
  expect(sounding.size).toBe(0);
  brokenRelease = false;
  await controller.stop();
  expect(controller.snapshot().busy).toBe(false);
  const staleAttempt = request.attemptId;
  await controller.play(pad, asset);
  listener({
    kind: AudioEventKind.Ended,
    attemptId: staleAttempt,
    positionSeconds: 10,
    durationSeconds: 10,
  });
  expect(controller.snapshot().busy).toBe(true);
  expect(controller.snapshot().state.status).toBe('starting');
  await controller.stop();
  await controller.dispose();
}

it('replays seeded command/result orderings against the exclusive-resource model', async () => {
  for (const seed of [1, 42, 806, 65537]) {
    let state = seed;
    for (let index = 0; index < 32; index++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const trace = [
        Boolean(state & 1),
        Boolean(state & 2),
        Boolean(state & 4),
      ];
      try {
        await expect(
          ordering(trace[0] ?? false, trace[1] ?? false, trace[2] ?? false),
        ).resolves.toBeUndefined();
      } catch (error) {
        const shrunk = [...trace];
        for (let bit = 0; bit < shrunk.length; bit++) {
          const candidate = [...shrunk];
          candidate[bit] = false;
          try {
            await ordering(
              candidate[0] ?? false,
              candidate[1] ?? false,
              candidate[2] ?? false,
            );
          } catch {
            shrunk[bit] = false;
          }
        }
        throw new Error(
          JSON.stringify({
            seed,
            index,
            trace,
            shrunk,
            replay: 'stopBeforeGrant,stopBeforeStart,failRelease',
          }),
          { cause: error },
        );
      }
    }
  }
});
