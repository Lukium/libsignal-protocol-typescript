# React Integration Example

This example demonstrates how to integrate `@lukium/libsignal-protocol-typescript` with a React application.

## Features

- `useSignalProtocol` hook for session management
- `SignalProtocolProvider` context for key storage
- Type-safe React components for secure messaging

## Installation

```bash
npm install @lukium/libsignal-protocol-typescript
# or
yarn add @lukium/libsignal-protocol-typescript
```

## Quick Start

### 1. Set up the Provider

Wrap your app with `SignalProtocolProvider`:

```tsx
import { SignalProtocolProvider } from './signal-protocol';

function App() {
    return (
        <SignalProtocolProvider>
            <SecureChat />
        </SignalProtocolProvider>
    );
}
```

### 2. Use the Hook

Access Signal Protocol functionality via the `useSignalProtocol` hook:

```tsx
import { useSignalProtocol } from './signal-protocol';

function SecureChat() {
    const { isInitialized, encrypt, decrypt, establishSession } = useSignalProtocol();

    if (!isInitialized) {
        return <div>Initializing encryption...</div>;
    }

    const handleSend = async (message: string) => {
        const ciphertext = await encrypt('recipient:1', message);
        // Send ciphertext to server
    };

    return <ChatUI onSend={handleSend} />;
}
```

## API Reference

### `SignalProtocolProvider`

Context provider that initializes and manages Signal Protocol state.

**Props:**
- `children`: React children
- `storageAdapter?`: Optional custom storage adapter (defaults to IndexedDB)
- `dbName?`: IndexedDB database name (default: `'signal-protocol'`)

### `useSignalProtocol()`

Hook that provides access to Signal Protocol operations.

**Returns:**
```typescript
{
    isInitialized: boolean;
    identityKey: ArrayBuffer | null;
    registrationId: number | null;

    // Session management
    establishSession: (address: string, preKeyBundle: DeviceType) => Promise<void>;
    hasSession: (address: string) => Promise<boolean>;
    closeSession: (address: string) => Promise<void>;

    // Encryption/decryption
    encrypt: (address: string, plaintext: string) => Promise<MessageType>;
    decrypt: (address: string, ciphertext: MessageType) => Promise<string>;

    // Key generation
    generatePreKeys: (start: number, count: number) => Promise<PreKeyType[]>;
    generateSignedPreKey: (keyId: number) => Promise<SignedPreKeyType>;
    getPreKeyBundle: () => Promise<DeviceType>;
}
```

## Storage

By default, the provider uses IndexedDB for persistent storage. You can provide a custom storage adapter:

```tsx
import { SignalProtocolProvider, createMemoryStore } from './signal-protocol';

// Use in-memory storage (for testing)
<SignalProtocolProvider storageAdapter={createMemoryStore()}>
    <App />
</SignalProtocolProvider>
```

## Example: Complete Chat Component

See `src/SecureChat.tsx` for a complete example of a secure messaging component.

## Notes

- All cryptographic operations are asynchronous
- Session state is persisted in IndexedDB by default
- The provider handles identity key generation automatically on first load
- Pre-keys should be regenerated periodically and uploaded to your key server
