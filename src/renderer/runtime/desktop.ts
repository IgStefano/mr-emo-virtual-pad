import { desktopOperations } from '../../contracts/desktop';
import type { DesktopApi } from '../../contracts/desktop';
import { attemptIdSchema } from '../../contracts/catalog';
import type { Catalog, PadId } from '../../contracts/catalog';
import { LeaseKind, ErrorCode } from '../../contracts/operations';
import type {
  LeaseAuthority,
  OperationError,
} from '../../contracts/operations';
import { PlaybackController } from '../playback/controller';
import { DomAudioExecutor } from '../playback/dom-audio';

export function unwrap<T>(
  result: { ok: true; value: T } | { ok: false; error: OperationError },
): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}
export async function connectDesktop(api: DesktopApi) {
  const sessionId = unwrap(await api.openSession(null));
  const leases: LeaseAuthority = {
    acquire: async (request) => {
      return unwrap(
        await api.acquire(desktopOperations.acquire.request.parse(request)),
      );
    },
    release: async (lease) => {
      unwrap(await api.release(desktopOperations.release.request.parse(lease)));
    },
    disposeSession: async (id) => {
      unwrap(await api.disposeSession({ sessionId: id }));
    },
  };
  const playback = new PlaybackController(
    new DomAudioExecutor(
      (asset, lease) => `pad-media://media/${asset}?lease=${lease}`,
    ),
    leases,
    sessionId,
  );
  let catalog = unwrap(await api.getCatalog({ sessionId }));
  let editing = false;
  let sequence = 0;
  async function edit(padId?: PadId): Promise<Catalog> {
    if (editing || playback.snapshot().busy) throw new Error(ErrorCode.Busy);
    editing = true;
    try {
      const lease = unwrap(
        await api.acquire({
          sessionId,
          kind: LeaseKind.Edit,
          attemptId: attemptIdSchema.parse(++sequence),
        }),
      );
      try {
        const request = {
          lease: { ...lease, kind: LeaseKind.Edit },
          expectedRevision: catalog.revision,
        };
        catalog = unwrap(
          await (padId === undefined
            ? api.importAudio(request)
            : api.deletePad({ ...request, padId })),
        );
        return catalog;
      } finally {
        unwrap(await api.release(lease));
      }
    } finally {
      editing = false;
    }
  }
  return { playback, catalog, edit };
}
export type DesktopRuntime = Awaited<ReturnType<typeof connectDesktop>>;
