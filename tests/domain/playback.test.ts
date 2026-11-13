import { describe, expect, it } from 'vitest';
import {
  transition,
  PlaybackStatus,
  PlaybackInputType,
  PlaybackEffectType,
  type PlaybackState,
} from '../../src/domain/playback';

const stopped: PlaybackState = { status: PlaybackStatus.Stopped };
const starting: PlaybackState = {
  status: PlaybackStatus.Starting,
  padId: 'A',
  attempt: 7,
};
const playing: PlaybackState = {
  status: PlaybackStatus.Playing,
  padId: 'A',
  attempt: 7,
};

describe('playback contract', () => {
  it('starts a chosen pad from zero with its attempt', () => {
    expect(
      transition(stopped, {
        type: PlaybackInputType.Play,
        padId: 'B',
        attempt: 8,
      }),
    ).toEqual({
      state: { status: PlaybackStatus.Starting, padId: 'B', attempt: 8 },
      effects: [
        { type: PlaybackEffectType.Start, padId: 'B', attempt: 8, offset: 0 },
      ],
    });
  });

  it.each([starting, playing])('ignores every pad while $status', (state) => {
    expect(
      transition(state, {
        type: PlaybackInputType.Play,
        padId: 'A',
        attempt: 8,
      }),
    ).toEqual({ state, effects: [] });
    expect(
      transition(state, {
        type: PlaybackInputType.Play,
        padId: 'B',
        attempt: 9,
      }),
    ).toEqual({ state, effects: [] });
  });

  it.each([starting, playing])(
    'STOP cancels the current attempt while $status',
    (state) => {
      expect(transition(state, { type: PlaybackInputType.Stop })).toEqual({
        state: stopped,
        effects: [{ type: PlaybackEffectType.Stop, attempt: 7 }],
      });
    },
  );

  it('STOP is idempotent', () => {
    expect(transition(stopped, { type: PlaybackInputType.Stop })).toEqual({
      state: stopped,
      effects: [],
    });
  });

  it('promotes only the current starting attempt', () => {
    expect(
      transition(starting, { type: PlaybackInputType.Started, attempt: 7 }),
    ).toEqual({
      state: playing,
      effects: [],
    });
    for (const state of [stopped, playing]) {
      expect(
        transition(state, { type: PlaybackInputType.Started, attempt: 7 }),
      ).toEqual({
        state,
        effects: [],
      });
    }
    expect(
      transition(starting, { type: PlaybackInputType.Started, attempt: 6 }),
    ).toEqual({
      state: starting,
      effects: [],
    });
  });

  it.each([PlaybackInputType.Ended, PlaybackInputType.Failed] as const)(
    '%s cleans up only the current attempt',
    (type) => {
      for (const state of [starting, playing]) {
        expect(transition(state, { type, attempt: 7 })).toEqual({
          state: stopped,
          effects: [{ type: PlaybackEffectType.Stop, attempt: 7 }],
        });
        expect(transition(state, { type, attempt: 6 })).toEqual({
          state,
          effects: [],
        });
      }
      expect(transition(stopped, { type, attempt: 7 })).toEqual({
        state: stopped,
        effects: [],
      });
    },
  );

  it('ignores callbacks from a stopped attempt after a new pad is requested', () => {
    const cancelled = transition(starting, { type: PlaybackInputType.Stop });
    const next = transition(cancelled.state, {
      type: PlaybackInputType.Play,
      padId: 'B',
      attempt: 8,
    });
    for (const type of [
      PlaybackInputType.Started,
      PlaybackInputType.Ended,
      PlaybackInputType.Failed,
    ] as const) {
      expect(transition(next.state, { type, attempt: 7 })).toEqual({
        state: next.state,
        effects: [],
      });
    }
    expect(next.effects).toEqual([
      { type: PlaybackEffectType.Start, padId: 'B', attempt: 8, offset: 0 },
    ]);
  });

  it('does not mutate the input snapshot', () => {
    const state = Object.freeze({
      status: PlaybackStatus.Starting,
      padId: 'A',
      attempt: 7,
    } as const);
    transition(state, { type: PlaybackInputType.Started, attempt: 7 });
    expect(state).toEqual(starting);
  });
});

it('keeps the serialized playback vocabulary stable for adapters', () => {
  expect(PlaybackStatus).toEqual({
    Stopped: 'stopped',
    Starting: 'starting',
    Playing: 'playing',
  });
  expect(PlaybackInputType).toEqual({
    Play: 'play',
    Stop: 'stop',
    Started: 'started',
    Ended: 'ended',
    Failed: 'failed',
  });
  expect(PlaybackEffectType).toEqual({ Start: 'start', Stop: 'stop' });
});
