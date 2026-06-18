/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';
import {
    createIndexedDBSignalProtocolStore,
    destroyIndexedDBDatabase,
} from '../../examples/storage-adapters/indexeddb-adapter';
import type { IdentityKeyPairType, KeyPairType } from '../types';

const dbName = () => `libsignal-test-${Date.now()}-${Math.random()}`;

const makeKeyPair = (prefix: number): KeyPairType => ({
    pubKey: Uint8Array.from({ length: 3 }, (_, i) => prefix + i).buffer,
    privKey: Uint8Array.from({ length: 3 }, (_, i) => prefix + i + 10).buffer,
});

const makeIdentityKeyPair = (prefix: number): IdentityKeyPairType => ({
    ...makeKeyPair(prefix),
    signingPubKey: Uint8Array.from({ length: 3 }, (_, i) => prefix + i + 20).buffer,
    signingPrivKey: Uint8Array.from({ length: 3 }, (_, i) => prefix + i + 30).buffer,
});

const makeBuffer = (value: number): ArrayBuffer => Uint8Array.from([value, value + 1, value + 2]).buffer;

describe('IndexedDB SignalProtocolStore adapter', () => {
    it('persists identity key pair and registration ID', async () => {
        const name = dbName();
        const store = await createIndexedDBSignalProtocolStore({ dbName: name });
        const identity = makeIdentityKeyPair(5);
        await store.setIdentityKeyPair(identity);
        await store.setLocalRegistrationId(1234);

        const loadedIdentity = await store.getIdentityKeyPair();
        const loadedRegistration = await store.getLocalRegistrationId();

        expect(loadedIdentity).toBeDefined();
        expect(new Uint8Array(loadedIdentity!.pubKey)).toEqual(new Uint8Array(identity.pubKey));
        expect(new Uint8Array(loadedIdentity!.privKey)).toEqual(new Uint8Array(identity.privKey));
        expect(loadedRegistration).toBe(1234);

        await store.clear();
        store.close();
        await destroyIndexedDBDatabase({ dbName: name });
    });

    it('saves and loads remote identities', async () => {
        const name = dbName();
        const store = await createIndexedDBSignalProtocolStore({ dbName: name });
        const address = 'alice.1';
        const initial = makeBuffer(1);
        const updated = makeBuffer(2);

        // first save returns false (new identity)
        await expect(store.saveIdentity(address, initial)).resolves.toBe(false);
        await expect(store.isTrustedIdentity(address, initial, 1)).resolves.toBe(true);

        // saving same key returns false (unchanged)
        await expect(store.saveIdentity(address, initial)).resolves.toBe(false);

        // saving different key returns true and updates trust comparison
        await expect(store.saveIdentity(address, updated)).resolves.toBe(true);
        await expect(store.isTrustedIdentity(address, initial, 1)).resolves.toBe(false);
        await expect(store.isTrustedIdentity(address, updated, 1)).resolves.toBe(true);

        store.close();
        await destroyIndexedDBDatabase({ dbName: name });
    });

    it('stores sessions and supports removeAllSessions', async () => {
        const name = dbName();
        const store = await createIndexedDBSignalProtocolStore({ dbName: name });
        const sessionKey = 'bob.1';

        await store.storeSession(sessionKey, 'record-1');
        await store.storeSession(`${sessionKey}:2`, 'record-2');

        await expect(store.loadSession(sessionKey)).resolves.toBe('record-1');
        await store.removeAllSessions(sessionKey);

        await expect(store.loadSession(sessionKey)).resolves.toBeUndefined();
        await expect(store.loadSession(`${sessionKey}:2`)).resolves.toBeUndefined();

        store.close();
        await destroyIndexedDBDatabase({ dbName: name });
    });

    it('handles pre-keys and signed pre-keys lifecycles', async () => {
        const name = dbName();
        const store = await createIndexedDBSignalProtocolStore({ dbName: name });
        const preKeyPair = makeKeyPair(20);
        const signedPreKeyPair = makeKeyPair(30);

        await store.storePreKey(1, preKeyPair);
        await store.storeSignedPreKey(7, signedPreKeyPair);

        const loadedPreKey = await store.loadPreKey(1);
        const loadedSigned = await store.loadSignedPreKey(7);

        expect(loadedPreKey).toBeDefined();
        expect(loadedSigned).toBeDefined();
        expect(new Uint8Array(loadedPreKey!.pubKey)).toEqual(new Uint8Array(preKeyPair.pubKey));
        expect(new Uint8Array(loadedSigned!.pubKey)).toEqual(new Uint8Array(signedPreKeyPair.pubKey));

        await store.removePreKey(1);
        await store.removeSignedPreKey(7);

        await expect(store.loadPreKey(1)).resolves.toBeUndefined();
        await expect(store.loadSignedPreKey(7)).resolves.toBeUndefined();

        store.close();
        await destroyIndexedDBDatabase({ dbName: name });
    });
});
