# Integrator handoff

Only C1-owned paths changed. The accompanying patch proposes package aliases;
apply with `git apply --recount .pstack/evidence/C1/integration.patch` after review.
Add `npm run test:verification` to the shared deterministic checks. Run doctor and
drive after package on desktop Windows/macOS workers and upload the printed
`reports/verification/run-*` directory even on failure. Live Electron MJS must
remain outside Node Vitest/Stryker discovery. No dependency, bootstrap, fuse or CI
change is required to run the direct commands.

The fixture generator is new deterministic behavior. Its standalone Node test is
not included in current verify or Stryker. The coordinator should decide shared
runner integration for tool mutation separately; do not report application
mutation counts as harness mutation coverage. Runtime shell behavior is currently
only an unexecuted live assertion suite on this host, pending GTK/display.

S1 SQLite/package probe integration awaits its accepted runtime probe seam. C1
adds no driver choice. Physical performance is not measured. No baseline, metric
or target Mac/interface is available. Empty-shell assertions cannot prove audio.
