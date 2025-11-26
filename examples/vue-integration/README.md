# Vue Integration Example

This example demonstrates how to integrate `@lukium/libsignal-protocol-typescript` with a Vue 3 application using the Composition API.

## Features

- `useSignalProtocol` composable for session management
- `provideSignalProtocol` / `injectSignalProtocol` for dependency injection
- Type-safe Vue components for secure messaging

## Installation

```bash
npm install @lukium/libsignal-protocol-typescript
# or
yarn add @lukium/libsignal-protocol-typescript
```

## Quick Start

### 1. Provide Signal Protocol in your App

```vue
<!-- App.vue -->
<script setup lang="ts">
import { provideSignalProtocol } from './composables/useSignalProtocol';

// Initialize Signal Protocol at the app root
provideSignalProtocol();
</script>

<template>
  <SecureChat />
</template>
```

### 2. Use the Composable

```vue
<script setup lang="ts">
import { injectSignalProtocol } from './composables/useSignalProtocol';

const { isInitialized, encrypt, decrypt, establishSession } = injectSignalProtocol();

async function sendMessage(text: string) {
  if (!isInitialized.value) return;

  const ciphertext = await encrypt('recipient:1', text);
  // Send ciphertext to server
}
</script>
```

## API Reference

### `provideSignalProtocol(options?)`

Initializes and provides Signal Protocol state to child components.

**Options:**
```typescript
{
  storageAdapter?: StorageType;  // Custom storage adapter
}
```

### `injectSignalProtocol()`

Injects Signal Protocol state and methods from a parent provider.

**Returns:**
```typescript
{
  // Reactive state
  isInitialized: Ref<boolean>;
  identityKey: Ref<ArrayBuffer | null>;
  registrationId: Ref<number | null>;

  // Methods
  establishSession: (address: string, preKeyBundle: DeviceType) => Promise<void>;
  hasSession: (address: string) => Promise<boolean>;
  closeSession: (address: string) => Promise<void>;
  encrypt: (address: string, plaintext: string) => Promise<MessageType>;
  decrypt: (address: string, ciphertext: MessageType) => Promise<string>;
  generatePreKeys: (start: number, count: number) => Promise<PreKeyType[]>;
  generateSignedPreKey: (keyId: number) => Promise<SignedPreKeyType>;
  getPreKeyBundle: () => Promise<DeviceType>;
}
```

## Storage

By default, the composable uses an in-memory store. For production, use IndexedDB:

```typescript
import { createIndexedDBSignalProtocolStore } from '@example/indexeddb-adapter';

// In your App.vue setup
const store = await createIndexedDBSignalProtocolStore({ dbName: 'my-app' });
provideSignalProtocol({ storageAdapter: store });
```

## Example: Complete Chat Component

See `src/SecureChat.vue` for a complete example of a secure messaging component.

## Notes

- All composable methods return Promises
- State is reactive using Vue's `ref()` and `computed()`
- The provider must be called in a parent component before using `injectSignalProtocol()`
