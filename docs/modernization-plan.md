# Signal Protocol TypeScript Library - Modernization Plan

**Version:** 1.0
**Date:** 2025-10-18
**Status:** Execution (Phase 2)

## Executive Summary

This document outlines the comprehensive modernization plan for the forked `libsignal-protocol-typescript` library. The primary goals are to modernize the codebase against the latest Signal Protocol specifications, ensure functionality for Progressive Web Application (PWA) deployment, and address the significant gap created by Signal's deprecation of their JavaScript implementation.

### Progress Snapshot (2025-10-18)

- ✅ Jest environment repaired; 223 specs passing with 92% statement / 80% branch coverage (threshold restored to 80%).
- ✅ Dual CJS/ESM build emitting declarations and source maps through Yarn Berry scripts.
- ✅ CI/CD live on GitHub Actions (Node 18 & 20: lint → typecheck → test → build, coverage artifact uploaded; Jest still pinned to maxWorkers=1).
- ✅ Dependency audit (transitive CVEs resolved via Yarn resolutions; protobuf bundle refreshed from tracked `proto/` sources)
- ✅ Session cipher and curve negative-path tests expanded to stabilize regenerated protobufs.
- ❌ PWA storage adapters, bundle-size reduction, and PQXDH support remain future milestones.

### Key Findings

1. **Official Library Status**: Signal's official JavaScript implementation (`libsignal-protocol-javascript`) has been **deprecated and unmaintained** since 2021
2. **Official Replacement**: `@signalapp/libsignal-client` (Rust-based, TypeScript bindings) is **Node.js only** and **does NOT support browser/PWA environments**
3. **Critical Gap**: No official Signal Protocol implementation exists for browser/PWA use cases
4. **Current Library State**: Our fork is based on v0.0.16 (2 years old) with broken tests and outdated dependencies
5. **Protocol Updates**: Post-Quantum Extended Diffie-Hellman (PQXDH) was added in 2024 for post-quantum security

### Strategic Decision

Given the lack of official browser support, we will **continue maintaining and modernizing the TypeScript implementation** while staying aligned with official Signal Protocol specifications. This positions our library as a viable solution for PWA and browser-based Signal Protocol implementations.

---

## 1. Current State Analysis

### 1.1 Codebase Overview

**Repository**: Fork of `https://github.com/privacyresearchgroup/libsignal-protocol-typescript`
**Current Version**: 0.0.16
**Last Update**: ~2 years ago
**License**: GPL-3.0-only

### 1.2 Technology Stack

| Component     | Current Version  | Status    |
| ------------- | ---------------- | --------- |
| TypeScript    | 5.8.3            | Modern    |
| Target        | ES2020           | ✅ Modern |
| Module System | Dual (ESM + CJS) | ✅ Modern |
| Jest          | 29.7.0           | Modern    |
| ESLint        | 9.38.0           | Modern    |
| Yarn          | 4.5.3            | Modern    |

### 1.3 Dependencies

#### Production Dependencies

- `@privacyresearch/curve25519-typescript` ^0.0.12
- `protobufjs` ^7.5.4 (runtime for in-repo protobuf codecs)
- `base64-js` ^1.5.1

#### Key Issues

- Custom curve25519 implementation (asm.js from C via emscripten)
- Outdated protobuf definitions
- Missing modern cryptographic algorithm support

### 1.4 Current Test Status

**Passing** – 223 specs across 17 suites succeed using the repaired Jest environment (`TestEnvironment` wrapper in `src/__test-utils__/custom-jest-environment.js`). Latest coverage snapshot: 92% statements / 80% branches / 94% functions / 92% lines. The remaining gap is concentrated in `session-cipher.ts`, `session-builder.ts`, and `session-record.ts`.

### 1.5 Core Implementation Files

```
/src
  ├── index.ts                      # Main export
  ├── types.ts                      # Type definitions
  ├── signal-protocol-address.ts    # Address handling
  ├── key-helper.ts                 # Key generation utilities
  ├── session-builder.ts            # Session establishment
  ├── session-cipher.ts             # Encryption/decryption
  ├── session-record.ts             # Session state
  ├── session-types.ts              # Session type definitions
  ├── session-lock.ts               # Concurrency control
  ├── fingerprint-generator.ts      # Identity verification
  ├── curve.ts                      # Public wrapper for curve ops
  └── internal/
      ├── curve.ts                  # Curve25519 operations
      └── crypto.ts                 # Symmetric crypto (AES, HMAC)
```

