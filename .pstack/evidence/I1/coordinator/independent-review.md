# ISSUES

Review goal is correctness, security and ownership of the offline Electron composition, excluding B2 polish, A2 durability and physical audio acceptance.

Exact HEAD verified before and after review: 8e7df8265c6752ad88d9fe86b0150ca8bd786bb5. Compared with 86234a7360e9e340def4f359853bb32bab9031d9. Tracked working tree remained clean.

## P2. Supported Reload strands the main-side session

Source: src/main/main.ts:125-134 and src/renderer/runtime/desktop.ts:19-20.

Executed on a newly built unpackaged Linux application with a fresh disposable profile and chromiumSandbox true. The default View > Reload menu exists with CmdOrCtrl+R. Calling that actual menu item's click handler with the focused BrowserWindow and WebContents reloads the document. The initial working empty pad becomes “Não foi possível abrir o repertório.” The public window.pad.openSession(null) then returns {ok:false,error:{code:'busy'}}. See reload.json and reload.mjs.

Expected: reload is prevented/removed or the replacement document can obtain a fresh stopped runtime after old work and authority are safely retired. Observed: application UI is unusable after reload until process restart. This reproduces while stopped, without any imported audio.

Inspected cause: lifetime termination only attaches to WebContents destroyed, while Reload replaces its document without destroying WebContents. The renderer always opens a new session; the old session remains in authority. will-navigate does not prevent this real menu action. This is a composition failure rather than an assumed malicious typed caller or physical-device gap. A fix must also consider held playback and pending imports; merely accepting another open would violate ownership.

Minimal reproduction after dependencies/build are present:

```sh
LD_LIBRARY_PATH=/home/igstefano/.cache/mr-emo/electron-runtime/root/usr/lib/x86_64-linux-gnu node reports/i1-review/reload.mjs
```

Output includes before='Seu repertório…', after='Não foi possível abrir o repertório.', open.error.code='busy'. Script invokes the real menu action, not webContents.reload directly. Earlier exploratory menu calls with missing focused-WebContents and CDP keyboard input did not invoke reload and timed out; only the correct menu action supports the finding.

## Other reviewed boundaries

Inspected: privileged schemes register before ready, protocol handlers install before navigation, production CSP forbids network/script escape, and renderer receives only the finite preload API. Desktop IPC checks exact sender, captured main frame and current URL. Application protocol confines paths to bundled files. No new security bypass established.

Inspected: main wraps bridge completion, records successful opens independent of renderer receipt, drains all tracked requests before service termination, revokes media before catalog close. Import owns edit authority across the dialog. Single PlaybackController/DomAudioExecutor remain the playback/native owners; bridge adapters unwrap errors rather than inventing successful authority.

Executed: npm ci, npm run package, and npx vitest run tests/ipc tests/integration/runtime.test.ts all exited zero. The latter passed 20 tests across four files, including lost pending opens, concurrent completion order, failed disposal, cleanup retry and controller release-failure behavior. Logs are in this directory. These public-method tests are not native pending-dialog execution.

Inspected limitation: destroyed starts asynchronous cleanup and window-all-closed quits without awaiting it. A quit during pending import could interrupt cleanup; no corruption/loss reproduction was established. A2 explicitly owns crash/publication/recovery and close confirmation. This review does not promote that durability hypothesis into an additional I1 defect.

## Evidence limits

Coordinator journey/package observations and worker mutation counts were not independently executed here. No full mutation rerun, native lost-open timing injection, native pending-dialog crash probe, packaged playback or physical Mac/interface/codec test was performed. Package build success is not packaged playback. Final physical acceptance remains deferred. No source/tests/config edits, publication, merge or nested agents occurred.

Prove It Works shaped the review by requiring a real menu action and public bridge response before reporting Reload. Type System Discipline kept the accepted typed dependency internals outside speculative findings.
