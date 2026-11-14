import { desktopOperations } from '../../contracts/desktop';
import type { DesktopApi } from '../../contracts/desktop';
import { attemptIdSchema } from '../../contracts/catalog';
import type { Catalog, PadId, Pad } from '../../contracts/catalog';
import { LeaseKind, ErrorCode } from '../../contracts/operations';
import type {
  LeaseAuthority,
  OperationError,
  CatalogOperations,
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
  async function mutate(
    operation: (
      request: Parameters<CatalogOperations['importAudio']>[0],
    ) => Promise<Awaited<ReturnType<DesktopApi['importAudio']>>>,
  ): Promise<Catalog> {
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
        catalog = unwrap(await operation(request));
        return catalog;
      } finally {
        unwrap(await api.release(lease));
      }
    } finally {
      editing = false;
    }
  }
  function edit(padId?: PadId) {
    return mutate((request) =>
      padId === undefined
        ? api.importAudio(request)
        : api.deletePad({ ...request, padId }),
    );
  }
  function update(pad: Pad) {
    return mutate((request) =>
      api.updatePad({
        ...request,
        padId: pad.id,
        label: pad.label,
        color: pad.color,
      }),
    );
  }
  function reorder(padIds: PadId[]) {
    return mutate((request) => api.reorderPads({ ...request, padIds }));
  }
  return {
    playback,
    get catalog() {
      return catalog;
    },
    edit,
    update,
    reorder,
  };
}
export type DesktopRuntime = Awaited<ReturnType<typeof connectDesktop>>;
