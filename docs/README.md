# Documentation Index

This directory contains comprehensive documentation for the libsignal-protocol-typescript modernization effort.

## Planning Documents

### [Modernization Plan](./modernization-plan.md)

**The main planning document** - A comprehensive 14-section plan covering:

- Current state analysis
- Official Signal Protocol status
- Gap analysis and technical debt
- Three-phase modernization strategy (12 weeks)
- Detailed implementation roadmap
- Testing strategy
- PWA-specific considerations
- Risk assessment
- Timeline and milestones

**Read this first** for a complete understanding of the modernization effort.

### [Quick Start Guide](./quick-start-guide.md)

**Condensed reference** for quick lookups:

- Critical decisions made
- Immediate next steps
- Goals by phase
- Technology updates summary
- Common issues and solutions
- Quick commands reference

**Read this** for a fast overview and quick reference.

### [Phase 1 Checklist](./phase1-checklist.md)

**Detailed implementation checklist** for Phase 1 (Weeks 1-3):

- Week-by-week breakdown
- Day-by-day tasks
- Code examples and configurations
- Success criteria
- Tracking guidelines

**Use this** to execute Phase 1 tasks.

### [Phase 2 Checklist](./phase2-checklist.md)

**Modernization plan** for Weeks 4-8:

- Regenerate protobufs and expand integration coverage
- Deliver IndexedDB adapter, PWA sample, and browser automation
- Shrink bundle footprint below 100 KB gzipped and publish beta release

**Use this** to execute the second milestone once Phase 1 is closed out.

### [Build & Testing Handbook](./build-and-testing.md)

**Living reference** for developer workflows:

- Toolchain summary and key commands
- Coverage expectations and current metrics
- Build artifact layout (CJS + ESM)
- Outstanding QA and packaging tasks
- Browser automation + API documentation commands
- Release workflow (`yarn release:beta`) and bundle-size guard rails
- GitHub Pages steps for publishing the API (see [api-publishing.md](./api-publishing.md))

**Share this** with anyone wiring the library into CI or release tooling.

### [Dependency Decisions](./dependencies.md)

**Current status log** for runtime and development dependencies:

- Audit results and security notes
- Version rationale for each package
- Follow-up tasks for updates or replacements

**Review this** before modifying dependencies or running upgrade campaigns.

### [Current Limitations](./limitations.md)

**Snapshot of outstanding gaps** in the implementation:

- Known defects and tech debt carried from the legacy codebase
- Features deferred to Phase 2/3 (PQXDH, storage adapters, etc.)
- Browser compatibility caveats and WebCrypto notes

**Consult this** when planning roadmap work or communicating caveats to stakeholders.

### [Migration Guide](./MIGRATION.md)

**Upgrade handbook** for consumers moving from v0.0.16:

- Build/packaging changes (dual CJS/ESM, typings)
- Tooling updates (TS 5.9, ESLint 9, Husky hooks)
- Recommended validation steps when adopting the new release

**Share this** with downstream teams integrating the updated package.

### [Official Comparison](./official-comparison.md)

**Reference for stakeholders** evaluating the library against `@signalapp/libsignal-client`:

- Platform support matrix (Node vs browser)
- API differences and crypto capabilities
- Guidance on when to choose each implementation

**Use this** when communicating trade-offs with product/security teams.

### [Browser Compatibility](./browser-compatibility.md)

**Matrix and requirements** for supported environments:

- Tested browser versions and status notes
- WebCrypto APIs required and polyfill guidance
- PWA-related headers and storage recommendations

**Review this** when targeting new platforms or configuring CI.

### [PWA Integration Guide](./pwa-guide.md)

**Step-by-step guide** for building PWAs with the library:

- IndexedDB-backed `SignalProtocolStore`
- Service Worker push handling and offline queues
- Bundle sizing and security considerations

**Follow this** while implementing progressive web experiences.

## Key Findings Summary

### Critical Discovery

The official Signal JavaScript library (`libsignal-protocol-javascript`) has been **deprecated and replaced** by `@signalapp/libsignal-client`, which is:

- ✅ Actively maintained (v0.83.0 as of Oct 2025)
- ✅ Written in Rust with TypeScript bindings
- ❌ **Node.js ONLY** - does NOT support browsers or PWA

This means **there is NO official Signal Protocol implementation for browser/PWA environments**.

### Strategic Decision

We will **continue maintaining and modernizing** this TypeScript implementation to:

1. Fill the critical gap in browser/PWA support
2. Stay aligned with official Signal Protocol specifications
3. Provide a production-ready Signal Protocol library for web applications

## Protocol Status (2024/2025)

### Current Implementations

| Protocol             | Status in Our Library | Priority |
| -------------------- | --------------------- | -------- |
| X3DH (Key Agreement) | ✅ Implemented        | Maintain |
| Double Ratchet       | ✅ Implemented        | Maintain |
| PQXDH (Post-Quantum) | ❌ Not Implemented    | Future   |

### Post-Quantum Update

Signal added **PQXDH** in 2024, which combines:

- ML-KEM-1024 (formerly Kyber, now FIPS-203)
- Traditional X3DH

