# DMG delivery preparation

Added Electron Forge maker-dmg 8.0.1, matching the pinned Forge suite. The maker
is enabled only on a macOS host and targets darwin. The native Mac arm64/x64 CI
jobs now upload `out/make/dmg` alongside ZIPs. The artifact manifest recursively
hashes both formats. Developer signing and notarization remain unconfigured.

This Linux/WSL host cannot execute the official DMG maker. The first cross-make
attempt proved the restriction: maker-dmg rejected linux before packaging. No
image with a misleading extension was created. Host-based enablement keeps ZIP
cross-build available without disabling any release fuse. The repeated darwin/x64
make exited 0 and produced the Intel ZIP. Its macOS runtime remains unexecuted.

Confirmed installed maker implementation writes to `out/make/dmg/<arch>`.
Fresh artifact-manifest generation and diff checks exited 0. Normal commit-hook
verification and pre-push packaging validate integration before publication.
No DMG or Apple Silicon artifact is claimed from this host. Native CI/artifact
access remains unavailable, and the physical Mac acceptance remains outstanding.
