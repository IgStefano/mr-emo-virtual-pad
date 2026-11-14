import { z } from 'zod';
import { desktopOperations } from '../../contracts/desktop';
import { ErrorCode } from '../../contracts/operations';
import { CatalogFault } from '../storage/catalog-store';
import type { CatalogSessionService } from './catalog-session';

export interface SenderEvent {
  sender: object;
  senderFrame: object | null;
}
export interface RegistrationPort {
  handle: (
    channel: string,
    handler: (event: SenderEvent, payload: unknown) => Promise<unknown>,
  ) => void;
}
export function registerDesktopIpc(
  port: RegistrationPort,
  service: CatalogSessionService,
  owner: {
    sender: object;
    mainFrame: object;
    getURL: () => string;
    url: string;
  },
): void {
  function register<I extends z.ZodType>(
    operation: { channel: string; request: I; response: z.ZodType },
    action: (request: z.output<I>) => Promise<unknown>,
  ) {
    port.handle(operation.channel, async (event, payload) => {
      try {
        if (
          event.sender !== owner.sender ||
          event.senderFrame !== owner.mainFrame ||
          owner.getURL() !== owner.url
        )
          throw new CatalogFault(ErrorCode.Unauthorized);
        const request = operation.request.parse(payload);
        return operation.response.parse({
          ok: true,
          value: await action(request),
        });
      } catch (error) {
        return operation.response.parse({
          ok: false,
          error: {
            code:
              error instanceof CatalogFault
                ? error.code
                : error instanceof z.ZodError
                  ? ErrorCode.InvalidRequest
                  : ErrorCode.StorageFailure,
          },
        });
      }
    });
  }
  register(desktopOperations.openSession, service.openSession);
  register(desktopOperations.getCatalog, service.getCatalog);
  register(desktopOperations.acquire, service.acquire);
  register(desktopOperations.release, service.release);
  register(desktopOperations.disposeSession, service.disposeSession);
  register(desktopOperations.importAudio, service.importAudio);
  register(desktopOperations.updatePad, service.updatePad);
  register(desktopOperations.reorderPads, service.reorderPads);
  register(desktopOperations.deletePad, service.deletePad);
}
