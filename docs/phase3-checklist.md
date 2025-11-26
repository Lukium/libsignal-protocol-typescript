# Phase 3: Enhancement – Implementation Checklist

**Duration**: Weeks 9-12
**Goal**: Production-ready v1.0.0 release
**Status**: In Progress

> **Scope note:** Post-quantum (PQXDH), group messaging, and sealed sender remain out of scope for v1.0.0 and are deferred to future releases.

---

## Week 9: Bundle Size Optimization

### Bundle Profiling

- [x] **Profile bundle composition** ✅ Completed 2025-11-26
  - Run `source-map-explorer` on `lib/esm/index.js` to visualize module sizes
  - Install: `yarn add -D source-map-explorer`
  - Run: `yarn build && npx source-map-explorer lib/esm/index.js`
  - Document findings in this checklist
  - **Findings**: Bundle is 104 KB gzipped. Major components:
    - Curve25519 asm.js (~40-50 KB gzipped)
    - protobufjs/light (~16 KB gzipped)
    - Library code (~30 KB gzipped)
    - IndexedDB adapter (~8 KB gzipped)

- [x] **Identify optimization targets** ✅ Completed 2025-11-26
  - Current: 104 KB gzipped (via `yarn bundle:size`)
  - Target: <100 KB gzipped
  - Priority modules (from `docs/build-and-testing.md`):
    | Module | Gzipped | Action |
    |--------|---------|--------|
    | `session-cipher.js` | 4.7 KB | Audit inline helpers |
    | `protobuf/push_messages.js` | 3.4 KB | Lazy-load candidate |
    | `session-record.js` | 2.9 KB | Review legacy code |
    | `session-builder.js` | 2.9 KB | Review for tree-shaking |
  - **Finding**: Biggest savings would come from WASM curve25519 or protobufjs/minimal

### Protobuf Optimization

- [ ] **Evaluate protobuf alternatives**
  - Research lighter alternatives to `protobufjs` (e.g., `protobuf-ts`, `pbf`)
  - Document size comparison and migration effort
  - Decision: Keep current / Migrate / Defer

- [ ] **Split optional protobuf codecs**
  - Move `push_messages.proto` codecs to secondary entry point
  - Update `package.json` exports for lazy loading
  - Test that core functionality works without push message codecs

### Code Splitting

- [ ] **Audit session-cipher.ts for split opportunities**
  - Identify helpers that can be lazily loaded
  - Extract archival/retry logic to separate module
  - Measure size reduction

- [ ] **Create optional entry points**
  - `@lukium/libsignal-protocol-typescript/core` – minimal bundle
  - `@lukium/libsignal-protocol-typescript/push` – push message support
  - Document usage in README

### Bundle Verification

- [ ] **Measure final bundle size**
  - Run `yarn bundle:size` after each optimization
  - Update `docs/build-and-testing.md` with new measurements
  - Gate: Bundle must be <100 KB gzipped before proceeding

---

## Week 10: Extended Browser Testing

### Playwright Configuration

- [x] **Add Firefox to Playwright** ✅ Completed 2025-11-26
  - Update `playwright.config.ts`:
    ```typescript
    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    ]
    ```
  - Install Firefox: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers yarn playwright install firefox`
  - Run tests: `yarn test:e2e --project=firefox`
  - **Firefox-specific issues**:
    - Firefox does NOT support ES module Service Workers (`type: 'module'`)
    - Created separate `core-library.spec.ts` for browser-agnostic tests
    - PWA Service Worker tests skipped on Firefox

- [x] **Add WebKit/Safari to Playwright** ✅ Completed 2025-11-26
  - Update `playwright.config.ts`:
    ```typescript
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ```
  - Install WebKit: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers yarn playwright install webkit`
  - Run tests: `yarn test:e2e --project=webkit`
  - **WebKit-specific issues**:
    - Requires system dependencies (GTK4, GStreamer) - run `sudo npx playwright install-deps webkit`
    - Best suited for CI environment with pre-installed deps

- [x] **Test Edge compatibility** ✅ Completed 2025-11-26
  - Edge uses Chromium, so compatible (verified via Chromium tests)
  - Document in browser compatibility matrix

### IndexedDB Cross-Browser Testing

- [ ] **Create IndexedDB browser test suite**
  - Add Playwright tests for IndexedDB adapter operations
  - Test scenarios:
    - Store and retrieve identity keys
    - Store and retrieve sessions
    - Pre-key rotation persistence
    - Multi-device sync simulation
  - Run across all browser projects

- [x] **Document browser quirks** ✅ Completed 2025-11-26
  - Create/update `docs/browser-compatibility.md` with findings
  - Include workarounds for any browser-specific issues
  - Add polyfill recommendations if needed
  - **Documented**: Firefox ES module SW limitation, Safari IndexedDB quota, WebKit deps

