import type { StorageType, KeyPairType, Direction } from '@lukium/libsignal-protocol-typescript';

function cloneBuffer(buffer: ArrayBuffer): ArrayBuffer {
    return buffer.slice(0);
}

function buffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
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
}

// True when a session address is exactly the identity or one of its
// `identity.deviceId` device entries (deviceId all digits).
function sessionKeyBelongsTo(address: string, identifier: string): boolean {
    if (address === identifier) {
        return true;
    }
    const prefix = `${identifier}.`;
    return address.startsWith(prefix) && /^\d+$/.test(address.slice(prefix.length));
}

/**
 * Creates an in-memory Signal Protocol store.
 * Useful for testing or when persistence is not required.
 */
export function createMemoryStore(): StorageType {
    const store: Record<string, unknown> = {};

    return {
        getIdentityKeyPair(): Promise<KeyPairType | undefined> {
            return Promise.resolve(store.identityKeyPair as KeyPairType | undefined);
        },

        getLocalRegistrationId(): Promise<number | undefined> {
            return Promise.resolve(store.registrationId as number | undefined);
        },

        isTrustedIdentity(identifier: string, identityKey: ArrayBuffer, _direction: Direction): Promise<boolean> {
            // Trust-on-first-use: trust an unseen identity, but reject a key that
            // differs from the one we already recorded. A real app should surface
            // a key-change warning to the user rather than silently failing.
            const stored = store[`identity:${identifier}`] as ArrayBuffer | undefined;
            if (!stored) {
                return Promise.resolve(true);
            }
            return Promise.resolve(buffersEqual(stored, identityKey));
        },

        saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
            // Persist the identity key for future verification; return true if it
            // changed an existing entry.
            const existing = store[`identity:${identifier}`] as ArrayBuffer | undefined;
            store[`identity:${identifier}`] = cloneBuffer(identityKey);
            if (!existing) {
                return Promise.resolve(false);
            }
            return Promise.resolve(!buffersEqual(existing, identityKey));
        },

        loadPreKey(keyId: number): Promise<KeyPairType | undefined> {
            return Promise.resolve(store[`preKey:${keyId}`] as KeyPairType | undefined);
        },

        storePreKey(keyId: number, keyPair: KeyPairType): Promise<void> {
            store[`preKey:${keyId}`] = keyPair;
            return Promise.resolve();
        },

        removePreKey(keyId: number): Promise<void> {
            delete store[`preKey:${keyId}`];
            return Promise.resolve();
        },

        loadSignedPreKey(keyId: number): Promise<KeyPairType | undefined> {
            return Promise.resolve(store[`signedPreKey:${keyId}`] as KeyPairType | undefined);
        },

        storeSignedPreKey(keyId: number, keyPair: KeyPairType): Promise<void> {
            store[`signedPreKey:${keyId}`] = keyPair;
            return Promise.resolve();
        },

        removeSignedPreKey(keyId: number): Promise<void> {
            delete store[`signedPreKey:${keyId}`];
            return Promise.resolve();
        },

        loadSession(identifier: string): Promise<string | undefined> {
            return Promise.resolve(store[`session:${identifier}`] as string | undefined);
        },

        storeSession(identifier: string, record: string): Promise<void> {
            store[`session:${identifier}`] = record;
            return Promise.resolve();
        },

        removeSession(identifier: string): Promise<void> {
            delete store[`session:${identifier}`];
            return Promise.resolve();
        },

        removeAllSessions(identifier: string): Promise<void> {
            // Remove every device session for an identity. Match the exact address
            // or `identity.deviceId` keys only — never an unrelated identity that
            // merely shares a name prefix (e.g. `alice` vs `alicebob.1`).
            for (const key of Object.keys(store)) {
                if (key.startsWith('session:') && sessionKeyBelongsTo(key.slice('session:'.length), identifier)) {
                    delete store[key];
                }
            }
            return Promise.resolve();
        },

        // Extension methods for React integration
        setIdentityKeyPair(keyPair: KeyPairType): void {
            store.identityKeyPair = keyPair;
        },

        setLocalRegistrationId(id: number): void {
            store.registrationId = id;
        },
    };
}

export type MemoryStore = ReturnType<typeof createMemoryStore>;