---

## 2. Official Signal Status and Implications

### 2.1 Signal's Current State

**Official Implementation**: `@signalapp/libsignal-client`

- **Version**: 0.83.0 (published 6 days ago)
- **Language**: Rust with TypeScript/Java/Swift bindings
- **Platform**: Node.js only (native addons)
- **PWA/Browser**: ❌ **NOT SUPPORTED**

### 2.2 API Changes in Official Implementation

| Old API (JavaScript/TypeScript)  | New API (@signalapp/libsignal-client) |
| -------------------------------- | ------------------------------------- |
| `PreKeyWhisperMessage`           | `PreKeySignalMessage`                 |
| `WhisperMessage`                 | `SignalMessage`                       |
| `SessionBuilder.processPreKey()` | Different session API                 |
| Promise-based                    | Promise-based                         |
| CommonJS                         | ESM                                   |

### 2.3 Protocol Specifications

#### Current Protocols (2024/2025)

1. **X3DH** (Extended Triple Diffie-Hellman)
   - Original key agreement protocol
   - Specification: https://signal.org/docs/specifications/x3dh/

2. **PQXDH** (Post-Quantum Extended Diffie-Hellman) ⭐ NEW
   - Added in 2024
   - Combines ML-KEM-1024 (formerly Kyber) with X3DH
   - Post-quantum forward secrecy
   - Migration from pqcrypto-kyber to pqcrypto-mlkem (FIPS-203)
   - Specification: https://signal.org/docs/specifications/pqxdh/

3. **Double Ratchet Algorithm**
   - Core message encryption
   - Specification: https://signal.org/docs/specifications/doubleratchet/

---

## 3. Gap Analysis

### 3.1 Functionality Gaps

| Feature              | Current Status | Required | Priority |
| -------------------- | -------------- | -------- | -------- |
| X3DH Key Agreement   | ✅ Implemented | Yes      | -        |
| PQXDH (Post-Quantum) | ❌ Missing     | Future   | Low      |
| Double Ratchet       | ✅ Implemented | Yes      | -        |
| Session Management   | ✅ Implemented | Yes      | -        |
| PreKey Rotation      | ⚠️ Basic       | Enhanced | Medium   |
| Sealed Sender        | ❌ Missing     | Optional | Low      |
| Group Messaging      | ❌ Missing     | Optional | Low      |

### 3.2 Technical Debt

1. **TypeScript Configuration**
   - Target: ES6 (should be ES2020+)
   - Module: CommonJS (should support ESM for PWA)
   - `noImplicitAny: false` (should be true)

2. **Testing Infrastructure**
   - Broken Jest configuration
   - Custom environment causing failures
   - Outdated test patterns

3. **Build System**
   - No tree-shaking support
   - No minification
   - No bundle size optimization
   - Missing source maps

4. **Crypto Implementation**
   - Using asm.js (dated, consider WASM)
   - No WebCrypto API optimization
   - Missing SubtleCrypto modern APIs

### 3.3 PWA-Specific Requirements

| Requirement               | Current      | Needed      |
| ------------------------- | ------------ | ----------- |
| Service Worker Compatible | ⚠️ Unknown   | ✅ Required |
| Web Crypto API            | ✅ Supported | ✅ Optimize |
| IndexedDB Storage         | ❌ Manual    | ⚠️ Helper   |
| Bundle Size               | ❌ Unknown   | ✅ <100KB   |
| Tree-shakeable            | ❌ No        | ✅ Yes      |
| TypeScript Declarations   | ✅ Yes       | ✅ Improve  |

---

## 4. Modernization Strategy

### 4.1 Core Principles

1. **Maintain Browser/PWA Compatibility** - This is our primary differentiator
2. **Stay Aligned with Signal Specs** - Follow official protocol specifications
3. **Pragmatic Updates** - Prioritize practical improvements over theoretical perfection
4. **Backward Compatibility** - Maintain existing API where possible
5. **Security First** - All crypto updates must be thoroughly reviewed and tested

### 4.2 Three-Phase Approach

