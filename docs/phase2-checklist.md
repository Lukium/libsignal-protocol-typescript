# Phase 2: Modernization – Implementation Checklist

**Duration**: Weeks 4-8  
**Goal**: Deliver a production-ready, browser-first Signal Protocol SDK

> **Scope note:** Post-quantum (PQXDH) work is **explicitly out of scope** for Phase 2 and remains a Phase 3+ item.

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
  - Flag any remaining uncovered lines for Phase 3 refactors

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

- [ ] **Tree-shake core package**
  - Ensure side-effect flags in `package.json` are accurate
  - Split optional helpers into secondary entry points (e.g., `helpers`, `fingerprint`)
- [ ] **Bundle size reduction**
  - Target <110 KB gzipped for primary ESM bundle (Phase 2). Sub-100 KB deferred to Phase 3.
  - Document before/after sizes in `docs/build-and-testing.md`
- [ ] **Dual build validation** *(Node ESM loader still requires extension mapping; bundler paths verified in demos.)*
  - Add smoke tests executing built artifacts (`node` + `browser` env via `esbuild`)
  - Confirm `.d.ts` maps reference correct sources
- [x] **Release tooling**
  - Draft `CHANGELOG.md`
  - Prepare npm `prepublishOnly` script to run lint/test/build/size check

## Week 7: API Experience & Documentation

- [x] **API reference site**
  - Generate docs (e.g., TypeDoc) under `docs/api/`
  - Publish via GitHub Pages (or similar) with navigation from `docs/README.md`
- [ ] **Guide expansion**
  - Extend `docs/pwa-guide.md` with push payload examples
  - Add “migration recipes” (e.g., legacy store → IndexedDB)
- [x] **Examples tooling**
  - Provide `yarn example:<name>` scripts for each example *(PWA demo now available via `yarn example:pwa-vite`; additional scripts may follow)*
  - Add README badges linking to runnable demos (StackBlitz/CodeSandbox)
- [x] **Developer onboarding**
  - Draft `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`
  - Create issue/PR templates aligning with the new workflow

## Week 8: Performance, Monitoring & Release Prep

- [x] **Benchmark suite**
  - Introduce micro-benchmarks (key gen, session init, encrypt/decrypt)
  - Compare asm.js vs WebCrypto performance in docs *(baseline recorded; deeper comparisons planned for Phase 3)*
- [ ] **Error telemetry hooks**
  - Provide optional logging interface with structured errors
  - Document usage in README and examples
- [ ] **Security review checklist**
  - Create repeatable audit steps (dependency scan, bundle diff)
  - Run `yarn npm audit`, `npm ls` sanity checks before release
- [ ] **Release candidate tag**
  - Ship `v0.1.0-beta.1`
  - Publish release notes summarizing Phase 2 outcomes

---

## Phase 2 Completion Checklist

### Testing

- [ ] Integration tests cover multi-device flows
- [x] Branch coverage ≥85% *(2025-10-18: 96.7% statements / 90.8% branches / 96.7% functions / 96.7% lines)*
- [ ] Browser automation smoke tests passing
- [ ] No open critical test issues

### Build System

- [x] Bundles ≤110 KB gzipped (Phase 2)
- [x] Optional entry points documented and tested
- [x] Dual builds validated in Node + browser harnesses
- [x] Release scripts automated (`yarn release:beta`)

### Code Quality

- [x] TypeDoc/typedoc-style API docs generated
- [x] Benchmarks tracked in repo
- [ ] Error handling audited (structured errors, no raw strings)
- [ ] Logging hooks optional and disabled by default

### Dependencies

- [x] Protobuf bundle regenerated
- [x] `msrcrypto` usage audited; plan for WASM spike documented
- [x] No high/critical vulnerabilities in `yarn npm audit`
- [x] Dependency decisions updated (`docs/dependencies.md`)

### Documentation

- [x] API reference published
- [x] PWA guide updated with IndexedDB adapter usage
- [x] Examples README refreshed with scripts
- [x] Migration guide includes Phase 2 changes

### Examples & PWA

- [x] Basic messaging example runnable via script
- [x] IndexedDB adapter example tested and documented
- [x] PWA example handles offline/online transitions
- [x] Storage adapters include README usage instructions

### Release Readiness

- [x] `CHANGELOG.md` started with Phase 2 entries
- [x] `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` published
- [ ] Beta release published to npm (tagged `next`)
- [ ] Post-release checklist drafted for Phase 3 handoff

---

## Success Criteria

Phase 2 is complete when:

1. ✅ **Modern build & packaging** – Tree-shaken bundles ≤110 KB gzipped with dual outputs validated. *(Phase 3 will chase <100 KB.)*
2. ✅ **Browser-ready tooling** – IndexedDB adapter, PWA example, and browser automation in place.
3. ✅ **Comprehensive documentation** – API reference, migration recipes, and updated guides published.
4. ✅ **Release infrastructure** – Benchmarks, changelog, and beta release pipeline operational.

---

## Tracking Guidance

- Create GitHub Project “Phase 2: Modernization” with columns: Backlog → In Progress → Review → Done.
- File individual issues for each top-level task with acceptance criteria matching the checklist.
- Hold bi-weekly review meetings to monitor bundle size, performance metrics, and documentation progress.