### Mobile Browser Considerations

- [ ] **Evaluate mobile testing options**
  - Research BrowserStack/Sauce Labs integration
  - Document cost/benefit of mobile CI testing
  - Decision: Add to CI / Manual testing only / Defer

- [ ] **Manual mobile testing checklist**
  - [ ] Chrome Android – basic encrypt/decrypt flow
  - [ ] Safari iOS – basic encrypt/decrypt flow
  - [ ] Firefox Android – basic encrypt/decrypt flow
  - Document results in `docs/browser-compatibility.md`

### Browser Compatibility Matrix Update

- [x] **Update docs/browser-compatibility.md** ✅ Completed 2025-11-26
  - Mark all tested browsers with ✅
  - Document minimum versions
  - List any known issues or workarounds
  - Include WebCrypto API requirements
  - **Updated with**: Test coverage table, browser matrix, Firefox/Safari limitations

---

## Week 11: Performance & Security Hardening

### Performance Profiling

- [ ] **Profile hot paths**
  - Use Chrome DevTools Performance tab on PWA demo
  - Profile `session-cipher.ts` encrypt/decrypt paths
  - Profile `session-builder.ts` session establishment
  - Document findings and bottlenecks

- [ ] **WebCrypto vs asm.js comparison**
  - Extend `yarn benchmark` to compare implementations
  - Document performance characteristics per browser
  - Add to `docs/build-and-testing.md`

- [ ] **Memory profiling**
  - Test long-running sessions (100+ messages)
  - Check for memory leaks in session management
  - Profile IndexedDB storage growth
  - Document memory characteristics

- [ ] **Optimize identified bottlenecks**
  - Address any significant performance issues found
  - Re-run benchmarks to verify improvements
  - Update baseline in documentation

### Security Hardening

- [ ] **Complete security review checklist**
  - Run through `docs/security-review.md` items
  - Document any findings
  - Fix any identified issues

- [ ] **Dependency security audit**
  - Run `yarn npm audit` – must return clean
  - Review any new advisories since beta releases
  - Update dependencies if security patches available

- [ ] **Timing attack review**
  - Verify constant-time comparisons in crypto code
  - Review `internal/crypto.ts` MAC verification
  - Document any timing-sensitive operations

- [ ] **Error handling audit**
  - Review error messages for information leakage
  - Ensure crypto errors don't reveal key material
  - Verify session recovery doesn't expose state

### Memory Leak Testing

- [ ] **Create memory leak test suite**
  - Test session creation/destruction cycles
  - Test encryption/decryption loops
  - Test IndexedDB operations
  - Run with `--expose-gc` to force GC

- [ ] **Long-running stability test**
  - Create test that runs 1000+ encrypt/decrypt cycles
  - Monitor memory growth over time
  - Document any leaks found and fixes applied

---

## Week 12: Documentation & Release

### Framework Integration Examples

- [x] **Create React integration example** ✅ Completed 2025-11-26
  - Location: `examples/react-integration/`
  - Include:
    - Custom hook for session management (`useSignalProtocol`)
    - Context provider for key storage (`SignalProtocolProvider`)
    - Component example for secure messaging (`SecureChat.tsx`)
  - Add README with setup instructions
  - Add `yarn example:react` script (pending)

- [x] **Create Vue integration example** ✅ Completed 2025-11-26
  - Location: `examples/vue-integration/`
  - Include:
    - Composable for session management (`useSignalProtocol`)
    - Provide/inject pattern for key storage (`provideSignalProtocol`/`injectSignalProtocol`)
    - Component example for secure messaging (`SecureChat.vue`)
  - Add README with setup instructions
  - Add `yarn example:vue` script (pending)

### Documentation Polish

- [x] **Create troubleshooting guide** ✅ Completed 2025-11-26
  - File: `docs/troubleshooting.md`
  - Common issues and solutions:
    - WebCrypto not available
    - IndexedDB quota exceeded
    - Session establishment failures
    - Identity key changes
    - Pre-key exhaustion
  - **Also added**: Browser compatibility issues, performance tips, storage migration

- [ ] **Expand FAQ section**
  - Add to `docs/README.md` or create `docs/FAQ.md`
  - Topics:
    - Why not use @signalapp/libsignal-client?
    - How does this compare to the official library?
    - Is this production-ready?
    - What about post-quantum support?
    - How do I report security issues?

- [ ] **Update API documentation**
  - Run `yarn docs:api` and review output
  - Ensure all public APIs are documented
  - Add usage examples to JSDoc comments
  - Verify TypeDoc generates clean output

