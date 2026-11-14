import type { SessionId } from '../../contracts/catalog';
import { desktopOperations } from '../../contracts/desktop';
import { ErrorCode, LeaseKind } from '../../contracts/operations';
import { CatalogFault } from '../storage/catalog-store';

export class RendererLifetime {
  private terminated = false;
  private playback = false;
  private termination: Promise<void> | null = null;
  get playing(): boolean {
    return this.playback;
  }
  private session: SessionId | null = null;
  private pending: Promise<void> = Promise.resolve();
  constructor(
    private readonly close: (sessionId: SessionId) => Promise<void>,
  ) {}
  async run(channel: string, action: () => Promise<unknown>): Promise<unknown> {
    if (this.terminated) throw new CatalogFault(ErrorCode.Unauthorized);
    const work = this.observe(channel, action);
    this.pending = Promise.allSettled([this.pending, work]).then(
      () => undefined,
    );
    return await work;
  }

  private async observe(channel: string, action: () => Promise<unknown>) {
    const response = await action();
    if (channel === desktopOperations.openSession.channel) {
      const result = desktopOperations.openSession.response.parse(response);
      if (result.ok) this.session = result.value;
    }
    if (channel === desktopOperations.disposeSession.channel) {
      const result = desktopOperations.disposeSession.response.parse(response);
      if (result.ok) this.session = null;
    }
    if (channel === desktopOperations.acquire.channel) {
      const result = desktopOperations.acquire.response.parse(response);
      if (result.ok) this.playback = result.value.kind === LeaseKind.Playback;
    }
    if (channel === desktopOperations.release.channel) {
      const result = desktopOperations.release.response.parse(response);
      if (result.ok) this.playback = false;
    }
    return response;
  }
  terminate(): Promise<void> {
    this.terminated = true;
    this.termination ??= this.drain().catch((error: unknown) => {
      this.termination = null;
      throw error;
    });
    return this.termination;
  }
  private async drain(): Promise<void> {
    await this.pending;
    if (this.session !== null) await this.close(this.session);
    this.session = null;
    this.playback = false;
  }
}
