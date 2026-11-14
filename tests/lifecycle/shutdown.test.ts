import { expect, it } from 'vitest';
import {
  ApplicationShutdown,
  retryableCleanup,
} from '../../src/main/lifecycle/shutdown';
import { RendererLifetime } from '../../src/main/ipc/renderer-lifetime';
import { setImmediate } from 'node:timers/promises';

it('shares full cleanup and retries a failed destroyed-renderer cleanup on quit', async () => {
  let attempts = 0;
  let fail = true;
  let closed = 0;
  let quits = 0;
  const lifetime = new RendererLifetime(() => {
    attempts++;
    return fail
      ? Promise.reject(new Error('transient cleanup'))
      : Promise.resolve();
  });
  await lifetime.run('catalog:open', () =>
    Promise.resolve({
      ok: true,
      value: '00000000-0000-4000-8000-000000000001',
    }),
  );
  const cleanup = retryableCleanup(async () => {
    await lifetime.terminate();
    closed++;
  });
  const first = cleanup();
  expect(cleanup()).toBe(first);
  await expect(first).rejects.toThrow('transient cleanup');
  fail = false;
  const shutdown = new ApplicationShutdown({
    closeWindows: () => {},
    hasWindows: () => false,
    drain: cleanup,
    quit: () => {
      quits++;
    },
    report: () => {
      throw new Error('unexpected failure');
    },
  });
  expect(shutdown.request()).toBe(false);
  expect(shutdown.request()).toBe(false);
  await setImmediate();
  expect(shutdown.request()).toBe(true);
  await cleanup();
  expect({ attempts, closed, quits }).toEqual({
    attempts: 2,
    closed: 1,
    quits: 1,
  });
});

it('holds quit through reentrant window closure and asynchronous cleanup', async () => {
  let finish: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const events: string[] = [];
  const shutdown = new ApplicationShutdown({
    closeWindows: () => {
      events.push('close');
      expect(shutdown.request()).toBe(false);
    },
    hasWindows: () => false,
    drain: () => {
      events.push('drain');
      return pending;
    },
    quit: () => {
      events.push('quit');
      expect(shutdown.request()).toBe(true);
    },
    report: () => {
      throw new Error('unexpected failure');
    },
  });
  expect(shutdown.request()).toBe(false);
  expect(shutdown.request()).toBe(false);
  expect(events).toEqual(['close', 'drain']);
  finish();
  await pending;
  expect(events).toEqual(['close', 'drain', 'quit']);
});

it('allows another close after cancellation and retries failed cleanup without claiming success', async () => {
  let windowOpen = true;
  let fail = true;
  const events: string[] = [];
  const shutdown = new ApplicationShutdown({
    closeWindows: () => {
      events.push('close');
    },
    hasWindows: () => windowOpen,
    drain: () =>
      fail ? Promise.reject(new Error('cleanup')) : Promise.resolve(),
    quit: () => {
      events.push('quit');
    },
    report: (error) => {
      expect(error).toBeInstanceOf(Error);
      events.push('failure');
    },
  });
  expect(shutdown.request()).toBe(false);
  expect(events).toEqual(['close']);
  windowOpen = false;
  expect(shutdown.request()).toBe(false);
  await new Promise<void>((resolve) => {
    queueMicrotask(() => {
      queueMicrotask(resolve);
    });
  });
  expect(events).toEqual(['close', 'close', 'failure']);
  fail = false;
  expect(shutdown.request()).toBe(false);
  await Promise.resolve();
  expect(shutdown.request()).toBe(true);
  expect(events).toEqual(['close', 'close', 'failure', 'close', 'quit']);
});
