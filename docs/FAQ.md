# Frequently Asked Questions

Common questions about `@lukium/libsignal-protocol-typescript`.

## General Questions

### Why not use @signalapp/libsignal-client?

The official Signal library (`@signalapp/libsignal-client`) is:
- Written in Rust with Node.js bindings
- **Node.js only** - it does not support browsers or PWAs
- Requires native compilation (N-API)

This library fills the critical gap by providing a **pure TypeScript/JavaScript** implementation that works in:
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Progressive Web Apps (PWAs)
- Web Workers and Service Workers
- Any JavaScript runtime with WebCrypto support

### How does this compare to the official library?

| Feature | This Library | @signalapp/libsignal-client |
|---------|--------------|----------------------------|
| Platform | Browser + Node.js | Node.js only |
| Language | TypeScript | Rust + TS bindings |
| X3DH | Yes | Yes |
| Double Ratchet | Yes | Yes |
| PQXDH (Post-Quantum) | No | Yes |
| Group Messaging | No | Yes |
| Sealed Sender | No | Yes |
| Bundle Size | ~104 KB gzipped | N/A (native) |

For browser applications, this library is your only option. For Node.js servers requiring post-quantum or group messaging, consider the official library.

### Is this production-ready?

Yes, with caveats:

**Production-ready features:**
- X3DH key agreement protocol
- Double Ratchet message encryption
- 97%+ test coverage
- Verified against official Signal test vectors
- Used in production PWA applications

**Not yet implemented:**
- PQXDH (post-quantum key exchange)
- Group messaging (Sender Keys)
- Sealed sender metadata protection

### What about post-quantum support?

Signal added PQXDH (Post-Quantum Extended Diffie-Hellman) in 2024, which combines:
- ML-KEM-1024 (FIPS-203, formerly Kyber)
- Traditional X3DH for hybrid security

**Current status:** Not implemented. Deferred to v2.0.0 because:
1. No mature JavaScript/TypeScript ML-KEM implementations exist
2. Requires significant protocol changes
3. Browser WebCrypto doesn't support ML-KEM yet

We're monitoring the ecosystem and will add PQXDH when viable implementations become available.

### How do I report security issues?

**Do not** open public GitHub issues for security vulnerabilities.

Instead:
1. Email the maintainers directly (see package.json for contact)
2. Include detailed reproduction steps
3. Allow reasonable time for a fix before public disclosure

We follow responsible disclosure practices and will credit reporters.

## Technical Questions

### What browsers are supported?

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | Fully supported |
| Firefox | 90+ | Supported (no ES module Service Workers) |
| Safari | 15+ | Supported |
| Edge | 90+ | Fully supported (Chromium-based) |

**Requirements:**
- HTTPS (WebCrypto requires secure context)
- WebCrypto API (`crypto.subtle`)
- IndexedDB (for persistent storage)

### Why is WebCrypto required?

WebCrypto provides:
- Hardware-accelerated AES-CBC encryption
- Secure HMAC-SHA256 for message authentication
- Cryptographically secure random number generation

Using native browser crypto is faster and more secure than JavaScript implementations.

### How do I persist sessions across page reloads?

Use an IndexedDB-backed store instead of the in-memory store:

```typescript
import { createIndexedDBSignalProtocolStore } from './your-indexeddb-adapter';

const store = await createIndexedDBSignalProtocolStore({
  dbName: 'my-app-signal-store'
});
```

See [PWA Guide](./pwa-guide.md) for a complete implementation.

### Why are my messages failing to decrypt?

Common causes:

1. **Session not established** - Call `SessionBuilder.processPreKey()` before encrypting
2. **Wrong message type** - Use `decryptPreKeyWhisperMessage()` for type 3, `decryptWhisperMessage()` for type 1
3. **Session out of sync** - Re-establish the session if keys were reset
4. **Message replay** - Each message can only be decrypted once

See [Troubleshooting Guide](./troubleshooting.md) for detailed solutions.

### How do I handle identity key changes?

Implement `isTrustedIdentity` in your storage adapter:

```typescript
async isTrustedIdentity(identifier, identityKey, direction) {
  const stored = await this.loadIdentity(identifier);
  if (!stored) {
    // First contact - trust by default (TOFU)
    return true;
  }
  if (!arrayBufferEquals(stored, identityKey)) {
    // Key changed! Alert the user or reject
    return false; // Reject by default
  }
  return true;
}
```

