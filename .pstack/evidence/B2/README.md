# B2 handoff evidence

Continuation results in [continuation.md](continuation.md) supersede historical
GTK and unverified-native notes below. Native Electron now passes with the supplied
library path; native-result.json records the observed real catalog journey.

Base: 806a3fbaf8b3f178ae47724afa4d3fbcccdafa12.
Head: the commit containing this evidence (resolve with `git rev-parse HEAD`).

Implemented a responsive performance grid ordered by repertoire.padIds, fixed
STOP/remaining-time/progress, truthful starting/playing/stopping/error displays,
exclusive stopped editing, import, rename-on-blur, immediate color saving, drag
ordering and keyboard ordering alternatives, and Radix deletion confirmation.
Runtime update/reorder operations share the existing edit lease/revision boundary.
No new session, filesystem or audio owner exists in the views.

Renderer fixture journey: 31 pads; rename and blue color; actual drag/drop;
failed save alert; reload persistence; simulated playing media events disable
all pad actions and editing; STOP; scroll to pad 31 with STOP still visible;
delete cancel retains 31, confirm leaves 30; desktop 1280x800 and narrow 560x800.
Screenshots are synthetic fixture content. Native audio is simulated in this
journey and catalog persistence is a finite API fixture using localStorage.
It does NOT establish Electron/filesystem/native-media/physical output behavior.
Run after packaging with `PAD_CHROMIUM_EXECUTABLE=<compatible chromium path>
node .pstack/evidence/B2/render.mjs`; omit the variable with the pinned Playwright
browser installed. This host used cached Chromium headless shell revision 1243.

Interaction names for C2: `Editar repertório`, `Concluir edição`, `Importar áudio`,
`Mover <label>` (drag handle), `Mover <label> para cima/baixo`, region
`Editar <label>` with textbox `Nome` and buttons `Cor slate/red/blue/green/amber`,
`Excluir <label>`, dialog `Excluir <label>?`, `Cancelar`, `Confirmar exclusão`.
Transport names remain `STOP`, `Progresso`, `Tempo restante`. Pad button accessible
names include sequence number, pad label and active text; use scoped locators.

Commands and observed results:

- npm install Radix dialog/progress/scroll-area (and removal of unused select): 0.
- npx vitest run tests/integration/runtime.test.ts: 0; 4 tests passed.
- npm run package: 0; Linux x64 artifact in out/. Build log included.
- renderer fixture journey: 0; runner and screenshots included.
- design detector: 0, [] findings (before final mechanical fixes).
- Electron doctor: 2; libgtk-3.so.0 missing (electron-doctor.json).
- Initial npm run verify: 1; fixed UI lint findings.
- Subsequent npm run verify: 1; unchanged IPC catalog-session test exceeded its
  5000ms timeout under concurrent host work, 168 other tests passed. No timeout
  or check policy changed. Final full run results are recorded below.

Gaps: Native Electron journey cannot execute on this host without GTK. Target
Mac/interface, Windows runtime, actual band codecs and physical performance
remain unverified. No performance number is claimed: no target hardware,
baseline or physical click/silence measurement is available. No nested design
review agent was spawned, as the implementation brief prohibits nested agents;
render inspection and actual diff inspection were performed in this lane.

Final full verification: `npm run verify` exit 0. Static checks passed, Vitest
passed 170 tests (before transport helper landed); the mutation initial run
passed all 172 tests including that helper. Mutation: 1010 detected, 0 survived,
0 uncovered, 0 errors; 1 detected by timeout. Scope includes order.ts (7 killed),
transport.ts (19 killed), desktop.ts (46 killed), and the existing graph.
The compressed full mutation JSON and full verify log accompany this handoff.
No mutation discovery/configuration patch is needed: both new behavior helpers
already match the accepted renderer performance/editing globs.
