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
- Latest run: **92.0% statements / 80.7% branches / 94.0% functions / 91.9% lines** across 210 specs.
- Remaining hot spots:
  1. `session-cipher.ts` deep ratchet/error branches (lines 190-480)
  2. `session-record.ts` legacy migration + archival branches (lines 30-270)
  3. `internal/crypto.ts` fallback paths inside HKDF + MAC helpers

`maxWorkers` is still pinned to 1 because Jest workers continue to crash when run in parallel; revisit after upstream investigation.

## Build Artifacts
- `yarn build` produces:
  - `lib/cjs/**` – CommonJS + `.d.ts` + sourcemaps
  - `lib/esm/**` – ES2020 modules + `.d.ts` + sourcemaps
  - `lib/msrcrypto.js` – legacy fallback injected at runtime
- Ensure only these directories are packaged (`package.json > files`).  
- Smoke tests (manual for now):
  ```bash
  node -e "const lib = require('./lib/cjs'); console.log(Object.keys(lib))"
  node -e "import('./lib/esm/index.js').then(m => console.log(Object.keys(m)))"
  ```

## Continuous Integration
- Workflow: `.github/workflows/ci.yml`
- Matrix: Node.js 18.x and 20.x
- Steps: `yarn install --immutable` → `yarn lint` → `yarn typecheck` → `yarn test --coverage` → `yarn build`
- Corepack: workflow runs `corepack enable` followed by `corepack prepare yarn@4.5.3 --activate` to match the repo's `packageManager`
- Artifact: `coverage/lcov.info` uploaded from the Node 20 run for downstream reporting
- Caveat: Jest still runs with `maxWorkers: 1` due to upstream worker crash; keep this config until the Jest issue is resolved.

## Outstanding Work
- Decide on Yarn Berry permanence; confirm lockfile stability.
- Wire GitHub Actions once branch coverage ≥80%.
- Publish a beta package after documenting CJS/ESM usage examples in the README.
