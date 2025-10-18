# Vite PWA Demo

This example packages a minimal Signal Protocol round-trip using Vite. The main thread bootstraps a session, asks the
Service Worker for a pre-key bundle, and then exchanges encrypted messages. The worker decrypts each payload, posts the
plaintext back to all connected clients, and showcases the IndexedDB-backed store that Phase 2 targets.

## Quickstart

```bash
yarn build            # ensure lib/esm is up to date
yarn dev:pwa-vite     # launches Vite (http://127.0.0.1:5173 by default)
```

When the app loads you should see the log update as soon as the Service Worker responds with its pre-key bundle. The
“Send Encrypted Message” button issues additional Double Ratchet messages; plaintext payloads are piped back to the UI
after the worker decrypts them.

## Build & Preview

```bash
yarn build            # refresh lib/esm before deriving production output
yarn preview:pwa-vite   # builds + serves the production bundle on port 5174
```

The Vite configuration demonstrates two key pieces needed for production PWAs:

- Service Worker chunks are emitted as ES modules (`worker.format = 'es'`).
- The legacy `lib/msrcrypto.js` shim is marked `external` so modern browsers avoid bundling the asm.js fallback.

## File Layout

```
examples/pwa-vite
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src
    ├── env.d.ts
    ├── main.ts        # main thread bootstrap + UI
    ├── shims/msrcrypto-empty.ts
    └── sw.ts          # Service Worker logic (pre-key bundle + decrypt loop)
```

The IndexedDB adapter is reused from `examples/storage-adapters/indexeddb-adapter.ts` via a path alias; review
`vite.config.ts` and `tsconfig.json` for details.

## Notes

- The worker persists keys/sessions to IndexedDB so reloads keep the negotiated state.
- Messages sent before the worker is active are queued; the example waits for `navigator.serviceWorker.ready` to avoid
  racy postMessage calls.
- Offline transitions are handled in the main thread—messages queued while offline are flushed automatically when
  connectivity and the session return.
- The shim in `src/shims/msrcrypto-empty.ts` guards against accidental fallback usage—if WebCrypto is missing, the
  worker fails loudly so the issue is caught during development.
- End-to-end verification runs under Playwright (`yarn test:e2e`), which loads this demo via `yarn preview:pwa-vite` and
  asserts that the Service Worker decrypts messages.
- The source intentionally imports submodules (e.g., `@lukium/libsignal-protocol-typescript/session-cipher`) so
  bundlers can tree-shake unused helpers—mirror this pattern in your own PWA builds to keep bundles small.
