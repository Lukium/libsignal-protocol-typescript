# Troubleshooting Guide

Common issues and solutions when using `@lukium/libsignal-protocol-typescript`.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [Browser Compatibility](#browser-compatibility)
- [Session Management](#session-management)
- [Storage Issues](#storage-issues)
- [Performance Issues](#performance-issues)

---

## Installation Issues

### "Module not found" errors

**Problem:** Your bundler can't resolve the package.

**Solutions:**

1. **Check installation:**
   ```bash
   npm list @lukium/libsignal-protocol-typescript
   # or
   yarn why @lukium/libsignal-protocol-typescript
   ```

2. **Clear cache and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check your bundler's module resolution:**
   - For Vite, ensure `resolve.alias` is configured if using subpath imports
   - For Webpack 5, you may need to add polyfills for Node.js built-ins

### TypeScript errors with imports

**Problem:** TypeScript can't find type definitions.

**Solution:** The package includes TypeScript declarations. Ensure your `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler", // or "node16"
    "esModuleInterop": true
  }
}
```

---

## Runtime Errors

### "WebCrypto not available"

**Problem:** The browser doesn't have `crypto.subtle` available.

**Causes:**
- Running on HTTP (not HTTPS)
- Running in an older browser
- Running in a sandboxed iframe

**Solutions:**

1. **Use HTTPS** - WebCrypto requires a secure context
2. **Check browser support** - See [browser compatibility](./browser-compatibility.md)
3. **For local development**, `localhost` is treated as secure

### "Identity key not initialized"

**Problem:** Trying to perform operations before initialization.

**Solution:** Always wait for initialization to complete:

```typescript
// React
const { isInitialized, encrypt } = useSignalProtocol();
if (!isInitialized) return <Loading />;

// Plain JavaScript
const store = await createStore();
await store.setIdentityKeyPair(await KeyHelper.generateIdentityKeyPair());
// Now safe to use
```

### "No session found for device"

**Problem:** Trying to encrypt/decrypt without an established session.

**Causes:**
- Session was never established
- Session was deleted or corrupted
- Wrong address used

**Solutions:**

1. **Check if session exists:**
   ```typescript
   const cipher = new SessionCipher(store, address);
   const hasSession = await cipher.hasOpenSession();
   if (!hasSession) {
     // Establish session first
     await builder.processPreKey(preKeyBundle);
   }
   ```

2. **Verify address format:**
   ```typescript
   // Correct format: "name:deviceId"
   const address = new SignalProtocolAddress('user123', 1);
   // or
   const address = SignalProtocolAddress.fromString('user123:1');
   ```

### "Identity key changed"

**Problem:** The peer's identity key doesn't match the stored one.

**Cause:** The peer reinstalled the app or their keys were compromised.

**Solution:** Implement trust-on-first-use (TOFU) verification:

```typescript
const store = {
  isTrustedIdentity(identifier, identityKey, direction) {
    const storedKey = await this.loadIdentity(identifier);
    if (!storedKey) {
      // First contact - trust by default
      return true;
    }
    if (!arrayBufferEquals(storedKey, identityKey)) {
      // Key changed! Alert the user
      console.warn('Identity key changed for', identifier);
      // Option 1: Reject (most secure)
      return false;
      // Option 2: Accept after user confirmation
      // return await promptUserForVerification(identifier);
    }
    return true;
  }
};
```

### "Message key not found"

**Problem:** Decryption fails with "Message key not found" error.

**Causes:**
- Message was already decrypted (replay attempt)
- Messages received out of order (more than 2000 ahead)
- Session state corrupted

**Solution:**
- Messages can only be decrypted once
- If messages arrive out of order, they're still decryptable within limits
- For extreme out-of-order scenarios, re-establish the session

---

## Browser Compatibility

### Firefox Service Worker issues

**Problem:** Service Worker fails with "threw an exception during script evaluation."

**Cause:** Firefox doesn't support ES module Service Workers (`type: 'module'`).

**Solution:** Bundle the Service Worker into a classic script:

```typescript
// vite.config.ts
export default {
  worker: {
    format: 'iife', // Use classic format for Firefox
  },
};
```

Or use a separate build step to bundle the worker.

### Safari IndexedDB quota

**Problem:** Storage operations fail in Safari.

**Cause:** Safari has strict storage limits in private browsing.

**Solution:**
```typescript
try {
  await store.storeSession(address, session);
} catch (err) {
  if (err.name === 'QuotaExceededError') {
    // Handle storage limit
    console.error('Storage quota exceeded');
  }
}
```

### "crypto.getRandomValues" not available

**Problem:** Random number generation fails.

**Cause:** Very old browser or non-secure context.

**Solution:** Ensure you're on HTTPS or use a polyfill (not recommended for production).

---

## Session Management

### Sessions not persisting across page reloads

**Problem:** Sessions disappear when the page refreshes.

**Cause:** Using in-memory store instead of IndexedDB.

**Solution:** Use the IndexedDB adapter:
```typescript
import { createIndexedDBSignalProtocolStore } from '@example/indexeddb-adapter';

const store = await createIndexedDBSignalProtocolStore({
  dbName: 'my-app-signal-store'
});
```

### Multiple devices not syncing

**Problem:** Messages sent to one device can't be decrypted on another.

**Cause:** Each device has its own session and keys.

**Solution:** Signal Protocol is designed this way. Each device-to-device pair has a unique session. To support multi-device:

1. Register each device with a unique device ID
2. Send messages to all active devices
3. Sync session state via your server (encrypted)

### Pre-key exhaustion

**Problem:** Running out of pre-keys.

**Solution:** Regularly generate and upload new pre-keys:

```typescript
async function replenishPreKeys(store, serverApi) {
  const COUNT = 100;
  const START = await store.getNextPreKeyId();

  const preKeys = [];
  for (let i = 0; i < COUNT; i++) {
    const preKey = await KeyHelper.generatePreKey(START + i);
    await store.storePreKey(preKey.keyId, preKey.keyPair);
    preKeys.push({
      keyId: preKey.keyId,
      publicKey: preKey.keyPair.pubKey,
    });
  }

  await serverApi.uploadPreKeys(preKeys);
}
```

---

## Storage Issues

### IndexedDB "blocked" error

**Problem:** IndexedDB operations hang or throw "blocked" errors.

**Cause:** Another tab has the database open with a different version.

**Solution:** Handle version changes:
```typescript
const request = indexedDB.open('signal-store', version);
request.onblocked = () => {
  alert('Please close other tabs with this app');
};
```

### Data migration between versions

**Problem:** Upgrading causes data loss.

**Solution:** Implement proper IndexedDB migrations:
```typescript
request.onupgradeneeded = (event) => {
  const db = request.result;
  const oldVersion = event.oldVersion;

  if (oldVersion < 1) {
    db.createObjectStore('sessions');
    db.createObjectStore('identityKeys');
    db.createObjectStore('preKeys');
  }
  if (oldVersion < 2) {
    // Add new store or modify existing
    db.createObjectStore('signedPreKeys');
  }
};
```

---

## Performance Issues

### Slow initial load

**Problem:** First message takes a long time to send.

**Cause:** Curve25519 initialization is slow.

**Solution:** Initialize early in your app lifecycle:
```typescript
// Do this at app startup, not when user sends first message
import { KeyHelper } from '@lukium/libsignal-protocol-typescript';
await KeyHelper.generateIdentityKeyPair(); // Warms up the curve library
```

### Memory usage growing over time

**Problem:** Memory increases with each message.

**Causes:**
- Session chains accumulating old keys
- Leaking references to ArrayBuffers

**Solution:**
- The library manages chain cleanup automatically
- Ensure you're not holding references to decrypted plaintext

### Large bundle size

**Problem:** The library adds significant size to your bundle.

**Current size:** ~104 KB gzipped

**Tips to reduce:**
1. Use subpath imports:
   ```typescript
   // Instead of importing everything
   import { KeyHelper, SessionCipher } from '@lukium/libsignal-protocol-typescript';

   // Import only what you need
   import { KeyHelper } from '@lukium/libsignal-protocol-typescript/key-helper';
   import { SessionCipher } from '@lukium/libsignal-protocol-typescript/session-cipher';
   ```

2. Enable tree-shaking in your bundler

---

## Still stuck?

If you're experiencing an issue not covered here:

1. Check [GitHub Issues](https://github.com/anthropics/libsignal-protocol-typescript/issues) for similar problems
2. Search the [Signal Protocol documentation](https://signal.org/docs/)
3. Open a new issue with:
   - Browser and version
   - Code snippet reproducing the issue
   - Full error message and stack trace
