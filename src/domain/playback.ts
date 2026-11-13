export const PlaybackStatus = {
  Stopped: 'stopped',
  Starting: 'starting',
  Playing: 'playing',
} as const;
export type PlaybackStatus =
  (typeof PlaybackStatus)[keyof typeof PlaybackStatus];

export const PlaybackInputType = {
  Play: 'play',
  Stop: 'stop',
  Started: 'started',
  Ended: 'ended',
  Failed: 'failed',
} as const;
export type PlaybackInputType =
  (typeof PlaybackInputType)[keyof typeof PlaybackInputType];

export const PlaybackEffectType = {
  Start: 'start',
  Stop: 'stop',
} as const;
export type PlaybackEffectType =
  (typeof PlaybackEffectType)[keyof typeof PlaybackEffectType];

export type PlaybackState =
  | { readonly status: typeof PlaybackStatus.Stopped }
  | {
      readonly status:
        typeof PlaybackStatus.Starting | typeof PlaybackStatus.Playing;
      readonly padId: string;
      readonly attempt: number;
    };

export type PlaybackInput =
  | {
      readonly type: typeof PlaybackInputType.Play;
      readonly padId: string;
      readonly attempt: number;
    }
  | { readonly type: typeof PlaybackInputType.Stop }
  | {
      readonly type:
        | typeof PlaybackInputType.Started
        | typeof PlaybackInputType.Ended
        | typeof PlaybackInputType.Failed;
      readonly attempt: number;
    };

export type PlaybackEffect =
  | {
      readonly type: typeof PlaybackEffectType.Start;
      readonly padId: string;
      readonly attempt: number;
      readonly offset: 0;
    }
  | { readonly type: typeof PlaybackEffectType.Stop; readonly attempt: number };

export interface PlaybackTransition {
  readonly state: PlaybackState;
  readonly effects: readonly PlaybackEffect[];
}

export function transition(
  state: PlaybackState,
  input: PlaybackInput,
): PlaybackTransition {
  if (state.status === PlaybackStatus.Stopped) {
    if (input.type !== PlaybackInputType.Play) return { state, effects: [] };
    return {
      state: {
        status: PlaybackStatus.Starting,
        padId: input.padId,
        attempt: input.attempt,
      },
      effects: [
        {
          type: PlaybackEffectType.Start,
          padId: input.padId,
          attempt: input.attempt,
          offset: 0,
        },
      ],
    };
  }
  switch (input.type) {
    case PlaybackInputType.Play:
      return { state, effects: [] };
    case PlaybackInputType.Stop:
      return {
        state: { status: PlaybackStatus.Stopped },
        effects: [{ type: PlaybackEffectType.Stop, attempt: state.attempt }],
      };
    case PlaybackInputType.Started:
      if (state.attempt !== input.attempt) return { state, effects: [] };
      return {
        state: { ...state, status: PlaybackStatus.Playing },
        effects: [],
      };
    case PlaybackInputType.Ended:
    case PlaybackInputType.Failed:
      if (state.attempt !== input.attempt) return { state, effects: [] };
      return {
        state: { status: PlaybackStatus.Stopped },
        effects: [{ type: PlaybackEffectType.Stop, attempt: state.attempt }],
      };
  }
}
