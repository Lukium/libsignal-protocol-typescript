# Dependency Decisions

_Last reviewed: 2025-10-17_

This document captures the current dependency set for `@privacyresearch/libsignal-protocol-typescript`, along with the rationale for keeping each package during Phase 1. All version numbers reflect the values in `package.json` at the time of review. A `yarn npm audit` check reports **no known vulnerabilities**.

## Runtime Dependencies

| Package | Current Version | Decision | Notes |
| ------- | --------------- | -------- | ----- |
| `@privacyresearch/curve25519-typescript` | ^0.0.12 | ✅ Keep | Provides the asm.js Curve25519 bindings required by the legacy Signal implementation. No newer release is published; replacing it would require a full WASM migration, which is out of Phase 1 scope but will be tracked for Phase 2 research. |
| `@privacyresearch/libsignal-protocol-protobuf-ts` | ^0.0.9 | ✅ Keep (monitor) | Supplies the generated protobuf message types. The bundled definitions are slightly behind the latest spec; we plan to regenerate the bundle once upstream protocol updates are finalized. A follow-up issue will capture the regeneration work. |
| `base64-js` | ^1.5.1 | ✅ Keep | Lightweight browser-compatible Base64 utilities. Native `atob`/`btoa` lack typed-array support and fail in Node 18 without polyfills; keeping this dependency avoids cross-runtime discrepancies. |

## Development Dependencies

| Package | Current Version | Decision | Notes |
| ------- | --------------- | -------- | ----- |
| `typescript` | ^5.8.3 | ✅ Keep | Matches the modern TS toolchain used across configs; no breaking changes anticipated. |
| `ts-jest` | ^29.4.5 | ✅ Keep | Required for running TypeScript tests in Jest; aligns with Jest 29. |
| `jest` | ^29.7.0 | ✅ Keep | Latest 29.x release; Jest 30 introduces configuration changes we will evaluate after Phase 1. |
| `@types/jest` | ^29.5.14 | ⚠️ Defer update | 30.x typings require Jest 30; will upgrade alongside the runtime in Phase 2. |
| `@typescript-eslint/eslint-plugin` / `parser` | ^8.46.1 | ✅ Keep | Latest 8.x channel with support for TypeScript 5.8; no linting regressions observed. |
| `eslint` | ^9.38.0 | ✅ Keep | Flat-config ready and compatible with our existing lint rules. |
| `eslint-config-prettier` / `eslint-plugin-prettier` | ^10.1.8 / ^5.2.1 | ⚠️ Defer plugin bump | Config is current; plugin has a 5.5.x release that we will adopt after verifying compatibility with ESLint 9. |
| `prettier` | ^3.6.2 | ✅ Keep | Required for formatting; matches project expectations. |
| `husky` | ^9.1.7 | ✅ Keep | Powers local Git hooks (pre-commit, commit-msg) to enforce linting and commit conventions. |
| `lint-staged` | ^16.2.4 | ✅ Keep | Runs targeted lint/format commands on staged files; keeps pre-commit fast. |
| `@commitlint/cli` / `@commitlint/config-conventional` | ^20.1.0 / ^20.0.0 | ✅ Keep | Enforces Conventional Commits via the `commit-msg` hook. |
| `@types/base64-js` | ^1.3.2 | ⚠️ Defer update | Latest typings (1.5.x) introduce stricter definitions; schedule update with the next TypeScript minor bump. |

## Version Watchlist

Version data captured via `yarn npm info <package> --fields version` on 2025-10-17.

| Package | Current | Latest | Plan |
| ------- | ------- | ------ | ---- |
| `typescript` | ^5.8.3 | 5.9.3 | Schedule upgrade after strict-mode audit (Phase 2). |
| `jest` | ^29.7.0 | 30.2.0 | Major release; migrate alongside @types/jest and ts-jest updates in Phase 2. |
| `@types/jest` | ^29.5.14 | 30.0.0 | Blocked on Jest 30 migration. |
| `eslint-plugin-prettier` | ^5.2.1 | 5.5.4 | Test upgrade after confirming compatibility with ESLint 9 flat config. |
| `@types/base64-js` | ^1.3.2 | 1.5.0 | Update with next TypeScript minor when type tightening is validated. |

## Next Actions

- Track automated update checks (`yarn up --mode update-lockfile`) once lint/test automation is stable.
- File follow-up issues for regenerating the protobuf bundle and evaluating a WASM-backed Curve25519 implementation.
- Re-run `yarn npm audit` as part of the weekly maintenance rotation.