```
Phase 1: Foundation (Weeks 1-3)
├── Fix immediate issues
├── Update build tooling
├── Restore test suite
└── Update dependencies

Phase 2: Modernization (Weeks 4-8)
├── TypeScript improvements
├── Crypto modernization
├── API enhancements
└── PWA optimizations

Phase 3: Enhancement (Weeks 9-12)
├── Advanced features
├── Performance optimization
├── Documentation
└── Production readiness
```

---

## 5. Detailed Implementation Plan

### Phase 1: Foundation (Weeks 1-3)

#### 1.1 Fix Test Infrastructure (Week 1)

**Priority**: Critical

**Tasks**:

- [ ] Fix Jest custom environment configuration
- [ ] Update jest.config.json for modern Node.js
- [ ] Restore all existing tests to passing state
- [ ] Add test coverage reporting
- [ ] Set up CI/CD pipeline (GitHub Actions)

**Files to Modify**:

- `src/__test-utils__/custom-jest-environment.js`
- `jestconfig.json`
- `.github/workflows/test.yml` (new)

**Success Criteria**:

- All existing tests pass
- Coverage report generated
- CI running on PR and main branch

#### 1.2 Update Build Configuration (Week 1)

**Priority**: High

**Tasks**:

- [ ] Update `tsconfig.json` for modern targets
  - Target: ES2020
  - Module: ES2020 (dual build: ESM + CommonJS)
  - Enable strict mode options
  - Enable source maps
- [ ] Add dual-package build (ESM + CommonJS)
- [ ] Add bundle size tracking
- [ ] Configure tree-shaking

**tsconfig.json Updates**:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./lib",
    "rootDir": "./src"
  }
}
```

**New Build Script**:

```json
{
  "scripts": {
    "build": "yarn build:esm && yarn build:cjs",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build:cjs": "tsc -p tsconfig.cjs.json"
  }
}
```

#### 1.3 Dependency Audit and Updates (Week 2)

**Priority**: High

**Tasks**:

- [ ] Audit all dependencies for security vulnerabilities
- [ ] Update dev dependencies to latest stable versions
- [ ] Evaluate production dependencies:
  - `@privacyresearch/curve25519-typescript` - Keep or replace?
  - Protobuf codecs - Regenerate from upstream `wire.proto` / `push_messages.proto`
  - `base64-js` - Consider native base64 APIs
- [ ] Document dependency decisions

**Security Audit**:

```bash
yarn audit
yarn outdated
```

#### 1.4 Code Quality Tooling (Week 2)

**Priority**: Medium

**Tasks**:

- [ ] Update ESLint rules for strict TypeScript
- [ ] Add Prettier configuration (if not present)
- [ ] Add commitlint for conventional commits
- [ ] Add husky for pre-commit hooks
- [ ] Add lint-staged

**Files to Add/Update**:

- `.eslintrc.json`
- `.prettierrc`
- `.commitlintrc.json`
- `.husky/pre-commit`

#### 1.5 Documentation Baseline (Week 3)

**Priority**: Medium

**Tasks**:

- [ ] Document current API surface
- [ ] Create migration guide from v0.0.16
- [ ] Add inline JSDoc comments to all public APIs
- [ ] Create examples directory
- [ ] Document browser compatibility matrix

---

### Phase 2: Modernization (Weeks 4-8)

#### 2.1 TypeScript Improvements (Week 4)

**Priority**: High

**Tasks**:

- [ ] Enable strict TypeScript options
- [ ] Fix all `any` types with proper typing
- [ ] Add generic constraints where appropriate
- [ ] Improve union and discriminated union types
- [ ] Add utility types for better DX

**Example Improvements**:

```typescript
// Before
export type SessionRecordType = string;

// After
export type SessionRecordType = string & { readonly __brand: 'SessionRecord' };

// Before
export interface StorageType {
  getIdentityKeyPair: () => Promise<KeyPairType | undefined>;
}

