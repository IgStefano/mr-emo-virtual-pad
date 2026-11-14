import type { SessionId } from '../../contracts/catalog';
import { desktopOperations } from '../../contracts/desktop';
import { ErrorCode } from '../../contracts/operations';
import { CatalogFault } from '../storage/catalog-store';

export class RendererLifetime {
  private terminated = false;
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
    return response;
  }
  async terminate(): Promise<void> {
    this.terminated = true;
    await this.pending;
    if (this.session !== null) await this.close(this.session);
    this.session = null;
  }
}
