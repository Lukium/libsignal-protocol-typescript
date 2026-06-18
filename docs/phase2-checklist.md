# Phase 2: Modernization – Implementation Checklist

**Duration**: Weeks 4-8
**Goal**: Deliver a production-ready, browser-first Signal Protocol SDK
**Status**: ✅ Complete (2025-10-19)

> **Scope note:** Post-quantum (PQXDH) work is **explicitly out of scope** for Phase 2 and remains a Phase 3+ item.

---

## Week 4: Protocol Fidelity & Test Coverage

- [x] **Regenerate protobuf bundle**
  - Files: `proto/wire.proto`, `proto/push_messages.proto`
  - Use latest upstream schemas (`protobufjs` JSON descriptors + wrappers)
  - Update TypeScript typings and ensure compatibility with existing code
  - _Status 2025-10-18_: `wire.proto` and `push_messages.proto` regenerated with in-repo codecs.
- [x] **Upgrade test vectors**
  - Add fresh fixtures for session-cipher error branches and archival flows
  - Expand coverage for `session-record.ts` edge cases (target >90% branches)
- [x] **Introduce integration harness**
  - Create `src/__test__/integration/` with multi-device flows
  - Automate scenario for pre-key rotation + identity change detection
- [x] **Document coverage deltas**
  - Update `docs/build-and-testing.md` with new hot spots
  - Flag any remaining uncovered lines for Phase 3 refactors

## Week 5: Browser & PWA Enhancements

- [x] **IndexedDB storage adapter**
  - File: `examples/storage-adapters/indexeddb-adapter.ts`
  - Implement full `SignalProtocolStore` against IndexedDB
  - Write Jest tests using `fake-indexeddb`
- [x] **PWA example application**
  - Populate `examples/pwa-integration` with runnable assets
  - Demonstrate push handling, offline queueing, and background sync
- [x] **Service Worker compatibility**
  - Provide ESM worker build instructions (Vite/Webpack/SWC)
  - Verify bundling without `msrcrypto` fallback
- [x] **Browser automation**
  - Set up Playwright smoke test (Chrome + Firefox) for encryption round trip *(Chromium via Playwright in place; Firefox slated for later)*
  - Integrate into CI (nightly job acceptable)

## Week 6: Build Optimization & Packaging

- [x] **Tree-shake core package**
  - Ensure side-effect flags in `package.json` are accurate *(only `lib/msrcrypto.js` marked as a side effect; added `./logger` subpath export to keep optional hooks separate)*
  - Split optional helpers into secondary entry points (e.g., `helpers`, `fingerprint`)
- [x] **Bundle size reduction**
  - Target <110 KB gzipped for primary ESM bundle (Phase 2). Sub-100 KB deferred to Phase 3.
  - Document before/after sizes in `docs/build-and-testing.md` *(current Vite demo: 104.48 KB gzipped)*
- [x] **Dual build validation** *(Node ESM loader still requires extension mapping; bundler paths verified in demos.)*
  - Add smoke tests executing built artifacts (`node` + `browser` env via `esbuild`) *(see `yarn smoke:build` + `yarn smoke:browser`)*
  - Confirm `.d.ts` maps reference correct sources *(type declarations resolve to `src/**` when inspected via `lib/**/*.d.ts.map`)*
- [x] **Release tooling**
  - Draft `CHANGELOG.md`
  - Prepare npm `prepublishOnly` script to run lint/test/build/size check

## Week 7: API Experience & Documentation

- [x] **API reference site**
  - Generate docs (e.g., TypeDoc) under `docs/api/`
  - Publish via GitHub Pages (or similar) with navigation from `docs/README.md`
- [x] **Guide expansion**
  - Extend `docs/pwa-guide.md` with push payload examples
  - Add "migration recipes" (e.g., legacy store → IndexedDB)
- [x] **Examples tooling**
  - Provide `yarn example:<name>` scripts for each example *(PWA demo now available via `yarn example:pwa-vite`; additional scripts may follow)*
  - Add README badges linking to runnable demos (StackBlitz/CodeSandbox)
- [x] **Developer onboarding**
  - Draft `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`
  - Create issue/PR templates aligning with the new workflow

## Week 8: Performance, Monitoring & Release Prep

