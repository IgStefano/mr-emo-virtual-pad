import { expect, it } from 'vitest';
import { WindowLifecycle } from '../../src/main/lifecycle/window';

it('asks only during playback and obeys cancellation and confirmation', () => {
  let playing = false;
  let accepted = false;
  let prompts = 0;
  const lifecycle = new WindowLifecycle({
    isPlaying: () => playing,
    confirmClose: () => {
      prompts++;
      return accepted;
    },
    destroy: () => {
      throw new Error('close intent must not bypass native close');
    },
  });
  expect(lifecycle.requestClose()).toBe(true);
  expect(prompts).toBe(0);
  playing = true;
  expect(lifecycle.requestClose()).toBe(false);
  expect(prompts).toBe(1);
  accepted = true;
  expect(lifecycle.requestClose()).toBe(true);
  expect(prompts).toBe(2);
});

it('terminates the renderer on suspend without a prompt or a resume operation', () => {
  let destroyed = false;
  const lifecycle = new WindowLifecycle({
    isPlaying: () => true,
    confirmClose: () => {
      throw new Error('suspend cannot await confirmation');
    },
    destroy: () => {
      destroyed = true;
    },
  });
  lifecycle.suspend();
  expect(destroyed).toBe(true);
});
