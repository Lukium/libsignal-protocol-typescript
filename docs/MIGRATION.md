# Migration Guide (v0.0.16 → Phase 2 beta)

_Last updated: 2025-10-19_

This guide helps consumers of the legacy `@privacyresearch/libsignal-protocol-typescript@0.0.16` release migrate to the current `@lukium/libsignal-protocol-typescript` package and adopt the modernization work delivered across Phase 1 and Phase 2.

## 1. Installation & Build Targets

- **Dual module builds**: The package now ships both ESM and CJS bundles (`lib/esm`, `lib/cjs`). Node consumers should prefer the default `require` entry; ESM-aware bundlers can target the `"module"` export.
- **Type declarations**: `.d.ts` files are emitted alongside both builds. Ensure your bundler picks up the `types` export from `package.json`.
- **Node version**: CI validates Node 18 and 20. Earlier Node versions are not officially tested.

## 2. Tooling Changes

- **TypeScript**: Upgraded to 5.9.x with `strict` mode enabled across the library. No consumer-facing type changes were introduced, but stricter typing may surface gaps in your own ambient declarations.
- **ESLint & Prettier**: Flat-config ESLint 9 with Prettier integration. If you extend the project’s config, switch to the new `eslint.config.js` format.
- **Jest**: Remains on 29.x with a custom environment (`src/__test-utils__/custom-jest-environment.js`). Consumers running the test suite should keep `maxWorkers=1` until upstream stability issues are resolved.
- **Build validation**: `yarn smoke:build` now verifies the dual CJS/ESM outputs and subpath exports after `yarn build`.

## 3. API Surface

No public APIs were intentionally removed in Phase 1. Notable clarifications:

- `SessionCipher.saveIdentity` now awaits the underlying store call. Implementations of `SignalProtocolStore` **must** return a `Promise<boolean>` as documented in `src/types.ts`.
- Internal helpers continue to return `ArrayBuffer` without `SharedArrayBuffer` special-casing; ensure your environment supports standard WebCrypto buffers.

## 4. Breaking Configuration Updates

- **Prettier defaults**: The project retains semicolons and 4-space indentation. If you previously relied on `semi: false`, re-sync your formatter settings.
- **Git hooks**: Husky + lint-staged run lint/format automatically. Run `corepack yarn install` to ensure hooks are installed locally.

## 5. Recommended Consumer Actions

1. **Review store implementations** – confirm all async methods return promises and handle `await` correctly.
2. **Audit bundler configs** – update path aliases if you referenced `lib/` directly; rely on the package exports instead.
3. **Re-run tests** – execute your integration tests against the upgraded build to validate serialization, storage, and crypto pathways.

## 6. Phase 2 Enhancements

- **Browser-first tooling**
  - First-party IndexedDB adapter (`examples/storage-adapters/indexeddb-adapter.ts`) with accompanying tests.
  - Vite PWA demo (`examples/pwa-vite`) showcasing Service Worker messaging, offline queueing, and Playwright automation (`yarn test:e2e`).
  - Offline-aware main thread logic automatically queues outbound messages until connectivity and sessions return.
- **Examples & CLI**
  - `yarn example:basic` runs the end-to-end demo against the built artifacts, doubling as a packaging smoke test.
- **Packaging**
  - Optional entry points documented in `docs/build-and-testing.md`; `yarn smoke:build` asserts the exports map is in sync with the build outputs.
  - Bundle size target of ≤110 KB gzipped confirmed for Phase 2.
- **Documentation**
  - PWA guide expanded with offline queue references.
  - Dependency decisions updated with an msrcrypto audit and WASM migration plan for Phase 3.
- **Telemetry**
  - Optional logging hooks via `setLogger`/`getLogger` to funnel structured warnings and errors into custom observability pipelines.

## 7. Future Work (Phase 3+)

- PQXDH support and WASM Curve25519 evaluation.
- Bundle trimming below 100 KB gzipped and broader browser coverage.
- Migration recipes for custom storage backends and advanced examples (React/Vue).

## 8. Public API Snapshot

| Export | Status | Notes |
| ------ | ------ | ----- |
| `SignalProtocolAddress` | ✅ Unchanged | Added factory `fromString` and richer JSDoc. |
| `KeyHelper` | ✅ Unchanged | Methods documented; return types unchanged. |
| `SessionBuilder` / `SessionCipher` | ✅ Unchanged | Awaitable store interactions now enforced. |
| `SessionLock` | ✅ Unchanged | Internal helper, no public API shift. |
| `SignalProtocolStore` contract (`StorageType`) | ✅ Unchanged | Added documentation to clarify promise-based methods. |
