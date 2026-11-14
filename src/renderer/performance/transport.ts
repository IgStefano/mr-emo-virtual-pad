import { PlaybackStatus } from '../../domain/playback';
import type { PlaybackSnapshot } from '../playback/controller';

export const TransportStatus = {
  Starting: 'Iniciando',
  Playing: 'Reproduzindo',
  Stopping: 'Parando',
  Stopped: 'Parado',
} as const;

export function transport(snapshot: PlaybackSnapshot) {
  const state = snapshot.state;
  const active = state.status === PlaybackStatus.Stopped ? null : state.padId;
  const status = snapshot.busy
    ? state.status === PlaybackStatus.Starting
      ? TransportStatus.Starting
      : state.status === PlaybackStatus.Playing
        ? TransportStatus.Playing
        : TransportStatus.Stopping
    : TransportStatus.Stopped;
  const remaining = Math.max(
    0,
    snapshot.busy
      ? Math.ceil(snapshot.durationSeconds - snapshot.positionSeconds)
      : 0,
  );
  const progress =
    snapshot.durationSeconds > 0
      ? (snapshot.positionSeconds / snapshot.durationSeconds) * 100
      : 0;
  return { active, status, remaining, progress };
}
