import { appInfoChannel, appInfoSchema } from '../contracts/app-info';
import { desktopOperations } from '../contracts/desktop';
import type { DesktopApi } from '../contracts/desktop';
import type { z } from 'zod';
export function createDesktopApi(
  invoke: (channel: string, payload?: unknown) => Promise<unknown>,
): DesktopApi {
  function bind<I extends z.ZodType, O extends z.ZodType>(operation: {
    channel: string;
    request: I;
    response: O;
  }) {
    return async (request: z.input<I>): Promise<z.output<O>> =>
      operation.response.parse(
        await invoke(operation.channel, operation.request.parse(request)),
      );
  }
  return {
    getAppInfo: async () => appInfoSchema.parse(await invoke(appInfoChannel)),
    openSession: bind(desktopOperations.openSession),
    getCatalog: bind(desktopOperations.getCatalog),
    acquire: bind(desktopOperations.acquire),
    release: bind(desktopOperations.release),
    disposeSession: bind(desktopOperations.disposeSession),
    importAudio: bind(desktopOperations.importAudio),
    updatePad: bind(desktopOperations.updatePad),
    reorderPads: bind(desktopOperations.reorderPads),
    deletePad: bind(desktopOperations.deletePad),
  };
}
