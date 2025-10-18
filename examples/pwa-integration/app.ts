import { createIndexedDBSignalProtocolStore } from '../storage-adapters/indexeddb-adapter';
import { MessageQueue } from './queue';

const statusEl = document.getElementById('status') as HTMLSpanElement;
const textarea = document.getElementById('message') as HTMLTextAreaElement;
const sendButton = document.getElementById('send') as HTMLButtonElement;
const logEl = document.getElementById('log') as HTMLDivElement;

const log = (message: string) => {
    const time = new Date().toLocaleTimeString();
    logEl.innerHTML += `[${time}] ${message}<br />`;
    logEl.scrollTop = logEl.scrollHeight;
};

const queue = new MessageQueue({ dbName: 'libsignal-pwa-outbox' });

async function init() {
    if (!('serviceWorker' in navigator)) {
        statusEl.textContent = 'Service Worker unsupported';
        return;
    }

    const store = await createIndexedDBSignalProtocolStore({ dbName: 'libsignal-protocol' });
    statusEl.textContent = 'initialising store…';

    // Demo identity bootstrap (not persisted across reloads by default)
    const registrationId = crypto.getRandomValues(new Uint16Array(1))[0];
    await store.setLocalRegistrationId(registrationId & 0x3fff);
    await store.clear();

    statusEl.textContent = 'registering service worker…';

    const registration = await navigator.serviceWorker.register('./service-worker.ts', { type: 'module' });
    await navigator.serviceWorker.ready;
    statusEl.textContent = 'ready';
    log('Service Worker registered.');

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'LOG') {
            log(event.data.message);
        }
    });

    sendButton.addEventListener('click', async () => {
        const payload = textarea.value.trim();
        if (!payload) {
            return;
        }
        textarea.value = '';
        const id = crypto.randomUUID();
        await queue.enqueue({ id, payload, createdAt: Date.now(), source: 'ui' });
        log(`Queued message ${id}`);
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SYNC_OUTBOX' });
        }
    });

    window.addEventListener('beforeunload', () => {
        store.close();
    });

    // Request background sync if available
    if ('sync' in registration) {
        try {
            await registration.sync.register('libsignal-sync');
            log('Background sync registered.');
        } catch (err) {
            log(`Background sync registration failed: ${(err as Error).message}`);
        }
    }
}

init().catch((err) => {
    console.error(err);
    statusEl.textContent = 'initialisation error';
    log(`Error: ${(err as Error).message}`);
});
