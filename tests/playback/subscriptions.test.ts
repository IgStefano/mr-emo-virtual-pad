import { queryObjects } from 'node:v8';
import { expect, it } from 'vitest';
import { DomAudioExecutor } from '../../src/renderer/playback/dom-audio';
import { PlaybackController } from '../../src/renderer/playback/controller';
import { sessionIdSchema } from '../../src/contracts/catalog';
import type { LeaseAuthority } from '../../src/contracts/operations';

class SubscriberResources {
  readonly bytes = new Uint8Array(1024);

  touch(): void {
    this.bytes.fill(1);
  }
}

function attach(owner: {
  subscribe: (listener: () => void) => () => void;
}): void {
  const resources = new SubscriberResources();
  owner.subscribe(() => {
    resources.touch();
  });
}

it('releases subscriber resources on disposal while both owners remain reachable', async () => {
  const audio = new DomAudioExecutor(() => 'unused');
  const leases: LeaseAuthority = {
    acquire: () => Promise.reject(new Error('unused')),
    release: () => Promise.resolve(),
    disposeSession: () => Promise.resolve(),
  };
  const controller = new PlaybackController(
    audio,
    leases,
    sessionIdSchema.parse('00000000-0000-4000-8000-000000000001'),
  );
  attach(audio);
  attach(controller);
  expect(queryObjects(SubscriberResources)).toBe(2);
  await controller.dispose();
  expect(queryObjects(SubscriberResources)).toBe(0);
  expect(controller.snapshot().busy).toBe(false);
  await audio.dispose();
});