**Our approach**: Defer to post-v1.0.0 due to complexity and lack of JS/TS ML-KEM implementations.

## Modernization Timeline

```
Phase 1: Foundation (Weeks 1-3)
└── Fix tests, update build, audit dependencies

Phase 2: Modernization (Weeks 4-8)
└── TypeScript strict mode, crypto updates, PWA optimizations

Phase 3: Enhancement (Weeks 9-12)
└── Performance, documentation, v1.0.0 release
```

## Quick Start

1. **For planning**: Read [modernization-plan.md](./modernization-plan.md)
2. **For implementation**: Follow [phase1-checklist.md](./phase1-checklist.md)
3. **For quick reference**: Use [quick-start-guide.md](./quick-start-guide.md)

## Current Status (2025-10-17)

| Component     | Status            | Notes                                                              |
| ------------- | ----------------- | ------------------------------------------------------------------ |
| Tests         | ✅ Stable         | Jest 29 with custom environment; 210 specs passing                 |
| Coverage      | ✅ Branch 81%     | 92% statements / 81% branches / 94% functions                      |
| Build         | ✅ Dual output    | `yarn build` emits `lib/cjs` + `lib/esm` with d.ts                 |
| Dependencies  | ⚠️ Review pending | Runtime deps unchanged; audit queued                               |
| Documentation | 🔄 Updating       | Quick start & Phase 1 checklist refreshed                          |
| PWA Ready     | ❌ Not optimized  | IndexedDB adapter + bundle size work outstanding                   |
| CI/CD         | ✅ Running        | GitHub Actions (`.github/workflows/ci.yml`) covers lint/test/build |

**Immediate Focus**: Complete dependency audit and begin PWA/browser integration work before shipping a beta.

## Key Files to Understand

### Source Code

- `src/index.ts` - Main exports
- `src/types.ts` - Type definitions
- `src/session-builder.ts` - Session establishment (X3DH)
- `src/session-cipher.ts` - Encryption/decryption (Double Ratchet)
- `src/internal/crypto.ts` - Symmetric crypto (AES, HMAC)
- `src/internal/curve.ts` - Curve25519 operations

### Configuration

- `tsconfig.base.json`, `tsconfig.cjs.json`, `tsconfig.esm.json` - Shared strict compiler settings
- `package.json` - Dual build scripts, prepare hook, Yarn Berry
- `jestconfig.json` - ts-jest config, coverage thresholds, custom environment

## Success Criteria

### Phase 1 (Foundation)

- ✅ All tests passing with coverage reporting
- ✅ Modern build system (ESM + CJS) with strict TS config
- ✅ CI/CD operational (GitHub Actions on push/PR)
- 🔄 Dependencies updated (security audit pending)

### Phase 2 (Modernization)

- ✅ TypeScript strict mode
- 🔄 Protocol compliance verified (extend vector coverage)
- ❌ PWA optimizations
- ❌ Bundle <100KB

### Phase 3 (Enhancement)

- ❌ Performance benchmarks
- 🔄 Comprehensive docs
- ❌ Browser tested
- ❌ v1.0.0 released

## Resources

### Official Signal

- [Protocol Specifications](https://signal.org/docs/)
- [X3DH Spec](https://signal.org/docs/specifications/x3dh/)
- [PQXDH Spec](https://signal.org/docs/specifications/pqxdh/)
- [Double Ratchet Spec](https://signal.org/docs/specifications/doubleratchet/)

### Signal Repositories

- [libsignal (main)](https://github.com/signalapp/libsignal)
- [libsignal-client (NPM)](https://www.npmjs.com/package/@signalapp/libsignal-client)
- [Deprecated JS lib](https://github.com/signalapp/libsignal-protocol-javascript)

### Original Fork

- [privacyresearchgroup/libsignal-protocol-typescript](https://github.com/privacyresearchgroup/libsignal-protocol-typescript)

## Contributing

### Phase 1 (Current)

Internal modernization - not accepting external contributions yet

### Post-Phase 1

Will open for community contributions with:

- Contributing guidelines
- Code of conduct
- Issue templates
- Development setup guide

## Questions?

For questions about:

- **Planning**: See [modernization-plan.md](./modernization-plan.md) FAQ section
- **Implementation**: See [phase1-checklist.md](./phase1-checklist.md)
- **Quick answers**: See [quick-start-guide.md](./quick-start-guide.md) FAQ section

## Document Status

| Document              | Status      | Last Updated |
| --------------------- | ----------- | ------------ |
| modernization-plan.md | ✅ Baseline | 2025-10-17   |
| quick-start-guide.md  | 🔄 Updated  | 2025-10-17   |
| phase1-checklist.md   | 🔄 Updated  | 2025-10-17   |
| build-and-testing.md  | 🆕 Draft    | 2025-10-17   |
| README.md (this file) | 🔄 Updated  | 2025-10-17   |

## Next Review

- After Phase 1 completion
- Update with actual progress and learnings
- Adjust Phase 2 and 3 plans as needed

---

**Prepared by**: Claude Code
**Date**: 2025-10-17
**Version**: 1.0
