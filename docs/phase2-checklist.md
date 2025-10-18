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
- [ ] **Introduce integration harness**
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
- [ ] **Service Worker compatibility**
  - Provide ESM worker build instructions (Vite/Webpack/SWC)
  - Verify bundling without `msrcrypto` fallback
- [ ] **Browser automation**
  - Set up Playwright smoke test (Chrome + Firefox) for encryption round trip
  - Integrate into CI (nightly job acceptable)

## Week 6: Build Optimization & Packaging

- [ ] **Tree-shake core package**
  - Ensure side-effect flags in `package.json` are accurate
  - Split optional helpers into secondary entry points (e.g., `helpers`, `fingerprint`)
- [ ] **Bundle size reduction**
  - Target <100 KB gzipped for primary ESM bundle
  - Document before/after sizes in `docs/build-and-testing.md`
- [ ] **Dual build validation**
  - Add smoke tests executing built artifacts (`node` + `browser` env via `esbuild`)
  - Confirm `.d.ts` maps reference correct sources
- [ ] **Release tooling**
  - Draft `CHANGELOG.md`
  - Prepare npm `prepublishOnly` script to run lint/test/build/size check

## Week 7: API Experience & Documentation

- [ ] **API reference site**
  - Generate docs (e.g., TypeDoc) under `docs/api/`
  - Publish via GitHub Pages (or similar) with navigation from `docs/README.md`
- [ ] **Guide expansion**
  - Extend `docs/pwa-guide.md` with push payload examples
  - Add “migration recipes” (e.g., legacy store → IndexedDB)
- [ ] **Examples tooling**
  - Provide `yarn example:<name>` scripts for each example
  - Add README badges linking to runnable demos (StackBlitz/CodeSandbox)
- [ ] **Developer onboarding**
  - Draft `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`
  - Create issue/PR templates aligning with the new workflow

## Week 8: Performance, Monitoring & Release Prep

- [ ] **Benchmark suite**
  - Introduce micro-benchmarks (key gen, session init, encrypt/decrypt)
  - Compare asm.js vs WebCrypto performance in docs
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
- [ ] Branch coverage ≥85%
- [ ] Browser automation smoke tests passing
- [ ] No open critical test issues

### Build System

- [ ] Bundles <100 KB gzipped
- [ ] Optional entry points documented and tested
- [ ] Dual builds validated in Node + browser harnesses
- [ ] Release scripts automated (`yarn release:beta`)

### Code Quality

- [ ] TypeDoc/typedoc-style API docs generated
- [ ] Benchmarks tracked in repo
- [ ] Error handling audited (structured errors, no raw strings)
- [ ] Logging hooks optional and disabled by default

### Dependencies

- [ ] Protobuf bundle regenerated
- [ ] `msrcrypto` usage audited; plan for WASM spike documented
- [ ] No high/critical vulnerabilities in `yarn npm audit`
- [ ] Dependency decisions updated (`docs/dependencies.md`)

### Documentation

- [ ] API reference published
- [ ] PWA guide updated with IndexedDB adapter usage
- [ ] Examples README refreshed with scripts
- [ ] Migration guide includes Phase 2 changes

### Examples & PWA

- [ ] Basic messaging example runnable via script
- [ ] IndexedDB adapter example tested and documented
- [ ] PWA example handles offline/online transitions
- [ ] Storage adapters include README usage instructions

### Release Readiness

- [ ] `CHANGELOG.md` started with Phase 2 entries
- [ ] `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` published
- [ ] Beta release published to npm (tagged `next`)
- [ ] Post-release checklist drafted for Phase 3 handoff

---

## Success Criteria

Phase 2 is complete when:

1. ✅ **Modern build & packaging** – Tree-shaken bundles <100 KB gzipped with dual outputs validated.
2. ✅ **Browser-ready tooling** – IndexedDB adapter, PWA example, and browser automation in place.
3. ✅ **Comprehensive documentation** – API reference, migration recipes, and updated guides published.
4. ✅ **Release infrastructure** – Benchmarks, changelog, and beta release pipeline operational.

---

## Tracking Guidance

- Create GitHub Project “Phase 2: Modernization” with columns: Backlog → In Progress → Review → Done.
- File individual issues for each top-level task with acceptance criteria matching the checklist.
- Hold bi-weekly review meetings to monitor bundle size, performance metrics, and documentation progress.
