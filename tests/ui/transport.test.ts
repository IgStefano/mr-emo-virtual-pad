import { expect, it } from 'vitest';
import { transport } from '../../src/renderer/performance/transport';
import { PlaybackStatus } from '../../src/domain/playback';

it('reports acquisition, playback, cleanup and fully stopped distinctly', () => {
  const values = {
    busy: true,
    positionSeconds: 10.2,
    durationSeconds: 60,
    failed: false,
  };
  expect(
    transport({
      ...values,
      state: { status: PlaybackStatus.Starting, padId: 'pad', attempt: 1 },
    }),
  ).toEqual({
    active: 'pad',
    status: 'Iniciando',
    remaining: 50,
    progress: 17,
  });
  expect(
    transport({
      ...values,
      state: { status: PlaybackStatus.Playing, padId: 'other', attempt: 1 },
    }),
  ).toEqual({
    active: 'other',
    status: 'Reproduzindo',
    remaining: 50,
    progress: 17,
  });
  expect(
    transport({ ...values, state: { status: PlaybackStatus.Stopped } }),
  ).toEqual({ active: null, status: 'Parando', remaining: 50, progress: 17 });
  expect(
    transport({
      ...values,
      busy: false,
      positionSeconds: 0,
      state: { status: PlaybackStatus.Stopped },
    }),
  ).toEqual({ active: null, status: 'Parado', remaining: 0, progress: 0 });
});
it('does not show negative remaining time or invent duration while starting', () => {
  const state = { status: PlaybackStatus.Starting, padId: 'pad', attempt: 1 };
  expect(
    transport({
      state,
      busy: true,
      positionSeconds: 0,
      durationSeconds: 0,
      failed: false,
    }),
  ).toEqual({ active: 'pad', status: 'Iniciando', remaining: 0, progress: 0 });
  expect(
    transport({
      state,
      busy: true,
      positionSeconds: 61,
      durationSeconds: 60,
      failed: true,
    }).remaining,
  ).toBe(0);
});
