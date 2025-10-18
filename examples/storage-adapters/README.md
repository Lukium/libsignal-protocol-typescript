# Storage Adapter Examples

_Status: TODO (Phase 2)_

This directory will collect reusable storage adapters implementing `SignalProtocolStore`. Planned adapters include:

- `indexeddb-adapter.ts`: IndexedDB implementation for browser/PWA usage.
- `memory-adapter.ts`: Simple in-memory mock for testing.
- `kv-adapter.ts`: Template for server-side KV stores (Redis, Cloudflare KV, etc.).

Contributions should:

- Export a factory function returning a store compatible with `src/types.ts`.
- Include Jest tests under `src/__test__` referencing shared fixtures.
- Document setup steps in this README once implementations are added.
