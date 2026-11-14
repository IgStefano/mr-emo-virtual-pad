# Coordinator protocol corrections

Independent review at 42fed3ac13a90d6c025c3a7bb803e7f3c2d81f63 proved incorrect
HEAD/Range handling and identified a conditional Windows cross-volume containment
gap. The original report is preserved in independent-review.md.

HEAD now ignores Range and reports the full representation. GET ignores unknown
range units and accepts case-insensitive byte units, following RFC 9110 sections
14.1 and 14.2: https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2.
The application adapter also rejects absolute results from path.relative, as can
occur between Windows volumes. The regression drives the public handler using
real temporary files and Windows path semantics at the path boundary. It does
not claim an executed cross-volume Windows disclosure or target-platform pass.

The original timeout was mutant 618 in media-protocol.ts, replacing the zero-byte
read guard at line 142 with false. The original detailed report records
ConditionalExpression, status Timeout, reason Hit limit reached (1201/1200).
zero-read-result.json reproduces the cause in an isolated process: the baseline
rejects Unexpected end of media after truncation, while the mutant consumes
without completing until the parent terminates it after three seconds. Both
processes use real files. The parent removes temporary files even on termination.
The diagnostic source is preserved as zero-read-probe.cjs.txt; run its executable
copy from the project root with Node. No production source is changed by it.

The first repaired mutation run failed with two survivors. One was a redundant
null guard before range-unit detection; the other exposed missing coverage for
a malformed bytes-prefixed value containing a second bytes token. The guard was
simplified and a public response regression was added. No gate was weakened.

Final npm run verify exited 0: 150 tests passed, 756 mutants were killed and one
was detected by timeout. There were no survivors or uncovered mutants. The final
timeout is mutant 628 at line 147, the same zero-read guard, with reason Hit limit
reached (1501/1500). Detailed mutation.json and verify.log accompany this record.
The updated public-method tests reject the original reviewed implementations;
restoring the corrected files passes. Regression logs preserve both outcomes.
Electron composition and successful media playback remain
I1. O_NOFOLLOW portability and hostile-directory replacement need A2/target
evidence; these changes do not claim Windows symlink protection was executed.
