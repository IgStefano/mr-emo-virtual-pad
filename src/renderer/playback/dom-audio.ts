import type { AssetId, LeaseId } from '../../contracts/catalog';
import { AudioEventKind, ErrorCode } from '../../contracts/operations';
import type { AudioEvent, AudioExecutor } from '../../contracts/operations';

export interface AudioElement extends EventTarget {
  autoplay: boolean;
  loop: boolean;
  src: string;
  currentTime: number;
  readonly duration: number;
  play: () => Promise<void>;
  pause: () => void;
  load: () => void;
  removeAttribute: (name: string) => void;
}

type Start = Parameters<AudioExecutor['start']>[0];
interface Resource {
  readonly request: Start;
  readonly element: AudioElement;
  readonly detach: () => void;
}

export class DomAudioExecutor implements AudioExecutor {
  private resource: Resource | null = null;
  private disposed = false;
  private readonly listeners = new Set<(event: AudioEvent) => void>();

  constructor(
    private readonly resolve: (assetId: AssetId, leaseId: LeaseId) => string,
    private readonly createElement: () => AudioElement = () =>
      document.createElement('audio'),
  ) {}

  async start(request: Start): Promise<void> {
    if (this.disposed || this.resource) throw new Error(ErrorCode.AudioFailure);
    const element = this.createElement();
    const emit = (kind: AudioEvent['kind']) => {
      if (this.resource?.request !== request) return;
      for (const listener of this.listeners) {
        try {
          listener({
            kind,
            attemptId: request.attemptId,
            positionSeconds: element.currentTime,
            durationSeconds: Number.isFinite(element.duration)
              ? element.duration
              : 0,
          });
        } catch {
          this.listeners.delete(listener);
        }
      }
    };
    const playing = () => {
      emit(AudioEventKind.Started);
    };
    const ended = () => {
      emit(AudioEventKind.Ended);
    };
    const failed = () => {
      emit(AudioEventKind.Failed);
    };
    const progress = () => {
      emit(AudioEventKind.Progress);
    };
    element.addEventListener('playing', playing);
    element.addEventListener('ended', ended);
    element.addEventListener('error', failed);
    element.addEventListener('timeupdate', progress);
    this.resource = {
      request,
      element,
      detach: () => {
        element.removeEventListener('playing', playing);
        element.removeEventListener('ended', ended);
        element.removeEventListener('error', failed);
        element.removeEventListener('timeupdate', progress);
      },
    };
    element.autoplay = false;
    element.loop = false;
    element.src = this.resolve(request.assetId, request.leaseId);
    element.currentTime = request.offset;
    await element.play();
  }

  stop(attemptId: Start['attemptId']): Promise<void> {
    const resource = this.resource;
    if (resource?.request.attemptId === attemptId) {
      resource.element.pause();
      resource.detach();
      resource.element.removeAttribute('src');
      resource.element.load();
      this.resource = null;
    }
    return Promise.resolve();
  }

  subscribe(listener: (event: AudioEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.resource) await this.stop(this.resource.request.attemptId);
  }
}
