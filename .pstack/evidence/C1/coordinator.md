# Coordinator C1 verification

Reviewed source 75dadde044f4c12e1ca45382bee4e87f9badd100 through
e5dade7f9f6b7d7a54d58b955e55cebcba7f7bfe and integrated as 69d70ca.
Fixture regression passed. Installed no system packages: downloaded Ubuntu 22.04
libgtk-3-0 3.24.33-1ubuntu2.2 and libepoxy0 1.5.10-1 into the user's runtime cache
and extracted with dpkg-deb. WSLg display and unprivileged namespaces were already
available. No sandbox flag or release fuse was weakened.

Live invocation used:

```sh
LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu node scripts/verification/run.mjs drive
```

The first actual journey exposed a test defect: Electron 45's last-web-preferences
snapshot did not contain the preload path. Changing the probe URL did not fix it.
The runtime evidence disproved that reflection assumption. The harness now uses
the explicit built preload, creates a second same-origin window and records that
its real bridge exists and receives Unauthorized IPC sender. Navigation listener
registration also precedes the click so the test does not race itself.

coordinator-live/result.json records PASS. The actual unpackaged Electron 45.3.2
window used its disposable userData directory; bridge version, sandbox/isolation,
unauthorized sender, navigation and popup denial passed. Screenshot and trace
survived cleanup. The profile was removed. No playback, packaged-release or
physical Mac result is claimed.
