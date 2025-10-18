# PWA Integration Guide

_Last updated: 2025-10-17_

This guide explains how to embed `@privacyresearch/libsignal-protocol-typescript` in a Progressive Web App (PWA) with IndexedDB-backed storage and Service Worker support.

## 1. Application Architecture

- **Main thread**: Handles UI, message composition, and initiates session operations.
- **Service Worker**: Receives push notifications, syncs prekeys, and performs background decrypt/encrypt tasks.
- **IndexedDB**: Persists identity keys, sessions, and pending messages across offline periods.

## 2. Storage Recommendations

- Prefer the shared adapter at `examples/storage-adapters/indexeddb-adapter.ts`, which implements the full `SignalProtocolStore` contract with helper utilities (`setIdentityKeyPair`, `clear`, `close`).
- If rolling your own schema, create an object store per logical data type (`identities`, `sessions`, `preKeys`, `signedPreKeys`, `senderKeys`).
- Ensure async persistence (`saveIdentity`, `storeSession`, etc.) resolves to `Promise` values and deduplicates identities by address/device ID.
- Use `crypto.getRandomValues` for UUIDs and key IDs; avoid `Math.random`.

### Example Structure

```
examples/storage-adapters/
├── indexeddb-adapter.ts    # Ready-made store factory (createIndexedDBSignalProtocolStore)
└── README.md               # Usage instructions and helper APIs
```

## 3. Service Worker Integration

- Register the Service Worker with `navigator.serviceWorker.register('/sw.js')` during app bootstrap.
- Inside `sw.js`, import a build or use `importScripts` for the compiled CommonJS bundle. Prefer ES module workers (`type: 'module'`) for modern browsers.
- Listen for `push` events to fetch incoming encrypted messages. Decrypt using the same IndexedDB store (accessible via `self.indexedDB`).
- Post decrypted payloads back to the client via `clients.matchAll()` and `client.postMessage`.

## 4. Offline Support

- Cache the library bundle and supporting assets using Workbox or manual `caches.open`.
- Queue outbound messages in IndexedDB when offline; flush once connectivity returns.
- Use Background Sync (`sync` event) to retry failed uploads.

## 5. Bundle Size Considerations

- Import from the ESM build (`import { SessionBuilder } from '@privacyresearch/libsignal-protocol-typescript'`) to leverage tree-shaking.
- Exclude optional test utilities using bundler aliasing (`resolve.alias` in Vite/Webpack).
- Monitor bundle size; aim for <100 KB gzipped by deferring unused helpers (Phase 2 task).

## 6. Security Notes

- Set COOP/COEP headers to enable `SharedArrayBuffer` if required.
- Use HTTPS and enable content security policies that allow `worker-src 'self'`.
- Avoid storing long-term secrets in unprotected storage; wrap IndexedDB calls with at-rest encryption if the platform mandates it.

## 7. Next Steps

- Integrate the provided IndexedDB adapter and wire it into `examples/pwa-integration` (Phase 2 ongoing).
- Add push notification walkthrough with real device registration IDs.
- Expand automated browser tests to validate worker + IndexedDB interactions.

Track progress against the Phase 1/2 checklist and log gaps in `docs/limitations.md`.
