import type { Direction, KeyPairType, StorageType } from '../../src/types';

export interface IndexedDBStoreOptions {
    /**
     * Database name. Defaults to `libsignal-protocol`.
     */
    dbName?: string;
    /**
     * IndexedDB version. Increment to trigger schema upgrades.
     */
    version?: number;
}

export interface IndexedDBSignalProtocolStore extends StorageType {
    setIdentityKeyPair(keyPair: KeyPairType): Promise<void>;
    setLocalRegistrationId(registrationId: number): Promise<void>;
    close(): void;
    clear(): Promise<void>;
    removeSession(identifier: string): Promise<void>;
    removeAllSessions(identifier: string): Promise<void>;
}

const DEFAULT_DB_NAME = 'libsignal-protocol';
const DEFAULT_VERSION = 1;

const STORE_METADATA = 'metadata';
const STORE_IDENTITIES = 'identities';
const STORE_SESSIONS = 'sessions';
const STORE_PREKEYS = 'preKeys';
const STORE_SIGNED_PREKEYS = 'signedPreKeys';

type MetadataKey = 'identityKeyPair' | 'registrationId';

interface MetadataRecord<T = unknown> {
    id: MetadataKey;
    value: T;
}

interface IdentityRecord {
    id: string;
    key: ArrayBuffer;
}

interface SessionRecord {
    id: string;
    record: string;
}

interface KeyPairRecord {
    id: string | number;
    keyPair: KeyPairType;
}

async function openDatabase(options: IndexedDBStoreOptions): Promise<IDBDatabase> {
    const name = options.dbName ?? DEFAULT_DB_NAME;
    const version = options.version ?? DEFAULT_VERSION;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_METADATA)) {
                db.createObjectStore(STORE_METADATA, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_IDENTITIES)) {
                db.createObjectStore(STORE_IDENTITIES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
                db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_PREKEYS)) {
                db.createObjectStore(STORE_PREKEYS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_SIGNED_PREKEYS)) {
                db.createObjectStore(STORE_SIGNED_PREKEYS, { keyPath: 'id' });
            }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function withStore<T>(
    db: IDBDatabase,
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result: IDBRequest<T> | Promise<T>;
        try {
            result = fn(store);
        } catch (err) {
            tx.abort();
            reject(err);
            return;
        }

        if (result instanceof Promise) {
            result
                .then((value) => {
                    resolve(value);
                })
                .catch((err) => {
                    reject(err);
                });
        } else {
            result.onerror = () => reject(result.error);
            result.onsuccess = () => resolve(result.result);
        }

        tx.onerror = () => reject(tx.error);
    });
}

const cloneBuffer = (buffer: ArrayBuffer): ArrayBuffer => buffer.slice(0);

const cloneKeyPair = (keyPair: KeyPairType): KeyPairType => ({
    pubKey: cloneBuffer(keyPair.pubKey),
    privKey: cloneBuffer(keyPair.privKey),
});

const buffersEqual = (a: ArrayBuffer, b: ArrayBuffer): boolean => {
    if (a.byteLength !== b.byteLength) {
        return false;
    }
    const av = new Uint8Array(a);
    const bv = new Uint8Array(b);
    for (let i = 0; i < av.length; i += 1) {
        if (av[i] !== bv[i]) {
            return false;
        }
    }
    return true;
};

