# J1 evidence

Base is e7d10898e94b857470ab34b5241cb9e18723932f. This directory records module acceptance only. It does not replace product or physical-device acceptance.

The finite DesktopApi exposes session opening, catalog reads, playback/edit acquisition, acknowledged release, session disposal and four catalog mutations. Recovery and renderer-termination closure remain main-only. Existing app:info keeps its raw response.

CatalogSessionService holds authority across asynchronous work. Renderer disposal rejects held or pending work. Bootstrap termination prevents new work, drains pending effects, cancels media through the injected callback, and closes authority. Failed cancellation retains the session and lease for retry.

Tests use the public bridge, IPC registration and service APIs. Real CatalogStore SQLite, ManagedCatalog copies and generated stereo PCM WAV metadata are exercised. Dialog and media cleanup are controlled asynchronous ports. Sender identity, frame identity, URL, requests and responses are validated at the boundary. No private state assertions or mutation suppressions are used.

Commands and final results are recorded in commands.tsv and accompanying logs. Earlier mutation failures informed additional behavioral assertions and removal of redundant checks. The threshold remains 100%.

I1 must install the registration adapter for the authorized window, provide its exact main frame and URL getter, supply the native dialog and injected media release callback, connect M1 authorization, and wire renderer workflows. Bootstrap alone calls closeAfterRendererTermination after destroying the renderer. J1 does not import M1. Electron playback and physical Mac/interface acceptance remain integration/release evidence.
