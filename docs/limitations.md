# Current Limitations

_Last reviewed: 2025-10-17_

This document captures the major gaps and caveats that apply to `@privacyresearch/libsignal-protocol-typescript` during Phase 1 of the modernization project.

## Known Issues

- **Legacy Crypto Implementations**: Curve25519 operations still rely on the asm.js build of `msrcrypto`. An updated WebAssembly-backed implementation is planned but not yet available.
- **Schema Alignment**: Protobuf codecs now derive from upstream Signal `wire.proto`; monitor for new message fields (e.g., Kyber updates) and regenerate JSON descriptors as needed.
- **Session Edge Cases**: Certain archival/error paths (`session-cipher`, `session-record`) remain under-tested; additional vectors are needed for rare failure branches identified during coverage reviews.
- **Console Noise**: Internal curve validation logs warning/error messages when malformed keys are encountered. These mirror legacy behaviour and may be noisy in production logs until a structured logger is introduced.

## Missing Features

- **PQXDH Support**: Post-quantum X3DH (PQXDH) is not implemented. Upgrading requires ML-KEM (Kyber) primitives that do not yet exist in a browser-safe TypeScript form.
- **IndexedDB/Service Worker Adapters**: No first-party storage adapter exists for PWAs. Phase 2 will add IndexedDB-backed session stores and guidance for Service Worker usage.
- **Automated Browser Matrix**: CI currently runs only on Node 18/20. Browser integration tests and bundle-size regression tracking are part of the Phase 2 roadmap.

## Browser Compatibility Notes

- **WebCrypto Requirements**: The library assumes `SubtleCrypto` support for AES-CBC, HMAC-SHA256, and `getRandomValues`. Safari ≤13 and older Android WebViews require polyfills or fallbacks.
- **SharedArrayBuffer**: Environments without proper COOP/COEP headers disable `SharedArrayBuffer`, but the library gracefully drops to `ArrayBuffer` usage. Verify headers for high-security PWAs.
- **Bundle Size**: Current ESM/CJS bundles exceed the 100 KB gzipped target. Tree-shaking improvements and splitting optional helpers are planned.

## Tracking

- Open follow-up issues for each limitation in GitHub Projects (Milestone: _Phase 1 – Foundation_).
- Revisit this file at the end of Phase 1 to confirm which items moved to Phase 2 or were resolved.