export async function createIndexedDBSignalProtocolStore(
    options: IndexedDBStoreOptions = {}
): Promise<IndexedDBSignalProtocolStore> {
    const db = await openDatabase(options);

    const readMetadata = async <T>(id: MetadataKey): Promise<T | undefined> => {
        const record = (await withStore<MetadataRecord | undefined>(db, STORE_METADATA, 'readonly', (store) =>
            store.get(id)
        )) as MetadataRecord | undefined;
        if (!record) {
            return undefined;
        }
        return cloneMetadataValue(record.value as T);
    };

    const writeMetadata = (record: MetadataRecord): Promise<void> =>
        withStore(db, STORE_METADATA, 'readwrite', (store) =>
            store.put({
                id: record.id,
                value: cloneMetadataValue(record.value),
            })
        ).then(() => undefined);

    const storeAPI: IndexedDBSignalProtocolStore = {
        async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
            const value = await readMetadata<KeyPairType>('identityKeyPair');
            return value ? cloneKeyPair(value) : undefined;
        },

        async getLocalRegistrationId(): Promise<number | undefined> {
            return readMetadata<number>('registrationId');
        },

        async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer, _direction: Direction): Promise<boolean> {
            const record = (await withStore<IdentityRecord | undefined>(db, STORE_IDENTITIES, 'readonly', (store) =>
                store.get(identifier)
            )) as IdentityRecord | undefined;
            if (!record) {
                return true;
            }
            return buffersEqual(record.key, identityKey);
        },

        async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
            const existing = (await withStore<IdentityRecord | undefined>(db, STORE_IDENTITIES, 'readonly', (store) =>
                store.get(identifier)
            )) as IdentityRecord | undefined;

            await withStore(db, STORE_IDENTITIES, 'readwrite', (store) =>
                store.put({ id: identifier, key: cloneBuffer(identityKey) })
            );

            if (!existing) {
                return false;
            }
            return !buffersEqual(existing.key, identityKey);
        },

        async loadPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
            const record = (await withStore<KeyPairRecord | undefined>(db, STORE_PREKEYS, 'readonly', (store) =>
                store.get(keyId)
            )) as KeyPairRecord | undefined;
            return record ? cloneKeyPair(record.keyPair) : undefined;
        },

        async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
            await withStore(db, STORE_PREKEYS, 'readwrite', (store) =>
                store.put({ id: keyId, keyPair: cloneKeyPair(keyPair) })
            );
        },

        async removePreKey(keyId: number | string): Promise<void> {
            await withStore(db, STORE_PREKEYS, 'readwrite', (store) => store.delete(keyId));
        },

        async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
            const record = (await withStore<KeyPairRecord | undefined>(db, STORE_SIGNED_PREKEYS, 'readonly', (store) =>
                store.get(keyId)
            )) as KeyPairRecord | undefined;
            return record ? cloneKeyPair(record.keyPair) : undefined;
        },

        async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
            await withStore(db, STORE_SIGNED_PREKEYS, 'readwrite', (store) =>
                store.put({ id: keyId, keyPair: cloneKeyPair(keyPair) })
            );
        },

        async removeSignedPreKey(keyId: number | string): Promise<void> {
            await withStore(db, STORE_SIGNED_PREKEYS, 'readwrite', (store) => store.delete(keyId));
        },

        async storeSession(encodedAddress: string, record: string): Promise<void> {
            await withStore(db, STORE_SESSIONS, 'readwrite', (store) => store.put({ id: encodedAddress, record }));
        },

        async loadSession(encodedAddress: string): Promise<string | undefined> {
            const record = (await withStore<SessionRecord | undefined>(db, STORE_SESSIONS, 'readonly', (store) =>
                store.get(encodedAddress)
            )) as SessionRecord | undefined;
            return record ? record.record : undefined;
        },

        async removeSession(identifier: string): Promise<void> {
            await withStore(db, STORE_SESSIONS, 'readwrite', (store) => store.delete(identifier));
        },

        async removeAllSessions(identifier: string): Promise<void> {
            const keys = (await withStore<IDBValidKey[]>(db, STORE_SESSIONS, 'readonly', (store) =>
                store.getAllKeys()
            )) as IDBValidKey[];
            await withStore(db, STORE_SESSIONS, 'readwrite', (store) => {
                keys.forEach((key) => {
                    if (typeof key === 'string' && key.startsWith(identifier)) {
                        store.delete(key);
                    }
                });
                return store.get(identifier); // noop request to keep transaction alive
            });
        },

        async clear(): Promise<void> {
            const stores = [STORE_METADATA, STORE_IDENTITIES, STORE_SESSIONS, STORE_PREKEYS, STORE_SIGNED_PREKEYS];
            await Promise.all(
                stores.map((name) => withStore(db, name, 'readwrite', (store) => store.clear()).then(() => undefined))
            );
        },

        close(): void {
            db.close();
        },

        async setIdentityKeyPair(keyPair: KeyPairType): Promise<void> {
            await writeMetadata({ id: 'identityKeyPair', value: cloneKeyPair(keyPair) });
        },

        async setLocalRegistrationId(registrationId: number): Promise<void> {
            await writeMetadata({ id: 'registrationId', value: registrationId });
        },
    };

    return storeAPI;
}

function cloneMetadataValue<T>(value: T): T {
    if (value instanceof ArrayBuffer) {
        return cloneBuffer(value) as unknown as T;
    }
    if (typeof value === 'object' && value !== null) {
        if (isKeyPairType(value)) {
            return cloneKeyPair(value) as unknown as T;
        }
        return structuredClonePolyfill(value);
    }
    return value;
}

const structuredClonePolyfill = <T>(value: T): T => {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
};

function isKeyPairType(value: unknown): value is KeyPairType {
    const candidate = value as KeyPairType | undefined;
    return !!candidate?.pubKey && !!candidate?.privKey;
}

export async function destroyIndexedDBDatabase(options: IndexedDBStoreOptions = {}): Promise<void> {
    const name = options.dbName ?? DEFAULT_DB_NAME;
    await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
        request.onblocked = () => reject(new Error(`Delete database request blocked for ${name}`));
    });
}
