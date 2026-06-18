# Browser Compatibility

_Last updated: 2026-06-17_

> **0.2.0:** Curve crypto now uses native WebCrypto `X25519` + `Ed25519` (no asm.js fallback), which raises the minimum browser/engine versions. The version floors below reflect native `Ed25519` signing support — the newest of the two curve requirements. On the server, **Node >= 20** is required (standard `globalThis.crypto`).

## Browser Support Matrix

Minimum versions reflect native WebCrypto `X25519` (Chrome/Edge 133+, Firefox 130+, Safari 17+) and `Ed25519` (Chrome 137+, Firefox 129+, Safari 17+) support.

| Browser | Version | Status | Automation | Notes |
| ------- | ------- | ------ | ---------- | ----- |
| Chrome  | 137+    | ✅ Verified | Playwright | Native X25519/Ed25519 WebCrypto; Service Workers and IndexedDB tested. |
| Firefox | 130+    | ✅ Verified | Playwright | Core library verified; ES module Service Workers not supported (see below). |
| Safari  | 17+     | ⚠️ CI only | Playwright (WebKit) | Requires system dependencies; tested in GitHub Actions CI. |
| Edge    | 137+    | ✅ Expected | — | Chromium-based; matches Chrome behaviour. |
| iOS Safari | 17+  | ⚠️ Manual | — | WebCrypto curves available; background execution limited. |
| Android Chrome | 137+ | ⚠️ Manual | — | Expected to match Chrome; verify on target devices. |

## Automated Testing

The library is automatically tested in CI using Playwright against:

- **Chromium** - Full test suite including PWA/Service Worker demo
- **Firefox** - Core library tests (key generation, encryption/decryption)
- **WebKit** - Core library tests (requires CI environment with GTK4 dependencies)

### Running Tests Locally

```bash
# Install browsers (one-time setup)
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium firefox

# Install system dependencies for Firefox (Linux/WSL)
sudo npx playwright install-deps firefox

# Run tests
yarn test:e2e                           # All browsers
yarn test:e2e --project=chromium        # Chromium only
yarn test:e2e --project=firefox         # Firefox only
```

### WebKit/Safari Dependencies

WebKit requires additional system libraries (GTK4, GStreamer, etc.) that may not be available on all systems. On Ubuntu/Debian:

```bash
sudo npx playwright install-deps webkit
```

## Browser-Specific Notes

### Firefox Limitations

Firefox does not support ES module Service Workers (`{ type: 'module' }`). The PWA demo uses module syntax for the Service Worker, which works in Chrome, Edge, and Safari but not Firefox.

**Impact**: Firefox can use the Signal Protocol library directly in the main thread or in classic (non-module) workers. The core cryptographic functionality works correctly.

**Workaround**: For Firefox PWA support, bundle the Service Worker using a build tool like Vite, Webpack, or esbuild to produce a classic script without ES module imports.

### Safari/WebKit Notes

- WebCrypto AES-CBC is fully supported in Safari 14+; native `X25519`/`Ed25519` require Safari 17+
- Ensure COOP/COEP headers for `SharedArrayBuffer` if using multi-threaded workers
- Safari 14+ supports ES module Service Workers

## WebCrypto Requirements

The library relies on the following WebCrypto APIs:

- `SubtleCrypto.digest` (SHA-256)
- `SubtleCrypto.encrypt` / `decrypt` (AES-CBC)
- `SubtleCrypto.sign` / `verify` (HMAC-SHA256)
- `SubtleCrypto.deriveBits` / `generateKey` (`X25519` key agreement)
- `SubtleCrypto.sign` / `verify` (`Ed25519` signatures)
- `crypto.getRandomValues`

A native WebCrypto implementation is **required** as of 0.2.0 — there is no asm.js fallback. Use a modern browser (see the matrix above) or **Node >= 20**.

### Environment Guidance

- **Native curves required**: Engines without `X25519`/`Ed25519` in `SubtleCrypto` are unsupported. There is no `msrcrypto`/asm.js fallback to load.
- **Node.js**: Use **Node >= 20**, where `globalThis.crypto` is standard.
- **Service Workers**: Ensure `self.crypto` is available and exposes the curve algorithms; older WebViews that omit them are unsupported.
- **Custom `SubtleCrypto`**: Inject an alternative implementation with `setWebCryptoSubtle(subtle)` (or `setWebCrypto(cryptoLike)` for the whole Crypto object) if you need to supply a polyfill that implements `X25519`/`Ed25519`.

## Progressive Web Apps

- **COOP/COEP**: Configure headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) to enable `SharedArrayBuffer` when needed.
- **Storage**: Use IndexedDB for session stores. LocalStorage is insufficient for binary key material.
- **Background Sync**: Use the IndexedDB adapter from `examples/storage-adapters/indexeddb-adapter.ts` to safely manage ratchet state during background operations.

## Test Coverage by Browser

| Test | Chrome | Firefox | Safari |
| ---- | ------ | ------- | ------ |
| Key generation (identity, pre-key, signed pre-key) | ✅ | ✅ | ✅ |
| Registration ID generation | ✅ | ✅ | ✅ |
| Session establishment (X3DH) | ✅ | ✅ | ✅ |
| Message encryption/decryption (Double Ratchet) | ✅ | ✅ | ✅ |
| PWA Service Worker demo | ✅ | ❌* | ✅ |
| IndexedDB storage adapter | ✅ | ✅ | ✅ |

*Firefox doesn't support ES module Service Workers
