# Storage Adapter Examples

This directory contains reusable storage adapters implementing `SignalProtocolStore`.

## IndexedDB Adapter

- File: `indexeddb-adapter.ts`
- Factory: `createIndexedDBSignalProtocolStore(options?)`
  - Returns a store compatible with the core library plus convenience helpers (`setIdentityKeyPair`, `setLocalRegistrationId`, `clear`, `close`)
- Tests: `src/__test__/indexeddb-adapter.test.ts` (uses `fake-indexeddb`)

### Usage

```ts
import { createIndexedDBSignalProtocolStore } from './examples/storage-adapters/indexeddb-adapter';

const store = await createIndexedDBSignalProtocolStore({ dbName: 'my-app', version: 1 });
await store.setIdentityKeyPair(identityKeyPair);
await store.setLocalRegistrationId(registrationId);
```

## Planned Adapters

- `memory-adapter.ts`: Simple in-memory mock for testing (Phase 3).
- `kv-adapter.ts`: Template for server-side KV stores (Redis, Cloudflare KV, etc.).
