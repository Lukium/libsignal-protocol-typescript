# Comparison with @signalapp/libsignal-client

_Last reviewed: 2025-10-17_

This document highlights the most important differences between our maintained TypeScript implementation and Signal’s official `@signalapp/libsignal-client` package.

## 1. Platform Support

| Capability | libsignal-protocol-typescript | @signalapp/libsignal-client |
| ---------- | ----------------------------- | --------------------------- |
| Node.js    | ✅ (pure TypeScript)           | ✅ (native addon)           |
| Browsers / PWAs | ✅ (WebCrypto-based)      | ❌ (Node-only bindings)     |
| Workers (Service/Web) | ✅ (with WebCrypto) | ❌                           |
| Mobile (React Native) | ⚠️ Requires polyfills | ✅ via native bridges       |

## 2. Implementation Architecture

- **Language**: This project is TypeScript-only with pure JS crypto fallbacks; `libsignal-client` is Rust compiled to native platforms.
- **Crypto Primitives**: We rely on WebCrypto + asm.js Curve25519. `libsignal-client` uses native Rust implementations and already supports PQXDH.
- **Serialization**: Protobuf generated via `ts-proto`; the Rust library uses prost/serde with bindings exposed through Neon (Node) or JNI/Swift bridges.

## 3. API Surface Differences

- **Session Management**: Our API mirrors the legacy `libsignal-protocol-javascript` (`SessionBuilder`, `SessionCipher`, `SignalProtocolStore`). The official client exposes higher-level async functions (`createSenderKeyStore`, `encryptPreKeySignalMessage`, etc.).
- **Error Handling**: This library throws JavaScript `Error` instances; `libsignal-client` returns Rust error enums mapped to JS objects with additional metadata.
- **Post-Quantum Support**: PQXDH is deferred here (see `docs/limitations.md`); Signal’s official client ships PQXDH by default.
- **Storage Interfaces**: Browser-oriented store contracts (`SignalProtocolStore` adapters) are first-class here. `libsignal-client` expects native storage via callbacks, unsuitable for IndexedDB without heavy bridging.

## 4. When to Choose Each Library

Use `@lukium/libsignal-protocol-typescript` when:

- You need browser/PWA compatibility without native modules.
- You require transparent TypeScript sources for auditing or customization.
- You depend on the legacy API from `libsignal-protocol-javascript` and cannot rewrite to the new Rust bindings yet.

Use `@signalapp/libsignal-client` when:

- You can run Node-native modules (server, desktop).
- You need PQXDH today and can adopt Signal’s new API surface.
- You prefer officially supported releases with upstream feature parity.

## 5. Interoperability Notes

- Both libraries emit compatible Signal messages (PreKey/SignalMessage) when using the same protobuf schema. Ensure protobuf updates stay aligned during future upgrades.
- Identity key formats remain Curve25519; migrating between libraries is mostly about adapting store interfaces and transport encoding.
- Verify bundle size and performance: native Rust bindings outperform the TypeScript version for high-throughput servers, while our implementation favors portability.

Track future convergence work in `docs/modernization-plan.md` as we evaluate incorporating PQXDH and regenerated protobufs.
