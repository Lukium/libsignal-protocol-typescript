# Build & Testing Handbook

## Current Toolchain

- **Runtime**: Node.js 18+ (WebCrypto available natively)
- **Package manager**: Yarn 4 (node-modules linker, `.yarnrc.yml` committed)
- **Compiler**: TypeScript 5.8 via layered configs (`tsconfig.base.json`, `tsconfig.cjs.json`, `tsconfig.esm.json`)
- **Test runner**: Jest 29 with ts-jest and a custom `TestEnvironment` shim (`src/__test-utils__/custom-jest-environment.js`)

## Everyday Commands

```bash
yarn install --immutable   # install dependencies
yarn test                  # run full suite (maxWorkers=1 to avoid worker crash)
yarn test --coverage       # text + lcov reports in coverage/
yarn build                 # clean + build CJS and ESM bundles with d.ts maps
yarn lint                  # eslint over *.ts
yarn format                # prettier write pass
```

## Coverage & Quality Gates

- Jest currently enforces **80/80/80/80** (statements/lines/functions/branches).
- Latest run (2025-10-19): **97.3% statements / 91.2% branches / 95.0% functions / 97.3% lines** across 273 specs.
- Generated protobuf codecs under `src/protobuf/**` are excluded from coverage to keep the metrics focused on first-party logic, and runtime logging now pipes through a configurable `setLogger` helper so downstream apps can forward structured telemetry.
- What’s left to exercise:
  1. `session-cipher.ts` archival/decryption retry loops (lines 250-350, 390+)
  2. `session-record.ts` legacy migration branches (lines 30-220)
  3. `internal/crypto.ts` HKDF fallback + MAC error paths

Recent additions:
- Added async/sync negative-path coverage for `internal/curve.ts`.
- Expanded `session-cipher-errors.test.ts` to cover ratchet setup failures and empty session queues.

`maxWorkers` is still pinned to 1 because Jest workers continue to crash when run in parallel; revisit after upstream investigation.

## Integration Harness

- Location: `src/__test__/integration/multi-device-indexeddb.test.ts`
- Scenario coverage:
  - Ratchet state sharing across devices using the IndexedDB store
  - Pre-key rotation catch-up on newly synced devices
  - Identity key change detection (ensures `Identity key changed` errors propagate)
  - Session persistence after IndexedDB reopen cycles
- Backend: exercises the first-party IndexedDB adapter from `examples/storage-adapters/indexeddb-adapter.ts`
- Run isolated: `yarn test -- src/__test__/integration/multi-device-indexeddb.test.ts`
- Harness assumes `fake-indexeddb` (via Jest’s Node environment) and mirrors the PWA storage surface; keep this suit green before wiring Playwright/browser automation in Phase 2.

## Browser Automation

