interface QueueOptions {
    dbName?: string;
    storeName?: string;
}

export interface QueuedMessage {
    id: string;
    payload: string;
    createdAt: number;
    source: 'ui' | 'push';
}

const DEFAULT_DB = 'libsignal-pwa-outbox';
const DEFAULT_STORE = 'outbox';

export class MessageQueue {
    private dbPromise: Promise<IDBDatabase>;
    private storeName: string;

    constructor(options: QueueOptions = {}) {
        const dbName = options.dbName ?? DEFAULT_DB;
        this.storeName = options.storeName ?? DEFAULT_STORE;
        this.dbPromise = openQueueDatabase(dbName, this.storeName);
    }

    async enqueue(message: QueuedMessage): Promise<void> {
        const db = await this.dbPromise;
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.objectStore(this.storeName).put(message);
        });
    }

    async getAll(): Promise<QueuedMessage[]> {
        const db = await this.dbPromise;
        return new Promise<QueuedMessage[]>((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const request = tx.objectStore(this.storeName).getAll();
            request.onsuccess = () => resolve(request.result as QueuedMessage[]);
            request.onerror = () => reject(request.error);
        });
    }

    async remove(id: string): Promise<void> {
        const db = await this.dbPromise;
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.objectStore(this.storeName).delete(id);
        });
    }
}

async function openQueueDatabase(name: string, storeName: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
