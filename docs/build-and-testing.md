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
- Latest run (2025-10-18): **92.1% statements / 80.6% branches / 94.0% functions / 92.0% lines** across 223 specs.
- What’s left to exercise:
  1. `session-cipher.ts` archival/decryption retry loops (lines 250-350, 390+)
  2. `session-record.ts` legacy migration branches (lines 30-220)
  3. `internal/crypto.ts` HKDF fallback + MAC error paths

Recent additions:
- Added async/sync negative-path coverage for `internal/curve.ts`.
- Expanded `session-cipher-errors.test.ts` to cover ratchet setup failures and empty session queues.

`maxWorkers` is still pinned to 1 because Jest workers continue to crash when run in parallel; revisit after upstream investigation.

## Build Artifacts

- `yarn build` produces:
  - `lib/cjs/**` – CommonJS + `.d.ts` + sourcemaps
  - `lib/esm/**` – ES2020 modules + `.d.ts` + sourcemaps
  - `lib/msrcrypto.js` – legacy fallback injected at runtime
- Current bundle footprint (2025-10-17):
  - `lib/cjs` ≈ **344 KB** on disk
  - `lib/esm` ≈ **328 KB** on disk
  - Target (Phase 2): <100 KB gzipped after tree-shaking and optional module splits
- Ensure only these directories are packaged (`package.json > files`).
- Smoke tests (manual for now):
  ```bash
  node -e "const lib = require('./lib/cjs'); console.log(Object.keys(lib))"
  node -e "import('./lib/esm/index.js').then(m => console.log(Object.keys(m)))"
  ```

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
- 🚧 Signal protobuf bundle: `proto/wire.proto` tracked and codecs normalized (2025-10-18); push content regeneration remains pending (`proto/push_messages.proto`).
- Publish a beta package after documenting CJS/ESM usage examples in the README.
