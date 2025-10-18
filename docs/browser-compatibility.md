# Browser Compatibility

_Last updated: 2025-10-17_

| Browser | Version | Status | Notes |
| ------- | ------- | ------ | ----- |
| Chrome  | 90+     | ✅ Supported | Full WebCrypto support; tested with Service Workers and IndexedDB. |
| Firefox | 88+     | ✅ Supported | Requires enabling `dom.webcrypto.enabled` (default since 88). |
| Safari  | 14+     | ⚠️ Testing needed | WebCrypto AES-CBC quirks; ensure COOP/COEP headers for `SharedArrayBuffer`. |
| Edge    | 90+     | ✅ Supported | Chromium-based; matches Chrome behaviour. |
| iOS Safari | 14+  | ⚠️ Partial | WebCrypto available, but background execution limited; verify key storage policies. |
| Android WebView | 100+ | ⚠️ Evaluate | Depends on WebView version packaged with OS; consider polyfills. |

## WebCrypto Requirements

The library relies on the following WebCrypto APIs:

- `SubtleCrypto.digest` (SHA-256)
- `SubtleCrypto.encrypt` / `decrypt` (AES-CBC, AES-CTR)
- `SubtleCrypto.sign` / `verify` (HMAC-SHA256)
- `crypto.getRandomValues`

### Polyfill Guidance

- **Safari ≤13**: AES-CBC is supported but buggy. Consider falling back to a WebAssembly AES implementation if targeting legacy Safari.
- **Node.js**: When `globalThis.crypto` is unavailable, the library loads `lib/msrcrypto.js` as a fallback. Browser consumers should avoid bundling this path.
- **Service Workers**: Ensure `self.crypto` is available; older Android WebViews may omit it.

## Progressive Web Apps

- **COOP/COEP**: Configure headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) to enable `SharedArrayBuffer` when needed.
- **Storage**: Prefer IndexedDB for session stores. LocalStorage is insufficient for binary key material.
- **Background Sync**: Use the upcoming IndexedDB session adapter (Phase 2) to safely manage ratchet state during background pushes.

Track ongoing compatibility testing in GitHub issues linked from the Phase 1 milestone.