- [x] **Benchmark suite**
  - Introduce micro-benchmarks (key gen, session init, encrypt/decrypt)
  - Compare asm.js vs WebCrypto performance in docs *(baseline recorded; deeper comparisons planned for Phase 3)*
- [x] **Error telemetry hooks**
  - Provide optional logging interface with structured errors *(see `setLogger` in package exports)*
  - Document usage in README and examples
- [x] **Security review checklist**
  - Create repeatable audit steps (dependency scan, bundle diff) *(see [security-review.md](./security-review.md))*
  - Run `yarn npm audit` sanity checks before release *(last run 2025-10-19: no issues reported)*
- [x] **Release candidate tag**
  - Ship `v0.1.0-beta.1` ✅ *Published to npm 2025-10-19*
  - Ship `v0.1.0-beta.2` ✅ *Published to npm 2025-10-19*
  - Publish release notes ✅ *See CHANGELOG.md*

---

## Phase 2 Completion Checklist

### Testing

- [x] Integration tests cover multi-device flows *(`yarn test -- src/__test__/integration/multi-device-indexeddb.test.ts`)*
- [x] Branch coverage ≥85% *(2025-10-18: 97.3% statements / 91.2% branches / 95.0% functions / 97.3% lines)*
- [x] Browser automation smoke tests passing *(`yarn test:e2e`)*
- [x] No open critical test issues

### Build System

- [x] Bundles ≤110 KB gzipped (Phase 2)
- [x] Optional entry points documented and tested
- [x] Dual builds validated in Node + browser harnesses
- [x] Release scripts automated (`yarn release:beta`)

### Code Quality

- [x] TypeDoc/typedoc-style API docs generated
- [x] Benchmarks tracked in repo
- [x] Error handling audited (structured errors, no raw strings)
- [x] Logging hooks optional and disabled by default *(via `setLogger` API; defaults are no-op/info-only)*

### Dependencies

- [x] Protobuf bundle regenerated
- [x] `msrcrypto` usage audited; plan for WASM spike documented
- [x] No high/critical vulnerabilities in `yarn npm audit`
- [x] Dependency decisions updated (`docs/dependencies.md`)

### Documentation

- [x] API reference published
- [x] PWA guide updated with IndexedDB adapter usage
- [x] Examples README refreshed with scripts
- [x] Migration guide includes Phase 2 changes

### Examples & PWA

- [x] Basic messaging example runnable via script
- [x] IndexedDB adapter example tested and documented
- [x] PWA example handles offline/online transitions
- [x] Storage adapters include README usage instructions

### Release Readiness

- [x] `CHANGELOG.md` started with Phase 2 entries
- [x] `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` published
- [x] Beta release published to npm ✅ *`@lukium/libsignal-protocol-typescript` v0.1.0-beta.1 and v0.1.0-beta.2*
- [x] Post-release checklist drafted for Phase 3 handoff ✅ *See [phase3-handoff.md](./phase3-handoff.md)*

---

## Success Criteria

Phase 2 is complete when:

1. ✅ **Modern build & packaging** – Tree-shaken bundles ≤110 KB gzipped with dual outputs validated. *(Phase 3 will chase <100 KB.)*
2. ✅ **Browser-ready tooling** – IndexedDB adapter, PWA example, and browser automation in place.
3. ✅ **Comprehensive documentation** – API reference, migration recipes, and updated guides published.
4. ✅ **Release infrastructure** – Benchmarks, changelog, and beta release pipeline operational.

---

## Tracking Guidance

- Create GitHub Project "Phase 2: Modernization" with columns: Backlog → In Progress → Review → Done.
- File individual issues for each top-level task with acceptance criteria matching the checklist.
- Hold bi-weekly review meetings to monitor bundle size, performance metrics, and documentation progress.

## Addendum (0.2.0, 2026-06-17)

> **Historical note — Phase 2 record left intact.** The msrcrypto audit, the "verify bundling without `msrcrypto` fallback" task, and the "asm.js vs WebCrypto" benchmark items above reflect Phase 2. In v0.2.0 the asm.js `@privacyresearch/curve25519-typescript` dependency and the bundled `lib/msrcrypto.js` polyfill were **removed** in favor of native WebCrypto (`X25519` + `Ed25519` via `SubtleCrypto`); native WebCrypto (modern browsers or Node >= 20) is now required, with no asm.js fallback.
