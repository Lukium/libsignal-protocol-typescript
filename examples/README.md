# Examples

_Last updated: 2025-10-19_

This directory will contain runnable samples that demonstrate how to integrate the library in common scenarios.

## Layout

```
examples/
├── basic-messaging/
│   ├── index.ts        # End-to-end send/receive example (exported `demo` helper)
│   └── README.md
├── pwa-integration/
│   ├── index.html      # Minimal PWA bootstrap (planned refresh)
│   ├── service-worker.ts
│   └── README.md
├── pwa-vite/
│   ├── src/            # Full Vite demo with Service Worker + IndexedDB
│   ├── README.md
│   └── vite.config.ts
└── storage-adapters/
    ├── indexeddb-adapter.ts  # IndexedDB implementation of SignalProtocolStore
    └── README.md
```

Each subdirectory includes a README with setup notes. Invoke examples with `ts-node`, by importing helpers in your own scripts, or via package scripts:

```bash
yarn example:pwa-vite   # builds + runs the Vite demo with live reload
```

Additional scripts/tests will be added during Phase 2.
