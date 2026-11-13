# Runtime feasibility probes

S1 prepares instruments. Target compatibility remains BLOCKED until packaged
Windows and macOS runs and the drummer's Mac/interface session exist. Host Node
results do not select the SQLite driver. No application wiring changes here.

## SQLite

Run `node scripts/probes/sqlite.mjs` for host diagnostics and
`node --test tests/runtime/*.test.mjs` for the standalone regression check.
The probe creates a unique temporary database, checks committed rows after close
and reopen, failed foreign-key inserts/deletes, transaction rollback, and both
rolled-back and committed schema migrations. It removes only its own directory.
Errors exit nonzero. Preserve stdout and stderr, including experimental warnings.

C1/integrator must include the module in a dedicated packaged main-process probe
entry and call `await probeSqlite()` after Electron is ready. Add `app.isPackaged`,
`app.getVersion()`, build SHA, package hash and OS version to the report. Require
`app.isPackaged === true` in that harness. Do not use Electron's host Node mode as
packaged evidence. The report's default `runtime.packaged: false` deliberately
prevents a host run from posing as packaged evidence. Keep sandbox and preload
settings intact. Run the shipped binary on each target architecture with an
isolated userData profile, save JSON/stderr and exit nonzero on rejection.

Record the pinned Electron and embedded Node versions from the running binary,
SQLite version and node:sqlite warnings. Check that embedded runtime's documented
API/stability before accepting this driver. Unavailable node:sqlite is a failed
candidate, not permission to silently install a fallback. Probe schema is not the
production catalog migration or future-schema recovery implementation.

## Audio and protocol

C1 may evaluate `probeAudioProtocol` from `scripts/probes/audio-protocol.mjs` in
the actual packaged renderer via its automation harness. It takes an authorized
managed-media URL, declared MIME and 16 independently known source bytes. It
requires HTTP-style 206, exact Content-Range and matching bytes, then loads real
HTMLAudioElement metadata with a timeout. It releases the element afterward.
Return the report to the harness and retain thrown errors. This module is not a
preload API. Do not disable CSP or expose arbitrary filesystem paths to load it.
No current managed-media handler exists, so execution is BLOCKED pending I1/C1.

For each representative band file record SHA-256, byte length, container, codec,
channels, sample rate, duration, MIME, source of those facts, returned report,
play success/error and audible stereo routing. Include MP3/AAC/FLAC/WAV only as
candidates, never as a claimed supported list. Use a redistributable stereo file
with distinct left/right content for repeatable routing checks, plus a real long
track. canPlayType and metadata alone do not establish decoding to the end.

The harness must additionally exercise HEAD, full GET, suffix/open-ended ranges,
unsatisfiable range (416), malformed range, invalid IDs, traversal attempts,
unauthorized windows and cancellation. Compare bytes against source fixtures;
observe bounded streaming memory during the long-file run. These remain pending
handler integration and are not covered by the prefix probe.

## Physical session recipe

Record Mac model/architecture, OS, interface model/firmware, driver, output device,
sample rate, buffer setting, connection, power mode and exact app/package hash.
Keep OS volume/file levels fixed. Agree acceptable first-sound and STOP limits
with the drummer before the run. No numerical limits are assumed here.

Use a two-channel loopback recording with a common clock. Capture an electrical
or recorded input-event marker on one channel and interface output on the other.
Report marker-to-first-sound and STOP-marker-to-silence in milliseconds using a
stated amplitude threshold, sample rate, trial count and raw recordings. Establish
baseline with the same file/interface/settings in the current trusted player.
Measure cold and warm starts separately, preserve every trial and report median,
worst and failures. DOM playing/pause events are software observations only.

Record process-tree resident memory at stopped baseline, during a long track and
after STOP using the same OS tool/sampling interval for baseline and candidate.
Save raw samples and track duration. Record unplug/replug, output switching,
sleep/wake and app close during playback. Verify no automatic resume, no second
track, correct STOP behavior and stopped reopening. Run the intended offline
repertoire session. Missing hardware, files, limits or raw capture means BLOCKED.

## Integrator handoff

No shared edits are needed to run the standalone probes. To gate their Node
regression in shared verify, the concrete proposed package.json edit is to append
` && node --test tests/runtime/*.test.mjs` to `verify:static`. The integrator owns
that edit. Current Vitest and Stryker scopes do not discover these MJS probes.
They are diagnostic instruments, not production behavior and carry no mutation
coverage claim. Production adapters must receive their own behavior tests and
mutation scope when integrated. Do not lower existing thresholds.
