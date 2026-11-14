import { expect, it } from 'vitest';
import { ApplicationShutdown } from '../../src/main/lifecycle/shutdown';

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
