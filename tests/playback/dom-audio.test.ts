import { expect, it, vi } from 'vitest';
import { DomAudioExecutor } from '../../src/renderer/playback/dom-audio';
import {
  assetIdSchema,
  attemptIdSchema,
  leaseIdSchema,
} from '../../src/contracts/catalog';
import type { AudioEvent } from '../../src/contracts/operations';

class Element extends EventTarget {
  autoplay = true;
  loop = true;
  src = '';
  currentTime = 9;
  duration = Number.NaN;
  active = false;
  readonly callbacks = new Map<string, EventListenerOrEventListenerObject>();
  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
  ): void {
    this.callbacks.set(type, callback);
    super.addEventListener(type, callback);
  }
  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
  ): void {
    this.callbacks.delete(type);
    super.removeEventListener(type, callback);
  }
  play(): Promise<void> {
    this.active = true;
    return Promise.resolve();
  }
  pause(): void {
    this.active = false;
  }
  load(): void {
    this.currentTime = 0;
  }
  removeAttribute(name: string): void {
    if (name === 'src') this.src = '';
  }
}
const request = {
  assetId: assetIdSchema.parse('00000000-0000-4000-8000-000000000001'),
  leaseId: leaseIdSchema.parse('00000000-0000-4000-8000-000000000002'),
  attemptId: attemptIdSchema.parse(1),
  offset: 0,
} as const;

it('plays exclusively from zero, correlates media events and clears the source on STOP', async () => {
  const element = new Element();
  const audio = new DomAudioExecutor(
    (asset, lease) => `media://${asset}/${lease}`,
    () => element,
  );
  let observerFailures = 0;
  audio.subscribe(() => {
    observerFailures++;
    throw new Error('observer');
  });
  const events: AudioEvent[] = [];
  const unsubscribe = audio.subscribe((event) => {
    events.push(event);
  });
  await audio.start(request);
  expect(element).toMatchObject({
    active: true,
    currentTime: 0,
    autoplay: false,
    loop: false,
    src: `media://${request.assetId}/${request.leaseId}`,
  });
  await expect(audio.start(request)).rejects.toThrow();
  element.dispatchEvent(new Event('playing'));
  element.dispatchEvent(new Event('timeupdate'));
  element.duration = 10;
  element.currentTime = 3;
  element.dispatchEvent(new Event('timeupdate'));
  element.dispatchEvent(new Event('ended'));
  element.dispatchEvent(new Event('error'));
  expect(observerFailures).toBe(1);
  expect(events).toEqual([
    {
      kind: 'started',
      attemptId: request.attemptId,
      positionSeconds: 0,
      durationSeconds: 0,
    },
    {
      kind: 'progress',
      attemptId: request.attemptId,
      positionSeconds: 0,
      durationSeconds: 0,
    },
    {
      kind: 'progress',
      attemptId: request.attemptId,
      positionSeconds: 3,
      durationSeconds: 10,
    },
    {
      kind: 'ended',
      attemptId: request.attemptId,
      positionSeconds: 3,
      durationSeconds: 10,
    },
    {
      kind: 'failed',
      attemptId: request.attemptId,
      positionSeconds: 3,
      durationSeconds: 10,
    },
  ]);
  await audio.stop(attemptIdSchema.parse(2));
  expect(element.active).toBe(true);
  const stale = element.callbacks.get('playing');
  await audio.stop(request.attemptId);
  expect(element.callbacks.size).toBe(0);
  if (typeof stale !== 'function') throw new Error('missing callback');
  stale(new Event('playing'));
  expect(element).toMatchObject({ active: false, src: '', currentTime: 0 });
  element.dispatchEvent(new Event('playing'));
  expect(events).toHaveLength(5);
  unsubscribe();
  await audio.start({ ...request, attemptId: attemptIdSchema.parse(2) });
  stale(new Event('playing'));
  element.dispatchEvent(new Event('playing'));
  expect(events).toHaveLength(5);
  await audio.dispose();
  expect(element.active).toBe(false);
  await expect(audio.start(request)).rejects.toThrow();
});

it('creates the default audio element and releases it without playback', async () => {
  const element = new Element();
  const createElement = vi.fn((tag: string) => {
    expect(tag).toBe('audio');
    return element;
  });
  vi.stubGlobal('document', { createElement });
  try {
    const audio = new DomAudioExecutor(() => 'media://test');
    await audio.stop(request.attemptId);
    await audio.start(request);
    expect(element.active).toBe(true);
    await audio.dispose();
    expect(element.active).toBe(false);
    await audio.dispose();
    await expect(audio.start(request)).rejects.toThrow('audio-failure');
  } finally {
    vi.unstubAllGlobals();
  }
});