// After
export interface StorageType {
  getIdentityKeyPair(): Promise<KeyPairType | undefined>;
  // Add readonly where appropriate
}
```

#### 2.2 Crypto Modernization (Weeks 4-5)

**Priority**: Critical

**Tasks**:

- [ ] Audit current WebCrypto usage
- [ ] Optimize for SubtleCrypto API
- [ ] Evaluate WASM vs asm.js for curve operations
- [ ] Implement timing-safe comparisons
- [ ] Add crypto performance benchmarks

**WebCrypto Improvements**:

```typescript
// Prefer SubtleCrypto over custom implementations where possible
// Ensure constant-time operations for security-critical code
```

**Curve25519 Evaluation**:

1. Keep current asm.js implementation (proven, stable)
2. Add WASM version as optional enhancement (Phase 3)
3. Allow runtime selection based on environment

#### 2.3 Protocol Alignment (Week 5-6)

**Priority**: High

**Tasks**:

- [ ] Verify X3DH implementation against latest spec
- [ ] Verify Double Ratchet against latest spec
- [ ] Update protobuf definitions to match current Signal
- [ ] Add protocol version negotiation
- [ ] Document protocol deviations (if any)

**Protocol Verification Checklist**:

- [ ] Key derivation functions match spec
- [ ] Message formats match spec
- [ ] Session establishment follows spec
- [ ] Ratcheting behavior correct
- [ ] PreKey handling correct

#### 2.4 API Modernization (Week 6)

**Priority**: Medium

**Tasks**:

- [ ] Add modern Promise patterns (avoid callback hell)
- [ ] Add async iterators where appropriate
- [ ] Improve error types and error handling
- [ ] Add cancellation support (AbortController)
- [ ] Add progress callbacks for long operations

**Error Handling**:

```typescript
// Define specific error classes
export class SignalProtocolError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'SignalProtocolError';
  }
}

export class SessionBuildError extends SignalProtocolError {}
export class DecryptionError extends SignalProtocolError {}
export class InvalidKeyError extends SignalProtocolError {}
```

#### 2.5 PWA Optimizations (Week 7-8)

**Priority**: High (for target use case)

**Tasks**:

- [ ] Add service worker compatibility tests
- [ ] Optimize bundle size (<100KB target)
- [ ] Add tree-shaking support
- [ ] Create IndexedDB storage adapter
- [ ] Add storage quota management helpers
- [ ] Test in PWA environment

**Bundle Size Strategy**:

```typescript
// Ensure code splitting for large dependencies
// Lazy load crypto operations
// Use dynamic imports for optional features
```

**IndexedDB Adapter**:

```typescript
export class IndexedDBStorage implements StorageType {
  // Implement efficient IndexedDB-based storage
  // Handle quota exceeded errors
  // Implement migration strategies
}
```

---

### Phase 3: Enhancement (Weeks 9-12)

#### 3.1 Performance Optimization (Week 9)

**Priority**: Medium

**Tasks**:

- [ ] Profile crypto operations
- [ ] Optimize hot paths
- [ ] Add caching where appropriate
- [ ] Reduce memory allocations
- [ ] Add performance benchmarks
- [ ] Compare against @signalapp/libsignal-client (Node.js)

**Benchmarking Suite**:

- Key generation speed
- Encryption throughput
- Decryption throughput
- Session establishment time
- Memory usage

#### 3.2 Advanced Features (Week 10)

**Priority**: Low-Medium

**Tasks**:

- [ ] Enhanced PreKey rotation strategies
- [ ] Session archive/restore functionality
- [ ] Multi-device support helpers
- [ ] Session migration utilities
- [ ] Backup/restore functionality

#### 3.3 Developer Experience (Week 11)

**Priority**: Medium

**Tasks**:

- [ ] Create comprehensive examples
  - Basic messaging
  - PWA integration
  - React integration
  - Vue integration
- [ ] Interactive documentation
- [ ] Migration guide from @signalapp/libsignal-client concepts
- [ ] Troubleshooting guide
- [ ] FAQ

#### 3.4 Production Readiness (Week 12)

**Priority**: High

**Tasks**:

- [ ] Security audit (internal)
- [ ] Penetration testing checklist
- [ ] Browser compatibility testing
  - Chrome/Edge (Chromium)
  - Firefox
  - Safari (WebKit)
  - Mobile browsers
- [ ] Performance testing on low-end devices
- [ ] Memory leak testing
- [ ] Prepare v1.0.0 release

---

## 6. Testing Strategy

### 6.1 Test Categories

1. **Unit Tests**
   - All cryptographic operations
   - All public APIs
   - Edge cases and error conditions
   - Target: >90% coverage

2. **Integration Tests**
   - Full encryption/decryption flows
   - Session establishment
   - PreKey handling
   - Multi-session scenarios

3. **Protocol Compliance Tests**
   - X3DH compliance
   - Double Ratchet compliance
   - Message format validation
   - Interoperability tests (if possible with official clients)

4. **Browser Tests**
   - Test in real browser environments
   - Service worker compatibility
   - IndexedDB operations
   - WebCrypto API usage

5. **Performance Tests**
   - Benchmark critical operations
   - Memory usage profiling
   - Bundle size tracking

### 6.2 Test Infrastructure

```typescript
// Add test utilities
export class TestVectors {
  // Load official Signal test vectors
  // Validate our implementation against them
}

