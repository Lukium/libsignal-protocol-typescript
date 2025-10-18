# Modernization Quick Start Guide

This is a condensed reference for the modernization plan. For full details, see [modernization-plan.md](./modernization-plan.md).

## Critical Decisions Made

### 1. Continue TypeScript Implementation (Not Migrate to Official)

**Why**: The official `@signalapp/libsignal-client` does NOT support browsers/PWA - it's Node.js only. We're filling a critical gap in the ecosystem.

### 2. Three-Phase Approach (12 Weeks)

- **Phase 1** (Weeks 1-3): Fix foundation - tests, build, dependencies
- **Phase 2** (Weeks 4-8): Modernize - TypeScript, crypto, PWA
- **Phase 3** (Weeks 9-12): Enhance - performance, docs, v1.0.0

### 3. Defer Post-Quantum (PQXDH)

PQXDH support is planned for future (post-v1.0.0) due to complexity and lack of JS/TS ML-KEM implementations.

## Immediate Next Steps (Week 1)

### 1. Maintain Coverage & Confidence (Day 1-2)

```bash
# Watch branch hot spots in session-cipher/session-record/internal crypto
yarn test --coverage
# keep jestconfig.json thresholds at 80/80/80/80 and ensure new work preserves them
```

### 2. Finalize Packaging Decisions (Day 2-3)

- Confirm Yarn Berry adoption (`.yarnrc.yml`, `.yarn/`) or roll back to Yarn Classic.
- Add `exports` map and smoke tests for CJS/ESM bundles.

### 3. Monitor CI/CD (Day 4-5)

- Workflow: `.github/workflows/ci.yml`
- Validates lint → typecheck → tests (coverage) → build on Node 18 & 20
- Coverage artifact (`coverage/lcov.info`) uploaded from the 20.x run

## Key Goals by Phase

### Phase 1 Goals

- ✅ All tests passing (Jest 29, ts-jest, custom env)
- ✅ Modern build system (ESM + CJS)
- ✅ CI/CD running (GitHub Actions on push/PR)
- 🔄 Dependencies audited and updated (crypto deps pending review)

### Phase 2 Goals

- ✅ TypeScript strict mode enabled (shared tsconfig)
- 🔄 Protocol compliance verified (extend integration vectors)
- 🔄 PWA optimizations complete (browser storage adapters outstanding → IndexedDB adapter shipped)
- 🔄 Bundle size <100KB *(Phase 2 ceiling adjusted to ≤110 KB; sub-100 KB slated for Phase 3)*

### Phase 3 Goals

- 🔄 Performance benchmarks passing
- 🔄 Comprehensive documentation
- 🔄 Browser compatibility tested
- 🔄 v1.0.0 released

## PWA Requirements Checklist

- [x] Service Worker compatible (no DOM dependencies)
- [x] IndexedDB storage adapter (see `examples/storage-adapters/indexeddb-adapter.ts`)
- [ ] Bundle size <100KB gzipped
- [x] Tree-shakeable exports
- [x] Works offline
- [ ] WebCrypto API optimized

## Technology Updates Summary

| Component   | Current  | Target    | Reason                               |
| ----------- | -------- | --------- | ------------------------------------ |
| TS Target   | ES6      | ES2020    | Modern features, better optimization |
| Module      | CommonJS | ESM + CJS | PWA compatibility, tree-shaking      |
| Strict Mode | Partial  | Full      | Type safety                          |
| Source Maps | No       | Yes       | Debugging                            |

## Testing Strategy

1. ✅ Fix existing tests (Week 1)
2. ✅ Add protocol compliance tests (Week 5-6 – multi-device IndexedDB harness)
3. ✅ Add browser tests (Week 7-8 – Playwright smoke test)
4. ✅ Add performance benchmarks (Week 9 – `yarn benchmark`)

Current coverage (2025-10-19): 97.3% statements / 91.2% branches / 95.0% functions / 97.3% lines  
Target: Maintain ≥95% statements / ≥90% branches going forward

