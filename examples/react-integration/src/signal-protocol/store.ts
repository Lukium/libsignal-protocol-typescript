import type { StorageType, KeyPairType, Direction } from '@lukium/libsignal-protocol-typescript';

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

        isTrustedIdentity(_identifier: string, _identityKey: ArrayBuffer, _direction: Direction): Promise<boolean> {
            // In a real app, implement trust-on-first-use (TOFU) or
            // prompt the user to verify identity key changes
            return Promise.resolve(true);
        },

        saveIdentity(_identifier: string, _identityKey: ArrayBuffer): Promise<boolean> {
            // Store the identity key for future verification
            // Return true if the identity changed, false otherwise
            return Promise.resolve(false);
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

        removeAllSessions(_identifier: string): Promise<void> {
            // Remove all sessions for a given identifier
            // In this simple implementation, we'd need to track session keys
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
