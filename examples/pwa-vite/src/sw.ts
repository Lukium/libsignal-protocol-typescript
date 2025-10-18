import {
    KeyHelper,
    SessionCipher,
    SignalProtocolAddress,
    type DeviceType,
    type MessageType,
} from '@privacyresearch/libsignal-protocol-typescript';
import { createIndexedDBSignalProtocolStore, type IndexedDBSignalProtocolStore } from '@example/indexeddb-adapter';

declare const self: ServiceWorkerGlobalScope;

const workerAddress = new SignalProtocolAddress('worker', 1);
const mainAddress = new SignalProtocolAddress('main', 1);

let storePromise: Promise<IndexedDBSignalProtocolStore> | undefined;
let sessionCipher: SessionCipher | undefined;
let nextPreKeyId = 5001;
let nextSignedPreKeyId = 7001;

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') {
        return;
    }
    switch (data.type) {
        case 'REQUEST_PREKEY_BUNDLE':
            event.waitUntil(handleRequestPreKeyBundle(event.source));
            break;
        case 'CIPHERTEXT':
            event.waitUntil(handleCiphertext(event.source, data.message as MessageType));
            break;
        default:
            break;
    }
});

async function ensureStore(): Promise<IndexedDBSignalProtocolStore> {
    if (!storePromise) {
        storePromise = (async () => {
            const store = await createIndexedDBSignalProtocolStore({ dbName: 'libsignal-vite-worker' });
            const identity = await store.getIdentityKeyPair();
            if (!identity) {
                await store.setIdentityKeyPair(await KeyHelper.generateIdentityKeyPair());
            }
            const registrationId = await store.getLocalRegistrationId();
            if (!registrationId) {
                await store.setLocalRegistrationId(KeyHelper.generateRegistrationId());
            }
            return store;
        })();
    }
    return storePromise;
}

async function handleRequestPreKeyBundle(source: Client | MessagePort | ServiceWorker | null): Promise<void> {
    const store = await ensureStore();
    const identity = await store.getIdentityKeyPair();
    const registrationId = await store.getLocalRegistrationId();
    if (!identity || !registrationId) {
        throw new Error('Worker identity not initialized');
    }

    const preKey = await KeyHelper.generatePreKey(nextPreKeyId++);
    const signedPreKey = await KeyHelper.generateSignedPreKey(identity, nextSignedPreKeyId++);
    await store.storePreKey(preKey.keyId, preKey.keyPair);
    await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

    const bundle: DeviceType = {
        identityKey: identity.pubKey,
        registrationId,
        preKey: {
            keyId: preKey.keyId,
            publicKey: preKey.keyPair.pubKey,
        },
        signedPreKey: {
            keyId: signedPreKey.keyId,
            publicKey: signedPreKey.keyPair.pubKey,
            signature: signedPreKey.signature,
        },
    };

    postToSource(source, {
        type: 'PREKEY_BUNDLE',
        address: workerAddress.toString(),
        bundle,
    });
}

async function handleCiphertext(
    source: Client | MessagePort | ServiceWorker | null,
    message: MessageType
): Promise<void> {
    try {
        if (!message?.body) {
            throw new Error('Missing ciphertext body');
        }
        const store = await ensureStore();
        if (!sessionCipher) {
            // First message is expected to be a pre-key bundle encrypted payload.
            sessionCipher = new SessionCipher(store, mainAddress);
        }

        let plaintext: ArrayBuffer;
        if (message.type === 3) {
            plaintext = await sessionCipher.decryptPreKeyWhisperMessage(message.body, 'binary');
        } else {
            plaintext = await sessionCipher.decryptWhisperMessage(message.body, 'binary');
        }

        const decoded = new TextDecoder().decode(new Uint8Array(plaintext));
        await broadcast({
            type: 'PLAINTEXT',
            payload: decoded,
        });
    } catch (err) {
        await broadcast({
            type: 'ERROR',
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

async function broadcast(message: Record<string, unknown>): Promise<void> {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
        client.postMessage(message);
    }
}

function postToSource(source: Client | MessagePort | ServiceWorker | null, message: Record<string, unknown>): void {
    if (!source) {
        return;
    }
    if ('postMessage' in source) {
        source.postMessage(message);
    }
}

export {};