// Browser testing with Playwright or Puppeteer
describe('Browser Environment', () => {
  it('should work in service worker context', async () => {
    // Test SW compatibility
  });

  it('should handle IndexedDB storage', async () => {
    // Test storage adapter
  });
});
```

### 6.3 Continuous Testing

- **GitHub Actions**: Run tests on every PR
- **Browser Stack**: Cross-browser testing
- **Lighthouse**: PWA performance metrics
- **Bundle Size Bot**: Track bundle size changes

---

## 7. PWA-Specific Considerations

### 7.1 Service Worker Compatibility

**Requirements**:

- All APIs must work in Service Worker context
- No DOM dependencies
- Handle offline scenarios
- Background sync support

**Implementation**:

```typescript
// Ensure no window/document references
// Use Web Crypto API (available in SW)
// Handle storage in IndexedDB (available in SW)
```

### 7.2 Storage Strategy

**Options**:

1. **IndexedDB** (Recommended for PWA)
   - Large storage quota
   - Persistent across sessions
   - Available in Service Workers

2. **localStorage** (Fallback)
   - Smaller quota
   - Synchronous API
   - Not available in SW

**Implementation**:

```typescript
export interface StorageAdapter {
  // Abstract storage interface
  // Implementations: IndexedDBAdapter, LocalStorageAdapter
}
```

### 7.3 Bundle Size Optimization

**Target**: <100KB gzipped

**Strategies**:

1. Code splitting
2. Tree-shaking
3. Lazy loading of crypto primitives
4. Compression (Brotli/gzip)
5. Remove unused code

**Measurement**:

```bash
# Add bundlesize to package.json
{
  "bundlesize": [
    {
      "path": "./lib/index.js",
      "maxSize": "100 KB"
    }
  ]
}
```

### 7.4 Progressive Enhancement

```typescript
// Detect capabilities
export function checkCapabilities(): {
  webCrypto: boolean;
  indexedDB: boolean;
  serviceWorker: boolean;
  wasm: boolean;
};

