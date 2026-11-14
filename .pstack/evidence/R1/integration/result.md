# R1 coordinator integration

Reviewed the worker diff at `6927470ec10b8a32c31be87cd7740d8b2b75df73` and
integrated it as `f28328d`. Product sources and dependency lockfile are unchanged.
The workflow explicitly selects native Mac arm64, Mac Intel and Windows x64,
uses full history for accepted-commit ancestry checks, preserves failure reports,
and separates archive presence from scenario success. The runner labels were
independently checked against GitHub's runner reference on 2026-11-14.

The guide's backup/recovery description was compared with the implemented
library layout and startup recovery. The suspend checklist now explicitly says
the app closes and must be reopened stopped, matching WindowLifecycle.suspend.
No platform runtime, physical output or signing success is inferred from ZIPs.

Worker verification passed 208 tests and 1,204 mutations (1,203 Killed, one
classified EOF Timeout). Its normal hook also passed. Coordinator checks shell
syntax, release-manifest generation and source equality before committing this
documentation correction through the unchanged normal hook. The generated
manifest records dirty documentation honestly. Pre-push packaging remains enabled.

R1 remains active: native CI results/private artifacts and a Mac arm64 artifact
are not yet observed. S1 physical acceptance remains separate. SSH publication
is available; no GitHub API token, authenticated CLI or credential helper is
available for reading private Actions runs or retrieving their artifacts.
No code approval from the operator is required.