- Framework: Playwright (`@playwright/test`)
- Config: `playwright.config.ts` spins up the Vite demo (`examples/pwa-vite`) via `yarn preview:pwa-vite`
- Test entry: `tests/playwright/pwa-vite.spec.ts`
- Install browsers once per environment: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers yarn playwright install chromium`
- Execute suite: `yarn test:e2e`
- Validates that the Service Worker negotiates a session, decrypts worker responses, and posts results back to the main thread.

## API Documentation

- Tooling: [TypeDoc](https://typedoc.org/) (HTML output)
- Config: `typedoc.json`
- Generate locally: `yarn docs:api`
- Output: `docs/api/` (ignored in git; regenerate instead of editing by hand)
- Warnings: TypeDoc expects TS ≤5.7; current build emits benign version warnings until we align dependencies.

## Release Workflow

- Use `yarn release:beta` before publishing. It runs `lint`, `test`, `bundle:size`, and `build` in sequence.
- `prepublishOnly` is wired to the same command, so `npm publish --tag next` will fail fast on size or test regressions.
- Update `CHANGELOG.md` when cutting releases and include relevant changes/versions.
- GitHub Pages deployment is automated: see `.github/workflows/publish-docs.yml` and `docs/api-publishing.md` for details.

## Benchmark Suite

- Command: `yarn benchmark`
- The script rebuilds the library and times key operations (identity key generation, pre-key session setup, encrypt, decrypt).
- Override the number of runs with `BENCH_RUNS=<n> yarn benchmark`.
- Results are printed in milliseconds (average over each run).

## Build Artifacts

- `yarn build` produces:
  - `lib/cjs/**` – CommonJS + `.d.ts` + sourcemaps
  - `lib/esm/**` – ES2020 modules + `.d.ts` + sourcemaps
  - `lib/msrcrypto.js` – legacy fallback injected at runtime
- Package metadata declares `"sideEffects": ["lib/msrcrypto.js"]` so bundlers can tree-shake everything else by default, and subpath exports (`./session-cipher`, `./fingerprint-generator`, `./logger`, etc.) let bundlers import only the modules required for a given bundle.
- Current bundle footprint (2025-10-17):
  - `lib/cjs` ≈ **344 KB** on disk
  - `lib/esm` ≈ **328 KB** on disk
  - Target (Phase 2): <100 KB gzipped after tree-shaking and optional module splits
- Ensure only these directories are packaged (`package.json > files`).
- Smoke test the Node + browser bundles and subpath exports:
  ```bash
  yarn smoke:build      # validates CJS/ESM entry points in Node
  yarn smoke:browser    # bundles against esbuild (browser target)
  ```

### Bundle Hot Spots (2025-10-19)

| Module                             | Raw size | Gzipped | Notes                                |
| ---------------------------------- | -------- | ------- | ------------------------------------ |
| `lib/esm/session-cipher.js`        | 22,174 B | 4,676 B | Core Double Ratchet implementation   |
| `lib/esm/session-builder.js`       | 12,339 B | 2,855 B | X3DH handshake logic                 |
| `lib/esm/session-record.js`        | 14,416 B | 2,937 B | Session persistence helpers          |
| `lib/esm/internal/crypto.js`       | 4,763 B  | 1,474 B | WebCrypto + HKDF wrapper             |
| `lib/esm/protobuf/push_messages.js`| 15,157 B | 3,374 B | Generated codec; candidates for split|

Near-term optimization tasks (Phase 3 preview):

1. Split optional helpers/protobuf codecs behind secondary entry points so bundlers can omit them when not needed.
2. Audit `session-cipher` for inline helpers that can migrate into lazily-evaluated modules.
3. Track gzipped totals after each pass; **Phase 2 target** remains ≤110 KB gzipped, with sub-100 KB deferred to Phase 3.

Bundle smoke test (`yarn build` is executed automatically):

```bash
yarn bundle:size
```

Current `examples/pwa-vite` output (2025-10-19): **104.16 KiB** gzipped across 3 JavaScript chunks. This satisfies the Phase 2 threshold; keep iterating toward <100 KB in Phase 3.

## Continuous Integration

- Workflow: `.github/workflows/ci.yml`
- Matrix: Node.js 18.x and 20.x
- Steps: `corepack enable` → `corepack prepare yarn@4.5.2 --activate` → `yarn install --immutable` → `yarn lint` → `yarn typecheck` → `yarn test --coverage` → `yarn build`
- Corepack: Actions activates Yarn 4.5.2 so the CI environment matches local installs before running any Yarn command
- Artifact: `coverage/lcov.info` uploaded from the Node 20 run for downstream reporting
- Caveat: Jest still runs with `maxWorkers: 1` due to upstream worker crash; keep this config until the Jest issue is resolved.

## Outstanding Work

- Decide on Yarn Berry permanence; confirm lockfile stability.
- Audit runtime dependencies:
  - ✅ Patched transitive CVEs via Yarn `resolutions`.
- ✅ Signal protobuf bundle: `proto/wire.proto` and `proto/push_messages.proto` tracked with regenerated codecs (2025-10-18).
- Publish a beta package after documenting CJS/ESM usage examples in the README.
