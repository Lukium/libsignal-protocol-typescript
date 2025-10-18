# PWA Integration Guide

_Last updated: 2025-10-17_

This guide explains how to embed `@lukium/libsignal-protocol-typescript` in a Progressive Web App (PWA) with IndexedDB-backed storage and Service Worker support.

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

examples/pwa-vite/
├── src/main.ts             # Main thread wiring (Vite demo)
├── src/sw.ts               # Service Worker with pre-key handling
└── vite.config.ts          # ES module worker + msrcrypto shim configuration
```

## 3. Service Worker Integration

- Register the Service Worker with `navigator.serviceWorker.register('/sw.js', { type: 'module' })` during app bootstrap.
- Use ES module workers so you can `import` from the package without falling back to `importScripts`.
- Listen for `push` events to fetch incoming encrypted messages. Decrypt using the same IndexedDB store (accessible via `self.indexedDB`).
- Post decrypted payloads back to the client via `clients.matchAll()` and `client.postMessage`.
- When the browser provides `globalThis.crypto` (all evergreen browsers do), the library no longer pulls in the legacy `msrcrypto` fallback. If you intentionally bundle the fallback, keep it behind a feature flag so worker builds stay lean.

### 3.1 Vite-first worker setup

The quickest way to validate Service Worker compatibility is to wire an ES module worker in Vite. The snippet below targets Vite 5+ and keeps the legacy `msrcrypto` shim out of the worker bundle.

```ts
// sw.ts
import { SessionBuilder, SessionCipher, SignalProtocolAddress } from '@lukium/libsignal-protocol-typescript';
import { createIndexedDBSignalProtocolStore } from '@lukium/libsignal-protocol-typescript/examples/storage-adapters/indexeddb-adapter';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', async (event) => {
    event.waitUntil(
        (async () => {
            const store = await createIndexedDBSignalProtocolStore({ dbName: 'libsignal-worker' });
            const address = new SignalProtocolAddress('alice', 1);
            const cipher = new SessionCipher(store, address);
            const payload = event.data?.arrayBuffer();
            if (!payload) return;
            const plaintext = await cipher.decryptWhisperMessage(await payload, 'binary');
            const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            clients.forEach((client) => client.postMessage({ type: 'signal:message', payload: plaintext }));
            store.close();
        })()
    );
});
```

Example push payload (JSON):

```json
{
  "ciphertext": "BASE64_ENCRYPTED_BYTES",
  "timestamp": 1739898720,
  "sender": "alice.1"
}
```

When a push arrives, fetch the ciphertext with `event.data?.arrayBuffer()`, decrypt via `SessionCipher.decryptWhisperMessage`, and post the plaintext to all clients.

Field reference:

- `ciphertext`: Base64 payload emitted by your messaging backend. Convert to an `ArrayBuffer` before calling `SessionCipher` helpers.
- `timestamp`: Unix epoch seconds used for ordering or duplicate detection.
- `sender`: `<name>.<deviceId>` string that maps back to a `SignalProtocolAddress` (this becomes the key when storing sessions).

If your backend wraps data differently (e.g., includes an envelope or metadata signature), normalise the shape before handing the payload to the worker so the decryption flow remains consistent.

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
    worker: {
        format: 'es',
        rollupOptions: {
            // The library now hydrates `globalThis.crypto` first, so we can skip bundling msrcrypto in workers.
            external: ['@lukium/libsignal-protocol-typescript/lib/msrcrypto.js'],
        },
    },
    resolve: {
        alias: {
            // Optional: provide an explicit shim if a dependency tries to import the fallback module.
            '@lukium/libsignal-protocol-typescript/lib/msrcrypto.js': '/src/shims/msrcrypto-empty.ts',
        },
    },
});
```

```ts
// src/shims/msrcrypto-empty.ts
const missing = () => {
    throw new Error('msrcrypto fallback requested. Ensure globalThis.crypto is available before using libsignal.');
};

export default {
    subtle: {
        digest: missing,
    },
    getRandomValues: missing,
    randomUUID: missing,
};
```

Use `navigator.serviceWorker.register('/sw.js', { type: 'module' })` from the main thread and Vite will emit both the app bundle and the worker chunk. The library’s runtime now lazily falls back to `msrcrypto` only when `globalThis.crypto` is absent, so modern browsers avoid shipping the legacy asm.js payload. The alias above guarantees the worker build fails fast if the environment is missing WebCrypto support.

Launch the demo locally with `yarn example:pwa-vite` after running `yarn build`.

## 4. Offline Support

- Cache the library bundle and supporting assets using Workbox or manual `caches.open`.
- Queue outbound messages in IndexedDB when offline; flush once connectivity returns (see `examples/pwa-vite/src/main.ts` for a reference implementation).
- Use Background Sync (`sync` event) to retry failed uploads.

## 5. Bundle Size Considerations

- Import from the ESM build (`import { SessionBuilder } from '@lukium/libsignal-protocol-typescript'`) to leverage tree-shaking.
- Prefer subpath imports (e.g., `@lukium/libsignal-protocol-typescript/session-cipher`) to keep bundlers from pulling unused helpers.
- Exclude optional test utilities using bundler aliasing (`resolve.alias` in Vite/Webpack).
- Monitor bundle size; aim for <100 KB gzipped by deferring unused helpers (Phase 2 task).
- Use `yarn bundle:size` to rebuild the demo and report current gzipped totals.

## 6. Security Notes

- Set COOP/COEP headers to enable `SharedArrayBuffer` if required.
- Use HTTPS and enable content security policies that allow `worker-src 'self'`.
- Avoid storing long-term secrets in unprotected storage; wrap IndexedDB calls with at-rest encryption if the platform mandates it.

## 7. Next Steps

- Integrate the provided IndexedDB adapter and wire it into `examples/pwa-integration` (Phase 2 ongoing).
- Add push notification walkthrough with real device registration IDs.
- Expand automated browser tests to validate worker + IndexedDB interactions.
- Run `yarn test:e2e` (Playwright) to verify the Vite demo continues to negotiate sessions end-to-end.

Track progress against the Phase 1/2 checklist and log gaps in `docs/limitations.md`.

## 8. Migration Recipes

### Legacy in-memory store → IndexedDB adapter

1. Replace the existing custom store import with the shared adapter:

   ```ts
   import { createIndexedDBSignalProtocolStore } from '@lukium/libsignal-protocol-typescript/examples/storage-adapters/indexeddb-adapter';
   ```

2. During bootstrap, open the IndexedDB database and hydrate identity/registration data:

   ```ts
   const store = await createIndexedDBSignalProtocolStore({ dbName: 'my-app' });
   await store.setIdentityKeyPair(legacyStore.getIdentityKeyPairSync());
   await store.setLocalRegistrationId(legacyStore.getLocalRegistrationIdSync());
   ```

3. Move any pending sessions by serialising them through `SessionRecord.serialize()` (or reading from your legacy cache) and calling `store.storeSession(identifier, record)`.

4. Drop in legacy helper methods (e.g., `removeSession`, `removeAllSessions`) with the adapter’s async equivalents. The returned promises make it safe to compose operations inside workers.

5. Once migrated, delete the in-memory store to avoid drift and call `store.close()` on shutdown to release IndexedDB handles.

This flow keeps the public API (methods on `SignalProtocolStore`) identical, so higher-level session code rarely needs adjustments beyond awaiting the async versions of the persistence helpers.