Use `setLogger` (exported from the package root) to plug the library into your telemetry pipeline; by default only warnings/errors bubble to the console.

## Security Considerations

- ✅ Use official Signal test vectors
- ✅ Implement timing-safe comparisons
- ✅ Regular security audits
- ✅ Follow Signal Protocol specifications exactly
- ✅ No deviation from cryptographic standards

## Resources

### Official Signal Docs

- Specifications: https://signal.org/docs/
- X3DH: https://signal.org/docs/specifications/x3dh/
- Double Ratchet: https://signal.org/docs/specifications/doubleratchet/

### Signal Repos

- Main repo: https://github.com/signalapp/libsignal
- NPM package: https://www.npmjs.com/package/@signalapp/libsignal-client

### Community

- Source repository: https://github.com/Lukium/libsignal-protocol-typescript (originally forked from privacyresearchgroup/libsignal-protocol-typescript)
- Our issues: Track in GitHub Issues
- Our discussions: GitHub Discussions

## Common Issues and Solutions

### Issue: Branch coverage below 80%

**Solution**: Add targeted specs around ratchet edge cases and multi-device pre-key flows

### Issue: Module Resolution

**Solution**: Dual-build via `yarn build:cjs` + `yarn build:esm`; decide Yarn tooling and add package `exports`

### Issue: PWA Compatibility

**Solution**: Maintain DOM-free core, implement IndexedDB storage adapter, document required WebCrypto APIs

### Issue: Bundle Too Large

**Solution**: Tree-shaking, code splitting, lazy loading

### Quick commands

- `yarn example:pwa-vite` – run the Vite + Service Worker demo (after `yarn build`)
- `yarn test:e2e` – execute Playwright smoke tests
- `yarn benchmark` – capture baseline performance metrics

## Quick Commands

```bash
# Install dependencies (Node.js 18+ recommended)
yarn install --immutable

# Run tests
yarn test

# Build
yarn build

# Lint
yarn lint

# Format
yarn format

# Run all checks
yarn lint && yarn test && yarn build
```

## Project Structure

```
/libsignal-protocol-typescript
├── src/                    # Source code
│   ├── index.ts           # Main exports
│   ├── types.ts           # Type definitions
│   ├── session-*.ts       # Session management
│   ├── key-helper.ts      # Key generation
│   └── internal/          # Internal crypto
├── docs/                   # Documentation
│   ├── modernization-plan.md
│   └── quick-start-guide.md
├── lib/                    # Build output
├── .github/               # CI/CD
└── package.json

```

## Communication Plan

1. **Weekly Updates**: Document progress in GitHub Discussions
2. **Breaking Changes**: Announce in advance with migration guide
3. **Security Issues**: Private reporting to maintainers
4. **Feature Requests**: GitHub Issues with "enhancement" label

## Success Metrics

### Technical

- Tests: >90% coverage
- Bundle: <100KB gzipped
- Performance: Within 2x of native implementations
- Compatibility: Chrome, Firefox, Safari (latest 2 versions)

### Project

- Stars: 50+ in 6 months
- Projects: Used in 3+ production projects
- Contributors: 5+ community contributors

## FAQ

**Q: Why not use @signalapp/libsignal-client?**
A: It's Node.js only, doesn't support browsers/PWA.

**Q: Is this production-ready now?**
A: No, tests are broken. Will be ready at v1.0.0 (end of Phase 3).

**Q: Will you support Post-Quantum (PQXDH)?**
A: Yes, but in a future version (post-v1.0.0).

**Q: Can I contribute?**
A: Yes! Once Phase 1 is complete and we have a stable base.

**Q: What about group messaging?**
A: Out of scope for v1.0.0. May be added in future versions.

**Q: Is this endorsed by Signal?**
A: No, this is an independent implementation following Signal's open specifications.

---

**Last Updated**: 2025-10-17
**Status**: Planning Phase
**Next Review**: After Phase 1 completion