// Graceful degradation if needed
```

---

## 8. Post-Quantum Considerations (Future)

### 8.1 PQXDH Implementation

**Status**: Not in Phase 1-3, but document for future

**Requirements**:

- ML-KEM-1024 (FIPS-203) implementation
- Integration with existing X3DH
- Backward compatibility with X3DH-only clients

**Challenges**:

- No pure JavaScript/TypeScript ML-KEM implementation
- Would require WASM for performance
- Significant increase in message size
- Complex migration strategy

**Recommendation**:

- Monitor ecosystem for JS/TS ML-KEM libraries
- Track Signal's implementation in libsignal
- Plan for Phase 4 (Q3 2025+)

---

## 9. Risk Assessment

### 9.1 Technical Risks

| Risk                               | Impact   | Likelihood | Mitigation                               |
| ---------------------------------- | -------- | ---------- | ---------------------------------------- |
| Breaking API changes               | High     | Medium     | Semantic versioning, deprecation notices |
| Security vulnerabilities           | Critical | Low        | Security audits, test vectors            |
| Performance regression             | Medium   | Low        | Benchmark suite, profiling               |
| Browser incompatibility            | High     | Medium     | Extensive browser testing                |
| Test failures during modernization | Medium   | High       | Fix tests incrementally                  |

### 9.2 Ecosystem Risks

| Risk                              | Impact | Likelihood | Mitigation                               |
| --------------------------------- | ------ | ---------- | ---------------------------------------- |
| Official browser support released | High   | Low        | Monitor Signal repos, adapt if needed    |
| Protocol changes                  | Medium | Low        | Follow specifications closely            |
| Dependency abandonment            | Medium | Low        | Evaluate alternatives, fork if necessary |

### 9.3 Project Risks

| Risk             | Impact | Likelihood | Mitigation                   |
| ---------------- | ------ | ---------- | ---------------------------- |
| Timeline overrun | Medium | Medium     | Phased approach, MVP first   |
| Scope creep      | Medium | High       | Strict phase boundaries      |
| Lack of adoption | Low    | Medium     | Good documentation, examples |

---

## 10. Timeline and Milestones

### Phase 1: Foundation (Weeks 1-3)

**Milestone**: Stable Base

- All tests passing
- Modern build system
- CI/CD operational
- Dependencies updated

### Phase 2: Modernization (Weeks 4-8)

**Milestone**: Modern Codebase

- TypeScript strict mode
- Protocol aligned
- PWA optimized
- API improved

### Phase 3: Enhancement (Weeks 9-12)

**Milestone**: Production Ready (v1.0.0)

- Performance optimized
- Fully documented
- Browser tested
- Examples complete

### Post-v1.0.0

- Monitor Signal Protocol updates
- Community feedback
- Feature requests
- PQXDH planning (future)

---

## 11. Success Criteria

### Technical Metrics

- ✅ All tests passing (>90% coverage)
- ✅ Bundle size <100KB gzipped
- ✅ Works in all major browsers
- ✅ Service Worker compatible
- ✅ TypeScript strict mode enabled
- ✅ Zero critical security vulnerabilities

### Quality Metrics

- ✅ Comprehensive documentation
- ✅ 5+ working examples
- ✅ Migration guide complete
- ✅ API reference generated

### Community Metrics

- ✅ 50+ GitHub stars (6 months)
- ✅ 5+ community contributions
- ✅ Used in 3+ projects

---

## 12. Open Questions

1. **Curve25519 Implementation**
   - Keep asm.js or migrate to WASM?
   - Performance vs compatibility tradeoffs?

2. **Protobuf**
   - Update to latest protobuf.js?
   - Consider alternatives (flatbuffers, capnproto)?

3. **API Breaking Changes**
   - When to introduce breaking changes?
   - Migration path strategy?

4. **Official Alignment**
   - Should we rename message types to match @signalapp/libsignal-client?
   - How closely to match official API?

5. **PQXDH Timeline**
   - When to implement?
   - Mandatory or optional?

---

## 13. Resources and References

### Official Signal Documentation

- Protocol Specifications: https://signal.org/docs/
- X3DH: https://signal.org/docs/specifications/x3dh/
- PQXDH: https://signal.org/docs/specifications/pqxdh/
- Double Ratchet: https://signal.org/docs/specifications/doubleratchet/

### Signal Repositories

- libsignal: https://github.com/signalapp/libsignal
- libsignal-client: https://www.npmjs.com/package/@signalapp/libsignal-client
- libsignal-protocol-javascript (deprecated): https://github.com/signalapp/libsignal-protocol-javascript

### Cryptography Resources

- WebCrypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- Curve25519: https://cr.yp.to/ecdh.html
- ML-KEM (Kyber): https://csrc.nist.gov/publications/detail/fips/203/final

### PWA Resources

- PWA Checklist: https://web.dev/pwa-checklist/
- IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Service Workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

---

## 14. Conclusion

This modernization plan provides a structured path to transform our forked Signal Protocol TypeScript library into a production-ready, PWA-compatible implementation. By following this three-phase approach, we will:

1. **Fill a critical gap** in the Signal Protocol ecosystem (browser/PWA support)
2. **Maintain alignment** with official Signal specifications
3. **Deliver modern APIs** with excellent developer experience
4. **Enable secure messaging** in Progressive Web Applications

The plan is ambitious but achievable over 12 weeks with dedicated effort. The phased approach allows for iterative delivery and course correction as needed.

**Next Steps**:

1. Review and approve this plan
2. Set up project tracking (GitHub Projects/Issues)
3. Begin Phase 1, Week 1 tasks
4. Schedule weekly progress reviews

---