- [ ] **Review and update all docs**
  - `docs/README.md` – main hub
  - `docs/quick-start-guide.md` – getting started
  - `docs/pwa-guide.md` – PWA integration
  - `docs/MIGRATION.md` – migration from beta
  - `docs/browser-compatibility.md` – browser support
  - `docs/limitations.md` – known limitations

### v1.0.0 Release Preparation

- [ ] **Semantic versioning review**
  - Review all changes since v0.1.0-beta.2
  - Identify any breaking changes
  - Document migration steps if needed

- [ ] **Update CHANGELOG.md**
  - Add v1.0.0 section with all changes
  - Categorize: Added, Changed, Fixed, Deprecated, Removed, Security
  - Include migration notes from beta

- [ ] **Update package.json for stable release**
  - Remove `-beta` suffix from version
  - Verify `main`, `module`, `types`, `exports` fields
  - Review `files` array for included content
  - Verify `repository`, `homepage`, `bugs` URLs

- [ ] **Create migration guide from beta**
  - File: `docs/MIGRATION.md` (update existing)
  - Document any API changes since beta
  - Provide code examples for migration
  - Include deprecation timeline if applicable

- [ ] **Pre-release validation**
  - Run `yarn release:beta` (uses full validation pipeline)
  - Verify all tests pass
  - Verify bundle size <100 KB
  - Verify documentation builds

- [ ] **Publish to npm**
  - `npm publish` (without `--tag next`)
  - Verify package available on npmjs.com
  - Test installation in fresh project

- [ ] **Create GitHub Release**
  - Tag: `v1.0.0`
  - Title: `v1.0.0 - Production Release`
  - Body: Copy from CHANGELOG.md
  - Attach any relevant assets

- [ ] **Post-release tasks**
  - Update README badges for stable version
  - Announce on GitHub Discussions
  - Update any external documentation/links

---

## Exit Criteria

### Bundle Size

- [ ] Primary ESM bundle <100 KB gzipped
- [ ] Core-only bundle available for minimal footprint
- [ ] Tree-shaking verified and documented

### Browser Testing

- [ ] Chromium: ✅ All tests passing
- [ ] Firefox: ✅ All tests passing
- [ ] WebKit/Safari: ✅ All tests passing
- [ ] Edge: ✅ Verified compatible
- [ ] Mobile: ✅ Manual testing documented

### Test Coverage

- [ ] Statement coverage ≥95%
- [ ] Branch coverage ≥90%
- [ ] No critical test issues open
- [ ] E2E tests passing on all browsers

### Performance

- [ ] Benchmark suite documented
- [ ] No memory leaks identified
- [ ] Performance characteristics documented

### Security

- [ ] Security review checklist complete
- [ ] Dependency audit clean
- [ ] No critical vulnerabilities

### Documentation

- [ ] API reference complete and published
- [ ] Framework integration examples (React, Vue)
- [ ] Troubleshooting guide
- [ ] FAQ expanded
- [ ] Migration guide from beta

### Release

- [ ] CHANGELOG.md updated
- [ ] v1.0.0 published to npm (stable)
- [ ] GitHub Release created
- [ ] Announcement posted

---

## Success Criteria

Phase 3 is complete when:

1. ✅ **Bundle optimized** – <100 KB gzipped with optional splits
2. ✅ **Cross-browser verified** – Chrome, Firefox, Safari, Edge all passing
3. ✅ **Production hardened** – Security review complete, no memory leaks
4. ✅ **Fully documented** – API reference, examples, troubleshooting, FAQ
5. ✅ **v1.0.0 released** – Stable version on npm with GitHub Release

---

## Known Issues & Tech Debt

### Carried Forward

1. **Jest maxWorkers=1** – Worker crash issue persists; revisit upstream
2. **TypeDoc version warning** – TS 5.9 vs expected ≤5.7 (benign)
3. **Node ESM loader** – Requires extension mapping; bundler paths verified

### Coverage Gaps to Address

1. `session-cipher.ts` archival/decryption retry loops (lines 250-350, 390+)
2. `session-record.ts` legacy migration branches (lines 30-220)
3. `internal/crypto.ts` HKDF fallback + MAC error paths

### Deferred to Post-v1.0.0

| Feature | Reason | Target |
|---------|--------|--------|
| PQXDH (Post-Quantum) | No JS/TS ML-KEM implementation | v2.0.0 |
| Group messaging | Significant scope | v2.0.0 |
| Sealed sender | Optional feature | v1.x |
| WASM curve ops | Performance optimization | v1.x |

---

## Tracking

- Update this checklist as tasks are completed
- Use GitHub Issues for detailed task tracking
- Hold weekly review to assess progress
- Adjust scope if needed to meet v1.0.0 deadline

---

**Last Updated**: 2025-11-26
**Status**: In Progress (Week 11 - Performance & Security)
**Expected Completion**: Week 12 end
