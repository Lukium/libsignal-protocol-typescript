# Examples

_Last updated: 2025-10-17_

This directory will contain runnable samples that demonstrate how to integrate the library in common scenarios.

## Layout

```
examples/
├── basic-messaging/
│   ├── index.ts        # End-to-end send/receive example (exported `demo` helper)
│   └── README.md
├── pwa-integration/
│   ├── index.html      # TODO: Minimal PWA bootstrap
│   ├── service-worker.ts
│   └── README.md
└── storage-adapters/
    ├── indexeddb-adapter.ts  # IndexedDB implementation of SignalProtocolStore
    └── README.md
```

Each subdirectory includes a README with setup notes. Invoke examples with `ts-node` or by importing the exported helpers in your own scripts. Additional scripts/tests will be added during Phase 2.
