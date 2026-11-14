# A2 coordinator corrections

The independent review proved bootstrap reused a rejected cleanup promise.
Cleanup now has one shared in-flight/successful promise, cleared on rejection.
Later quit requests call that retryable action rather than a failed snapshot.
The public composition regression uses RendererLifetime, ApplicationShutdown and
the actual cleanup wrapper; it observes two attempts after failure, one final
resource close and one authorized quit.

The native retry probe injects one SQLite close failure and a later quit request.
It asserts sandbox/profile identity, two close attempts, no third close, and the
native will-quit event after authorization. Main-inspector transport complicates
observing OS process exit, so the harness terminates its own debugger child after
that event and waits for child exit before deleting its profile. This is native
quit authorization evidence, not physical I/O failure or normal-process-exit
measurement. Earlier probe attempts failed because they assumed automatic retry
or conflated debugger-child exit with application quit; those are not passes.

Coordinator focused tests passed 14 cases. Packaging and the corrected retry
probe exited 0. The adapted A2 native lifecycle probe also exited 0 against the
combined B2 UI: pending import drains after window closure, cancel preserves
playback, synthetic suspend exits, and confirmed close/restarts remain stopped.
Originals and managed bytes were compared. Native power/output is not inferred.

The only product copy change translates the native close confirmation into
Portuguese. No backend, IPC, audio or mutation policy was weakened. Full normal
commit-hook verification checks the combined tree before this correction lands.
