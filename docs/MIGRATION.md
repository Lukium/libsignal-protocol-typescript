# Migration Guide (v0.0.16 → Phase 1)

_Last updated: 2025-10-17_

This guide helps consumers of `@privacyresearch/libsignal-protocol-typescript@0.0.16` migrate to the modernized Phase 1 release.

## 1. Installation & Build Targets

- **Dual module builds**: The package now ships both ESM and CJS bundles (`lib/esm`, `lib/cjs`). Node consumers should prefer the default `require` entry; ESM-aware bundlers can target the `"module"` export.
- **Type declarations**: `.d.ts` files are emitted alongside both builds. Ensure your bundler picks up the `types` export from `package.json`.
- **Node version**: CI validates Node 18 and 20. Earlier Node versions are not officially tested.

## 2. Tooling Changes

- **TypeScript**: Upgraded to 5.9.x with `strict` mode enabled across the library. No consumer-facing type changes were introduced, but stricter typing may surface gaps in your own ambient declarations.
- **ESLint & Prettier**: Flat-config ESLint 9 with Prettier integration. If you extend the project’s config, switch to the new `eslint.config.js` format.
- **Jest**: Remains on 29.x with a custom environment (`src/__test-utils__/custom-jest-environment.js`). Consumers running the test suite should keep `maxWorkers=1` until upstream stability issues are resolved.

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

## 6. Future Work (Phase 2+)

- PQXDH support, browser storage adapters, and regenerated protobuf definitions are planned. Track `docs/limitations.md` for progress and adjust your roadmap accordingly.

## 7. Public API Snapshot

| Export | Status | Notes |
| ------ | ------ | ----- |
| `SignalProtocolAddress` | ✅ Unchanged | Added factory `fromString` and richer JSDoc. |
| `KeyHelper` | ✅ Unchanged | Methods documented; return types unchanged. |
| `SessionBuilder` / `SessionCipher` | ✅ Unchanged | Awaitable store interactions now enforced. |
| `SessionLock` | ✅ Unchanged | Internal helper, no public API shift. |
| `SignalProtocolStore` contract (`StorageType`) | ✅ Unchanged | Added documentation to clarify promise-based methods. |
