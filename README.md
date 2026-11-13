<img src="assets/icon.svg" width="64" height="64" alt="">

# Mr. Emo Virtual Pad

Offline desktop pad for the band's drummer. Electron + React + TypeScript,
layered modules, executable architecture checks and mutation testing from the
first playback rule.

## Development

Requires Node 24 (>=24.15), npm and a desktop capable of running Electron.

```sh
npm ci
npm start
```

The current shell shows an empty repertoire. Import, real audio playback,
SQLite persistence and editing will be implemented in subsequent increments.
The initial domain models playback intentions and stale-attempt rejection.

## Checks and builds

```sh
npm run verify          # format, lint, types, layers, guardrails, tests, mutation
npm run test:mutation   # HTML/JSON in reports/mutation
npm run package         # native unpacked Electron application in out/
npm run make            # native unsigned ZIP in out/make/
```

Run `npm run format` to format source/configuration. Use `npm ci` in automation;
versions are pinned in package-lock.json. Build Mac releases on macOS and Windows
releases on Windows. GitHub Actions defines checks plus native packaging on both
platforms; signing and notarization are not configured.

See [specification](docs/spec.md), [architecture](docs/architecture.md),
[verification](docs/verification.md), [toolchain notes](docs/dependencies.md) and the
[research proposal v2](docs/research/architecture-proposal-v2.md).

The [delivery plan](docs/delivery-plan.md) defines parallel lanes, dependencies and
acceptance gates through the Mac release.

The [pstack setup](.pstack/README.md) installs the pinned upstream skills and
provides ready-task checks and worktree delegation briefs for Codex/T3.
