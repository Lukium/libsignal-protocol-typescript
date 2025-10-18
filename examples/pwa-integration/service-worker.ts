import { MessageQueue } from './queue';

const queue = new MessageQueue({ dbName: 'libsignal-pwa-outbox' });

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
    if (data.type === 'SYNC_OUTBOX') {
        event.waitUntil(flushQueue('manual'));
    }
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'libsignal-sync') {
        event.waitUntil(flushQueue('background-sync'));
    }
});

self.addEventListener('push', (event) => {
    const payload = event.data?.text() ?? 'push payload';
    event.waitUntil(
        (async () => {
            await queue.enqueue({ id: crypto.randomUUID(), payload, createdAt: Date.now(), source: 'push' });
            await flushQueue('push');
        })()
    );
});

async function flushQueue(reason: string): Promise<void> {
    const messages = await queue.getAll();
    for (const message of messages) {
        log(`Flushing message ${message.id} (${reason})`);
        // TODO: replace with actual network send + Signal Protocol decrypt/encrypt.
        await queue.remove(message.id);
    }
}

function log(message: string) {
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
            client.postMessage({ type: 'LOG', message });
        }
    });
    console.log('[libsignal-pwa]', message);
}

export {}; // ensure this file is treated as a module
