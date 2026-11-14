import { attemptIdSchema } from '../../contracts/catalog';
import type { AssetId, PadId, SessionId } from '../../contracts/catalog';
import {
  AudioEventKind,
  ErrorCode,
  LeaseKind,
} from '../../contracts/operations';
import type {
  AudioEvent,
  AudioExecutor,
  Lease,
  LeaseAuthority,
  Unsubscribe,
} from '../../contracts/operations';
import {
  PlaybackInputType,
  PlaybackStatus,
  transition,
} from '../../domain/playback';
import type { PlaybackState } from '../../domain/playback';

export interface PlaybackSnapshot {
  readonly state: PlaybackState;
  readonly busy: boolean;
  readonly positionSeconds: number;
  readonly durationSeconds: number;
  readonly failed: boolean;
}
interface Attempt {
  readonly id: ReturnType<typeof attemptIdSchema.parse>;
  valid: boolean;
  lease: Lease | null;
  startup: Promise<void>;
}

export class PlaybackController {
  private state: PlaybackState = { status: PlaybackStatus.Stopped };
  private attempt: Attempt | null = null;
  private sequence = 0;
  private disposed = false;
  private cleanup: Promise<void> | null = null;
  private positionSeconds = 0;
  private durationSeconds = 0;
  private failed = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: Unsubscribe;

  constructor(
    private readonly audio: AudioExecutor,
    private readonly leases: LeaseAuthority,
    private readonly sessionId: SessionId,
  ) {
    this.unsubscribe = audio.subscribe((event) => {
      this.receive(event);
    });
  }

  snapshot(): PlaybackSnapshot {
    return {
      state: this.state,
      busy: this.attempt !== null,
      positionSeconds: this.positionSeconds,
      durationSeconds: this.durationSeconds,
      failed: this.failed,
    };
  }

  subscribe(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  play(padId: PadId, assetId: AssetId): Promise<void> {
    if (this.disposed || this.attempt) return Promise.resolve();
    const attempt: Attempt = {
      id: attemptIdSchema.parse(++this.sequence),
      valid: true,
      lease: null,
      startup: Promise.resolve(),
    };
    this.attempt = attempt;
    this.failed = false;
    this.positionSeconds = 0;
    this.durationSeconds = 0;
    this.state = transition(this.state, {
      type: PlaybackInputType.Play,
      padId,
      attempt: attempt.id,
    }).state;
    attempt.startup = this.start(attempt, assetId);
    this.notify();
    return attempt.startup.then(async () => {
      if (!attempt.valid) await this.stop();
    });
  }

  private async start(attempt: Attempt, assetId: AssetId): Promise<void> {
    try {
      attempt.lease = await this.leases.acquire({
        sessionId: this.sessionId,
        attemptId: attempt.id,
        kind: LeaseKind.Playback,
      });
      if (!attempt.valid) return;
      await this.audio.start({
        assetId,
        leaseId: attempt.lease.leaseId,
        attemptId: attempt.id,
        offset: 0,
      });
    } catch {
      attempt.valid = false;
      this.failed = true;
    }
  }

  stop(): Promise<void> {
    const attempt = this.attempt;
    if (!attempt) return Promise.resolve();
    attempt.valid = false;
    this.state = transition(this.state, { type: PlaybackInputType.Stop }).state;
    if (this.cleanup) return this.cleanup;
    this.cleanup = this.finish(attempt).finally(() => {
      this.cleanup = null;
      this.notify();
    });
    this.notify();
    return this.cleanup;
  }

  private async finish(attempt: Attempt): Promise<void> {
    try {
      await this.audio.stop(attempt.id);
      await attempt.startup;
      await this.audio.stop(attempt.id);
      if (attempt.lease) await this.leases.release(attempt.lease);
      this.attempt = null;
      this.positionSeconds = 0;
    } catch {
      this.failed = true;
    }
  }

  private receive(event: AudioEvent): void {
    const attempt = this.attempt;
    if (!attempt?.valid || event.attemptId !== attempt.id) return;
    switch (event.kind) {
      case AudioEventKind.Progress:
        this.positionSeconds = event.positionSeconds;
        this.durationSeconds = event.durationSeconds;
        break;
      case AudioEventKind.Started:
        this.state = transition(this.state, {
          type: PlaybackInputType.Started,
          attempt: attempt.id,
        }).state;
        break;
      case AudioEventKind.Failed:
        this.failed = true;
        this.stop().catch(() => {});
        break;
      case AudioEventKind.Ended:
        this.stop().catch(() => {});
        break;
    }
    this.notify();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.listeners.clear();
    this.unsubscribe();
    await this.stop();
    if (this.attempt) throw new Error(ErrorCode.CleanupRequired);
    await this.audio.dispose();
    await this.leases.disposeSession(this.sessionId);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        this.listeners.delete(listener);
      }
    }
  }
}
