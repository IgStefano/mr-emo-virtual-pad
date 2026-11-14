# Remaining runtime integration

Two I1 workers returned verified foundations without an external blocker. Neither
completed the application journey. Repeating the same broad assignment has not
produced a complete slice, so the remaining work is partitioned below. This changes
task ownership, not the layered architecture or product scope.

## M1: local protocols

`src/main/storage/media-protocol.ts` exports `ManagedMediaProtocol`.
Its constructor takes `{ mediaRoot, authorize }`, where `mediaRoot` is an absolute
managed-media directory and `authorize(assetId: AssetId, leaseId: LeaseId)` returns
`Promise<void>`. Authorization runs before opening the managed file and rejects
missing assets, expired leases and non-playback leases.

`handle(request: Request): Promise<Response>` serves only
`pad-media://media/<asset UUID>?lease=<lease UUID>`. It accepts GET and HEAD,
supports byte ranges, and validates the complete URL before filesystem access.
`revoke(leaseId: LeaseId): void` cancels streams belonging to that lease.
`dispose(): void` cancels all remaining streams. Request cancellation also closes
resources. Neither callers nor renderers supply filesystem paths.

`src/main/storage/application-protocol.ts` exports `ApplicationProtocol`.
Its constructor takes the absolute bundled renderer directory.
`handle(request: Request): Promise<Response>` serves local GET/HEAD requests for
`pad-app://app/index.html` and bundled assets below that directory. Other hosts,
methods, traversal and filesystem escapes are rejected. Responses carry MIME
types and a production CSP allowing the local media scheme, with no network access.

These modules use web Request/Response types and Node filesystem adapters. They
do not import Electron or register protocols. Bootstrap owns scheme registration
and installs their handlers after Electron is ready. Dev-server support stays in
bootstrap. M1 owns resource cleanup tests; it does not claim device playback.

## J1: finite bridge and catalog service

`src/main/ipc/catalog-session.ts` exports `CatalogSessionService`. Its constructor
takes `{ authority, catalog, onPlaybackReleased }`. `authority` is SessionAuthority;
`catalog` is ManagedCatalog or its structural public interface, including recover;
`onPlaybackReleased(leaseId: LeaseId): Promise<void>` cancels associated media
resources before authority is released. Bootstrap supplies the callback.

`authorizeMedia(assetId: AssetId, leaseId: LeaseId): Promise<void>` checks the current
playback lease and catalog membership. This is M1's authorization callback.
Normal lease release follows acknowledged renderer cleanup. A failed media cleanup
retains authority and blocks competing edits or playback.

The service provides a main-generated session, catalog reads, playback/edit lease
acquisition and release, import/update/reorder/delete, and session disposal.
Recovery reservations are never exposed as a renderer capability. Import holds
edit authority before opening the dialog, and catalog operations retain it across
asynchronous work. Each operation checks its session and lease ownership.

Session disposal from the bridge refuses held or pending work. A separate
`closeAfterRendererTermination(sessionId: SessionId): Promise<void>` is available
only to bootstrap after destroying the renderer. It cancels media and drains
pending privileged operations before allowing a replacement session. It is never
exposed through preload. Old-session completion cannot authorize new work.

`src/contracts/desktop.ts` defines finite channel names, Zod request/response
schemas and DesktopApi. `src/preload/desktop-bridge.ts` exports a testable
`createDesktopApi(invoke)` factory. Its invoke port accepts a channel and serialized
payload, returning Promise<unknown>; that port is private to preload. The exposed
API contains named methods only. The preload entry passes ipcRenderer.invoke and
publishes the result. Inputs and outputs are parsed, including finite errors.
Existing app-info consumers migrate without a generic invoke escape hatch.

The IPC registration adapter lives under main/ipc. It validates exact authorized
WebContents, main frame and URL before parsing requests or touching the service.
Its owner tests forged senders and malformed DTOs through the registration port.
It does not import M1's implementation or change application bootstrap.

J1 can choose DTO details within these responsibilities. Those details are frozen
when its tests and implementation are accepted, before renderer composition starts.

## I1: composition and real journey

After M1 and J1 are accepted, I1 connects their exports in bootstrap, the existing
playback owners and the renderer. It installs protocols before navigation, binds
the service to the authorized window, and supplies the copied-file metadata
validator and native dialog. It then proves import, persistence across restart,
successful native decode/progress, STOP and delete through the real bridge/media
protocol in a disposable profile. UI primitives use shadcn/ui and Impeccable.

The old empty-shell journey is not this acceptance test. Packaged compatibility
and physical Mac/interface acceptance remain separately identified gates.