Key changes can indicate:
- User reinstalled the app
- User got a new device
- Potential man-in-the-middle attack

Always prompt users to verify out-of-band when keys change.

### What's the bundle size?

Current size: **~104 KB gzipped**

Breakdown:
- Curve25519 (asm.js): ~40-50 KB
- protobufjs/light: ~16 KB
- Library code: ~30 KB
- IndexedDB adapter: ~8 KB

To reduce size:
- Use tree-shaking in your bundler
- Import only needed modules via subpath exports
- Consider lazy-loading the library

### Can I use this with React/Vue/Angular?

Yes! See the framework integration examples:

- **React**: `examples/react-integration/` - Context provider + hooks
- **Vue 3**: `examples/vue-integration/` - Composables with provide/inject

The library is framework-agnostic and works with any JavaScript framework.

## Protocol Questions

### What is X3DH?

X3DH (Extended Triple Diffie-Hellman) is Signal's key agreement protocol for establishing shared secrets between two parties. It provides:

- **Forward secrecy** - Past messages stay secure if keys are compromised
- **Deniability** - Neither party can prove the other participated
- **Asynchronous** - Works even if one party is offline

### What is the Double Ratchet?

The Double Ratchet algorithm provides ongoing encryption for message streams. It combines:

- **Diffie-Hellman ratchet** - New keys for each message exchange
- **Symmetric ratchet** - Chain keys for consecutive messages

Benefits:
- Forward secrecy per message
- Break-in recovery (future messages secure after compromise)
- Out-of-order message handling

### What are PreKeys?

PreKeys allow asynchronous session establishment:

1. **Identity Key** - Long-term public key identifying the user
2. **Signed PreKey** - Medium-term key signed by identity key
3. **One-Time PreKeys** - Single-use keys for additional security

When Alice wants to message Bob:
1. Alice fetches Bob's PreKey bundle from the server
2. Alice uses X3DH to derive a shared secret
3. Alice can send encrypted messages immediately
4. Bob processes the PreKey message to complete the session

### How many PreKeys should I generate?

Recommendations:
- **Signed PreKey**: 1, rotate monthly
- **One-Time PreKeys**: 100+, replenish when low

One-time PreKeys provide additional forward secrecy but are consumed per session. Monitor your server's PreKey count and upload more when running low.

## Performance Questions

### How fast is encryption/decryption?

Benchmark results (Node.js, 20 iterations):

| Operation | Average Time |
|-----------|-------------|
| Generate Identity Key | 4.41 ms |
| Session Establishment | 22.42 ms |
| Encrypt Message | 0.90 ms |
| Decrypt Message | 19.40 ms |

Browser performance varies but is generally within the same order of magnitude.

### Is there a memory leak?

No significant leaks detected. Memory profiling shows:
- ~7.7 KB growth per encrypt/decrypt cycle
- Linear growth (expected session state accumulation)
- No exponential leak patterns

Run `yarn benchmark:memory` to verify on your system.

### Why is decryption slower than encryption?

Decryption involves additional operations:
1. Session lookup from storage
2. Chain key advancement
3. Ratchet state updates
4. Message key derivation

Encryption uses cached sending chain state, making it faster.

## Troubleshooting

### "WebCrypto not available"

**Cause:** Running in an insecure context.

**Solutions:**
1. Use HTTPS (required for WebCrypto)
2. `localhost` is treated as secure for development
3. Check browser compatibility

### "No session found for device"

**Cause:** Trying to encrypt without establishing a session.

**Solution:**
```typescript
const hasSession = await cipher.hasOpenSession();
if (!hasSession) {
  const bundle = await fetchPreKeyBundle(address);
  await builder.processPreKey(bundle);
}
```

### "Identity key changed"

**Cause:** The peer's identity key doesn't match stored key.

**Solutions:**
1. Implement proper trust verification UI
2. Allow users to accept new keys after verification
3. Consider this a security event and log it

See [Troubleshooting Guide](./troubleshooting.md) for more issues.

---

**Still have questions?** Open an issue on [GitHub](https://github.com/Lukium/libsignal-protocol-typescript/issues).
