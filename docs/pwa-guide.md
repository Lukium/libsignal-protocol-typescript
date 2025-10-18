# PWA Integration Guide

_Last updated: 2025-10-17_

This guide explains how to embed `@privacyresearch/libsignal-protocol-typescript` in a Progressive Web App (PWA) with IndexedDB-backed storage and Service Worker support.

## 1. Application Architecture

- **Main thread**: Handles UI, message composition, and initiates session operations.
- **Service Worker**: Receives push notifications, syncs prekeys, and performs background decrypt/encrypt tasks.
- **IndexedDB**: Persists identity keys, sessions, and pending messages across offline periods.

## 2. Storage Recommendations

- Create an `IndexedDB` object store per logical data type (`identities`, `sessions`, `preKeys`, `signedPreKeys`, `senderKeys`).
- Implement `SignalProtocolStore` using async IndexedDB calls. Ensure methods such as `saveIdentity` return `Promise<boolean>` and de-duplicate keys by address/device ID.
- Use `crypto.getRandomValues` for UUIDs and key IDs; avoid `Math.random`.

### Example Structure

```
indexeddb/
├── schema.ts          # Database versioning & object stores
├── signal-store.ts    # Implements SignalProtocolStore
└── migrations.ts      # Handles schema upgrades
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

- Implement reusable IndexedDB adapter under `examples/storage-adapters/` (Phase 2).
- Add push notification walkthrough with real device registration IDs.
- Expand automated browser tests to validate worker + IndexedDB interactions.

Track progress against the Phase 1/2 checklist and log gaps in `docs/limitations.md`.
