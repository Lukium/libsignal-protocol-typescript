# Dependency Decisions

_Last reviewed: 2025-10-19_

This document captures the current dependency set for `@privacyresearch/libsignal-protocol-typescript`, along with the rationale for keeping each package during Phase 2. All version numbers reflect the values in `package.json` at the time of review. A `yarn npm audit` check reports **no known vulnerabilities**.

## Runtime Dependencies

| Package | Current Version | Decision | Notes |
| ------- | --------------- | -------- | ----- |
| `@privacyresearch/curve25519-typescript` | ^0.0.12 | ✅ Keep | Provides the asm.js Curve25519 bindings required by the legacy Signal implementation. A Phase 2 audit confirmed the fallback only loads when WebCrypto is unavailable; a WASM migration remains a Phase 3 spike. |
| `base64-js` | ^1.5.1 | ✅ Keep | Lightweight browser-compatible Base64 utilities. Native `atob`/`btoa` lack typed-array support and fail in Node 18 without polyfills; keeping this dependency avoids cross-runtime discrepancies. |
| `protobufjs` | ^7.5.x | ✅ Keep | Powers the regenerated Signal Protocol protobuf codecs (Signal + push content) compiled from upstream schemas. Normalization helper added to coerce `Long` outputs to native numbers. |

### Runtime Update Check (2025-10-17)

Latest versions captured with `yarn npm info <package> --fields version`.

| Package | Latest Version | Status |
| ------- | -------------- | ------ |
| `@privacyresearch/curve25519-typescript` | 0.0.12 | Up-to-date |
| `base64-js` | 1.5.1 | Up-to-date |
| `protobufjs` | 7.5.4 | Up-to-date |

## Development Dependencies

| Package | Current Version | Decision | Notes |
| ------- | --------------- | -------- | ----- |
| `typescript` | 5.9.3 | ✅ Updated | Bumped from 5.8.x to 5.9.3; strict config unchanged and compiler passes all builds/tests. |
| `ts-jest` | ^29.4.5 | ✅ Keep | Required for running TypeScript tests in Jest; aligns with Jest 29. |
| `jest` | ^29.7.0 | ✅ Keep | Latest 29.x release; Jest 30 introduces configuration changes we will evaluate after Phase 1. |
| `@types/jest` | ^29.5.14 | ⚠️ Defer update | 30.x typings require Jest 30; will upgrade alongside the runtime in Phase 2. |
| `@typescript-eslint/eslint-plugin` / `parser` | ^8.46.1 | ✅ Keep | Latest 8.x channel with support for TypeScript 5.8; no linting regressions observed. |
| `eslint` | ^9.38.0 | ✅ Keep | Flat-config ready and compatible with our existing lint rules. |
| `eslint-config-prettier` / `eslint-plugin-prettier` | ^10.1.8 / 5.5.4 | ✅ Updated plugin | Adopted 5.5.4 to match ESLint 9; no compatibility issues observed. |
| `prettier` | ^3.6.2 | ✅ Keep | Latest available release on npm; no 3.7.x tag published despite changelog reference. |
| `husky` | ^9.1.7 | ✅ Keep | Powers local Git hooks (pre-commit, commit-msg) to enforce linting and commit conventions. |
| `lint-staged` | ^16.2.4 | ✅ Keep | Runs targeted lint/format commands on staged files; keeps pre-commit fast. |
| `@commitlint/cli` / `@commitlint/config-conventional` | ^20.1.0 / ^20.0.0 | ✅ Keep | Enforces Conventional Commits via the `commit-msg` hook. |
| `@types/base64-js` | ^1.3.2 | ⚠️ Defer update | Latest typings (1.5.x) introduce stricter definitions; schedule update with the next TypeScript minor bump. |

## Version Watchlist

Version data captured via `yarn npm info <package> --fields version` on 2025-10-17.

| Package | Current | Latest | Plan |
| ------- | ------- | ------ | ---- |
| `typescript` | 5.9.3 | 5.9.3 | Up-to-date (monitor for 5.10.x preview releases). |
| `jest` | ^29.7.0 | 30.2.0 | Major release; migrate alongside @types/jest and ts-jest updates in Phase 2. |
| `@types/jest` | ^29.5.14 | 30.0.0 | Blocked on Jest 30 migration. |
| `eslint-plugin-prettier` | 5.5.4 | 5.5.4 | Up-to-date; re-check on next minor. |
| `@types/base64-js` | ^1.3.2 | 1.5.0 | Update with next TypeScript minor when type tightening is validated. |
| `protobufjs` | 7.5.4 | 7.5.4 | Up-to-date; regenerate codecs from `proto/*.proto` when upstream schemas change. |

## msrcrypto / Curve25519 Audit (2025-10-19)

- Verified that `lib/msrcrypto.js` is the only file listed under `"sideEffects"` and is tree-shaken from modern builds.
- Confirmed `examples/pwa-vite` and Service Worker bundles never import the fallback when `globalThis.crypto` exists.
- Documented remediation path: retain asm.js fallback for legacy browsers in Phase 2, evaluate WASM bindings (e.g., `libsodium.js` or bespoke WASM) in Phase 3 once bundle-size targets are locked.

## Next Actions

- Track automated update checks (`yarn up --mode update-lockfile`) once lint/test automation is stable.
- Track upstream Signal proto changes and rerun `pbjs` generation (sources now tracked under `proto/`) as part of release prep.
- Re-run `yarn npm audit` as part of the weekly maintenance rotation (captured in the release checklist).
