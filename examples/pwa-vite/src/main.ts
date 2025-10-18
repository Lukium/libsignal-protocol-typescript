import { KeyHelper } from '@lukium/libsignal-protocol-typescript/key-helper';
import { SessionBuilder } from '@lukium/libsignal-protocol-typescript/session-builder';
import { SessionCipher } from '@lukium/libsignal-protocol-typescript/session-cipher';
import { SignalProtocolAddress } from '@lukium/libsignal-protocol-typescript/signal-protocol-address';
import type { DeviceType } from '@lukium/libsignal-protocol-typescript/session-types';
import { createIndexedDBSignalProtocolStore } from '@example/indexeddb-adapter';

const logElement = document.querySelector<HTMLPreElement>('#log');
const sendButton = document.querySelector<HTMLButtonElement>('#send');

const logBuffer: string[] = [];

const encoder = new TextEncoder();

const remoteAddress = new SignalProtocolAddress('worker', 1);

let activeWorker: ServiceWorker | null = null;
let sessionCipher: SessionCipher | undefined;
const pendingPayloads: string[] = [];
let flushingQueue = false;

async function setup(): Promise<void> {
    if (!logElement || !sendButton) {
        throw new Error('Demo markup missing');
    }

    if (!('serviceWorker' in navigator)) {
        log('Service Workers are not supported in this browser.');
        return;
    }

    const store = await createIndexedDBSignalProtocolStore({ dbName: 'libsignal-vite-main' });
    await store.clear();
    await store.setIdentityKeyPair(await KeyHelper.generateIdentityKeyPair());
    await store.setLocalRegistrationId(KeyHelper.generateRegistrationId());

    window.addEventListener('beforeunload', () => store.close());

    navigator.serviceWorker.addEventListener('message', (event) => onWorkerMessage(event, store));

    log('Registering Service Worker...');
    await navigator.serviceWorker.register('/sw.js', { type: 'module' });
    activeWorker = await waitForActiveWorker();
    log('Service Worker active, requesting pre-key bundle…');

    activeWorker.postMessage({
        type: 'REQUEST_PREKEY_BUNDLE',
        address: remoteAddress.toString(),
    });

    window.addEventListener('online', () => {
        log('Connection restored – flushing queued messages.');
        void flushPendingMessages();
    });

    window.addEventListener('offline', () => {
        log('Offline detected. New messages will be queued until connectivity returns.');
    });

    sendButton.addEventListener('click', async () => {
        if (!sessionCipher || !activeWorker) {
            return;
        }
        const payload = `Hello from main @ ${new Date().toISOString()}`;
        await enqueueMessage(payload);
    });
}

function log(message: string): void {
    const line = `[${new Date().toISOString()}] ${message}`;
    logBuffer.unshift(line);
    if (logBuffer.length > 40) {
        logBuffer.length = 40;
    }
    if (logElement) {
        logElement.textContent = logBuffer.join('\n');
    }
}

async function waitForActiveWorker(): Promise<ServiceWorker> {
    const ready = await navigator.serviceWorker.ready;
    if (ready.active) {
        return ready.active;
    }
    if (navigator.serviceWorker.controller) {
        return navigator.serviceWorker.controller;
    }
    return new Promise<ServiceWorker>((resolve) => {
        const listener = () => {
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.removeEventListener('controllerchange', listener);
                resolve(navigator.serviceWorker.controller);
            }
        };
        navigator.serviceWorker.addEventListener('controllerchange', listener);
    });
}

async function onWorkerMessage(
    event: MessageEvent,
    store: Awaited<ReturnType<typeof createIndexedDBSignalProtocolStore>>
): Promise<void> {
    const data = event.data;
    if (!data || typeof data !== 'object') {
        return;
    }
    switch (data.type) {
        case 'PREKEY_BUNDLE':
            await handlePreKeyBundle(store, data.bundle as DeviceType);
            break;
        case 'PLAINTEXT':
            log(`Worker decrypted: ${data.payload}`);
            break;
        case 'ERROR':
            log(`Worker error: ${data.error}`);
            break;
        default:
            log(`Worker message: ${JSON.stringify(data)}`);
            break;
    }
}

async function handlePreKeyBundle(
    store: Awaited<ReturnType<typeof createIndexedDBSignalProtocolStore>>,
    bundle: DeviceType
): Promise<void> {
    log('Received pre-key bundle from worker, establishing session…');
    const builder = new SessionBuilder(store, remoteAddress);
    await builder.processPreKey(bundle);
    sessionCipher = new SessionCipher(store, remoteAddress);
    log('Session established. Click “Send Encrypted Message” to exchange Double Ratchet messages.');
    if (sendButton) {
        sendButton.disabled = false;
    }
    await flushPendingMessages();
}

setup().catch((err) => {
    console.error(err);
    log(`Fatal error: ${(err as Error).message}`);
});

async function enqueueMessage(payload: string): Promise<void> {
    pendingPayloads.push(payload);
    if (!navigator.onLine) {
        log('Offline – queued payload for delivery once connectivity returns.');
    }
    if (!sessionCipher) {
        log('Session not ready yet – message queued.');
    }
    await flushPendingMessages();
}

async function flushPendingMessages(): Promise<void> {
    if (flushingQueue) {
        return;
    }
    if (!sessionCipher || !activeWorker || !navigator.onLine) {
        return;
    }
    flushingQueue = true;
    try {
        while (pendingPayloads.length > 0 && sessionCipher && activeWorker && navigator.onLine) {
            const payload = pendingPayloads[0];
            if (!payload) {
                pendingPayloads.shift();
                continue;
            }
            const ciphertext = await sessionCipher.encrypt(encoder.encode(payload).buffer);
            activeWorker.postMessage({
                type: 'CIPHERTEXT',
                message: ciphertext,
                encoding: 'binary',
            });
            pendingPayloads.shift();
            log(
                `Sent encrypted payload (${ciphertext.type === 3 ? 'PreKeyWhisper' : 'Whisper'})` +
                    (pendingPayloads.length ? ` – ${pendingPayloads.length} queued` : '')
            );
        }
    } catch (error) {
        log(`Failed to flush queue: ${(error as Error).message}`);
    } finally {
        flushingQueue = false;
    }
}
