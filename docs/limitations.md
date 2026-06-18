# Current Limitations

_Last reviewed: 2025-10-19_

This document captures the major gaps and caveats that apply to `@lukium/libsignal-protocol-typescript` during Phase 2 of the modernization project.

## Known Issues

- **Native WebCrypto required**: As of 0.2.0, Curve25519 operations run on native WebCrypto (`X25519` + `Ed25519` via `SubtleCrypto`); the asm.js `@privacyresearch/curve25519-typescript` dependency and the `lib/msrcrypto.js` fallback were removed. Environments without native curve support (older browsers, Node < 20) are no longer supported — there is no asm.js fallback.
- **Schema Alignment**: Protobuf codecs now derive from upstream Signal `wire.proto`; monitor for new message fields (e.g., Kyber updates) and regenerate JSON descriptors as needed.
- **Session Edge Cases**: Certain archival/error paths (`session-cipher`, `session-record`) remain under-tested; additional vectors are needed for rare failure branches identified during coverage reviews.
- **Decrypt mutates ratchet state before MAC verification** (follow-up): `SessionCipher.doDecryptWhisperMessage` advances the ratchet and consumes a message key before `verifyMAC`. On the single-session path a MAC failure is harmless (the mutated record is not persisted), but `decryptWithSessionList` tries candidate sessions by reference, so a forged message could damage one session's state before a later session decrypts and the record is stored. The planned fix derives candidate state on a cloned session, verifies the MAC, then commits.
- **Console Noise**: Internal curve validation logs warning/error messages when malformed keys are encountered. These mirror legacy behaviour and may be noisy in production logs until a structured logger is introduced.

## Missing Features

- **PQXDH Support**: Post-quantum X3DH (PQXDH) is not implemented. Upgrading requires ML-KEM (Kyber) primitives that do not yet exist in a browser-safe TypeScript form.
- **PWA Toolkit Gaps**: First-party IndexedDB and Service Worker adapters now ship with tests and documentation, but quota management helpers and broader guidance remain on the roadmap.
- **Automated Browser Matrix**: CI currently runs only on Node 20 (the minimum supported version). Browser integration tests and bundle-size regression tracking are part of the Phase 2 roadmap.

## Browser Compatibility Notes

- **WebCrypto Requirements**: The library requires native `SubtleCrypto` support for AES-CBC, HMAC-SHA256, `X25519`, `Ed25519`, and `getRandomValues`. There is no asm.js fallback; use a modern browser (X25519: Chrome/Edge 133+, Firefox 130+, Safari 17+; Ed25519: Chrome 137+, Firefox 129+, Safari 17+) or **Node >= 20**.
- **SharedArrayBuffer**: Environments without proper COOP/COEP headers disable `SharedArrayBuffer`, but the library gracefully drops to `ArrayBuffer` usage. Verify headers for high-security PWAs.
- **Bundle Size**: Current ESM/CJS bundles exceed the 100 KB gzipped target. Tree-shaking improvements and splitting optional helpers are planned.

## Tracking

- Open follow-up issues for each limitation in GitHub Projects (Milestone: _Phase 1 – Foundation_).
- Revisit this file at the end of Phase 1 to confirm which items moved to Phase 2 or were resolved.
