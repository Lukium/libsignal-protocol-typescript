/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';
import { SessionBuilder } from '../../session-builder';
import { SessionCipher } from '../../session-cipher';
import type { MessageType } from '../../session-cipher';
import { SignalProtocolAddress } from '../../signal-protocol-address';
import { KeyHelper } from '../../key-helper';
import { binaryStringToArrayBuffer } from '../../helpers';
import { assertEqualArrayBuffers } from '../../__test-utils__/utils';
import {
    createIndexedDBSignalProtocolStore,
    destroyIndexedDBDatabase,
    type IndexedDBSignalProtocolStore,
} from '../../../examples/storage-adapters/indexeddb-adapter';
import type { DeviceType } from '../../session-types';
import type { IdentityKeyPairType, SignedPreKeyPairType, PreKeyPairType } from '../../types';
import { Direction } from '../../types';

interface DeviceContext {
    store: IndexedDBSignalProtocolStore;
    dbName: string;
    identityKey: IdentityKeyPairType;
    registrationId: number;
}

const randomDbName = (label: string): string =>
    `libsignal-integration-${label}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

jest.setTimeout(30000);

const storesToClose: IndexedDBSignalProtocolStore[] = [];
const dbNamesToDestroy = new Set<string>();

async function createDevice(
    label: string,
    options: { identity?: IdentityKeyPairType; registrationId?: number } = {}
): Promise<DeviceContext> {
    const dbName = randomDbName(label);
    const store = await createIndexedDBSignalProtocolStore({ dbName });
    storesToClose.push(store);
    dbNamesToDestroy.add(dbName);

    const identityKey = options.identity ?? (await KeyHelper.generateIdentityKeyPair());
    const registrationId = options.registrationId ?? KeyHelper.generateRegistrationId();

    await store.setIdentityKeyPair(identityKey);
    await store.setLocalRegistrationId(registrationId);

    return { store, dbName, identityKey, registrationId };
}

async function reopenStore(dbName: string): Promise<IndexedDBSignalProtocolStore> {
    const store = await createIndexedDBSignalProtocolStore({ dbName });
    storesToClose.push(store);
    dbNamesToDestroy.add(dbName);
    return store;
}

async function publishPreKeyBundle(
    device: DeviceContext,
    ids: { preKeyId: number; signedPreKeyId: number }
): Promise<DeviceType> {
    const preKey: PreKeyPairType = await KeyHelper.generatePreKey(ids.preKeyId);
    const signedPreKey: SignedPreKeyPairType = await KeyHelper.generateSignedPreKey(
        device.identityKey,
        ids.signedPreKeyId
    );

    await device.store.storePreKey(preKey.keyId, preKey.keyPair);
    await device.store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

    return {
        identityKey: device.identityKey.pubKey,
        identitySigningKey: device.identityKey.signingPubKey,
        registrationId: device.registrationId,
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
}

async function copySession(
    source: IndexedDBSignalProtocolStore,
    target: IndexedDBSignalProtocolStore,
    address: SignalProtocolAddress,
    remoteIdentityKey: ArrayBuffer
): Promise<void> {
    const encodedAddress = address.toString();
    const session = await source.loadSession(encodedAddress);
    expect(session).toBeDefined();
    await target.storeSession(encodedAddress, session!);
    await target.saveIdentity(encodedAddress, remoteIdentityKey);
}

async function encryptAndExpectPreKey(cipher: SessionCipher, plaintext: ArrayBuffer): Promise<MessageType> {
    const result = await cipher.encrypt(plaintext);
    expect(result.type).toBe(3); // PreKeyWhisperMessage
    expect(result.body).toBeDefined();
    return result;
}

afterEach(async () => {
    while (storesToClose.length) {
        const store = storesToClose.pop();
        store?.close();
    }

    await Promise.all(
        Array.from(dbNamesToDestroy).map(async (dbName) => {
            await destroyIndexedDBDatabase({ dbName });
        })
    );
    dbNamesToDestroy.clear();
});

describe('IndexedDB multi-device integration', () => {
    const aliceAddressPrimary = new SignalProtocolAddress('alice', 1);
    const aliceAddressSecondary = new SignalProtocolAddress('alice', 2);
    const bobAddress = new SignalProtocolAddress('bob', 1);

    it('syncs ratchet state across devices using IndexedDB-backed stores', async () => {
        const alicePrimary = await createDevice('alice-primary');
        const aliceSecondary = await createDevice('alice-secondary', {
            identity: alicePrimary.identityKey,
            registrationId: alicePrimary.registrationId,
        });
        const bob = await createDevice('bob');
        const bobBundle = await publishPreKeyBundle(bob, { preKeyId: 31337, signedPreKeyId: 7 });

        const builder = new SessionBuilder(alicePrimary.store, bobAddress);
        await builder.processPreKey(bobBundle);

        const primaryCipher = new SessionCipher(alicePrimary.store, bobAddress);
        const bobCipher = new SessionCipher(bob.store, aliceAddressPrimary);

        const initialPlaintext = binaryStringToArrayBuffer('primary hello');
        const preKeyMessage = await encryptAndExpectPreKey(primaryCipher, initialPlaintext);
        const decryptedInitial = await bobCipher.decryptPreKeyWhisperMessage(preKeyMessage.body!, 'binary');
        assertEqualArrayBuffers(decryptedInitial, initialPlaintext);

        const bobReplyPlaintext = binaryStringToArrayBuffer('reply to primary');
        const bobReply = await bobCipher.encrypt(bobReplyPlaintext);
        expect(bobReply.body).toBeDefined();
        const primaryReply = await primaryCipher.decryptWhisperMessage(bobReply.body!, 'binary');
        assertEqualArrayBuffers(primaryReply, bobReplyPlaintext);

        await copySession(alicePrimary.store, aliceSecondary.store, bobAddress, bobBundle.identityKey);

        const aliceSecondaryCipher = new SessionCipher(aliceSecondary.store, bobAddress);
        const bobToSecondaryPlaintext = binaryStringToArrayBuffer('message for secondary');
        const bobToSecondary = await bobCipher.encrypt(bobToSecondaryPlaintext);
        const secondaryDecrypted = await aliceSecondaryCipher.decryptWhisperMessage(bobToSecondary.body!, 'binary');
        assertEqualArrayBuffers(secondaryDecrypted, bobToSecondaryPlaintext);

        const secondaryOutboundPlaintext = binaryStringToArrayBuffer('secondary responds');
        const secondaryOutbound = await aliceSecondaryCipher.encrypt(secondaryOutboundPlaintext);
        expect(secondaryOutbound.body).toBeDefined();
        const bobDecrypted = await bobCipher.decryptWhisperMessage(secondaryOutbound.body!, 'binary');
        assertEqualArrayBuffers(bobDecrypted, secondaryOutboundPlaintext);
    });

    it('handles pre-key rotation and catch-up on newly synced devices', async () => {
        const alicePrimary = await createDevice('alice-primary');
        const aliceSecondary = await createDevice('alice-secondary', {
            identity: alicePrimary.identityKey,
            registrationId: alicePrimary.registrationId,
        });
        const bob = await createDevice('bob');

        const initialBundle = await publishPreKeyBundle(bob, { preKeyId: 1001, signedPreKeyId: 5 });
        const primaryBuilder = new SessionBuilder(alicePrimary.store, bobAddress);
        await primaryBuilder.processPreKey(initialBundle);

        await copySession(alicePrimary.store, aliceSecondary.store, bobAddress, initialBundle.identityKey);

        const primaryCipher = new SessionCipher(alicePrimary.store, bobAddress);
        const bobCipherToPrimary = new SessionCipher(bob.store, aliceAddressPrimary);

        const keepAlive = binaryStringToArrayBuffer('primary keeps chat alive');
        const keepAliveMessage = await primaryCipher.encrypt(keepAlive);
        const keepAlivePlaintext = await bobCipherToPrimary.decryptPreKeyWhisperMessage(
            keepAliveMessage.body!,
            'binary'
        );
        assertEqualArrayBuffers(keepAlivePlaintext, keepAlive);

        const rotatedBundle = await publishPreKeyBundle(bob, { preKeyId: 1002, signedPreKeyId: 6 });
        const secondaryBuilder = new SessionBuilder(aliceSecondary.store, bobAddress);
        await secondaryBuilder.processPreKey(rotatedBundle);

        const bobCipherToSecondary = new SessionCipher(bob.store, aliceAddressSecondary);
        const secondaryCipher = new SessionCipher(aliceSecondary.store, bobAddress);

        const secondaryIntro = binaryStringToArrayBuffer('secondary joins with fresh bundle');
        const firstSecondaryMessage = await encryptAndExpectPreKey(secondaryCipher, secondaryIntro);
        const decryptedByBob = await bobCipherToSecondary.decryptPreKeyWhisperMessage(
            firstSecondaryMessage.body!,
            'binary'
        );
        assertEqualArrayBuffers(decryptedByBob, secondaryIntro);

        const bobAcksSecondary = binaryStringToArrayBuffer('ack from bob after rotation');
        const bobAckMessage = await bobCipherToSecondary.encrypt(bobAcksSecondary);
        const secondaryAckPlaintext = await secondaryCipher.decryptWhisperMessage(bobAckMessage.body!, 'binary');
        assertEqualArrayBuffers(secondaryAckPlaintext, bobAcksSecondary);

        const primaryFollowUp = binaryStringToArrayBuffer('primary still decrypts after rotation');
        const bobToPrimary = await bobCipherToPrimary.encrypt(primaryFollowUp);
        const primaryPlaintext = await primaryCipher.decryptWhisperMessage(bobToPrimary.body!, 'binary');
        assertEqualArrayBuffers(primaryPlaintext, primaryFollowUp);
    });

    it('rejects unexpected identity changes across synced devices', async () => {
        const alicePrimary = await createDevice('alice-primary');
        const aliceSecondary = await createDevice('alice-secondary', {
            identity: alicePrimary.identityKey,
            registrationId: alicePrimary.registrationId,
        });
        const bob = await createDevice('bob');

        const bobBundle = await publishPreKeyBundle(bob, { preKeyId: 42, signedPreKeyId: 11 });
        const builder = new SessionBuilder(alicePrimary.store, bobAddress);
        await builder.processPreKey(bobBundle);
        await copySession(alicePrimary.store, aliceSecondary.store, bobAddress, bobBundle.identityKey);

        const newBobIdentity = await KeyHelper.generateIdentityKeyPair();
        const newRegistrationId = KeyHelper.generateRegistrationId();
        await bob.store.setIdentityKeyPair(newBobIdentity);
        await bob.store.setLocalRegistrationId(newRegistrationId);
        const replacedBundle = await publishPreKeyBundle(
            { ...bob, identityKey: newBobIdentity, registrationId: newRegistrationId } as DeviceContext,
            { preKeyId: 43, signedPreKeyId: 12 }
        );

        const primaryBuilder = new SessionBuilder(alicePrimary.store, bobAddress);
        await expect(primaryBuilder.processPreKey(replacedBundle)).rejects.toThrow('Identity key changed');

        const secondaryBuilder = new SessionBuilder(aliceSecondary.store, bobAddress);
        await expect(secondaryBuilder.processPreKey(replacedBundle)).rejects.toThrow('Identity key changed');

        const stillTrusted = await alicePrimary.store.isTrustedIdentity(
            bobAddress.getName(),
            bobBundle.identityKey,
            Direction.RECEIVING
        );
        expect(stillTrusted).toBe(true);
    });

    it('restores session state after IndexedDB reopen', async () => {
        const alicePrimary = await createDevice('alice-primary');
        const bob = await createDevice('bob');
        const bobBundle = await publishPreKeyBundle(bob, { preKeyId: 2001, signedPreKeyId: 21 });

        const builder = new SessionBuilder(alicePrimary.store, bobAddress);
        await builder.processPreKey(bobBundle);

        const primaryCipher = new SessionCipher(alicePrimary.store, bobAddress);
        const bobCipher = new SessionCipher(bob.store, aliceAddressPrimary);

        const handshakePlaintext = binaryStringToArrayBuffer('persist me');
        const initialCiphertext = await encryptAndExpectPreKey(primaryCipher, handshakePlaintext);
        const initialDecrypted = await bobCipher.decryptPreKeyWhisperMessage(initialCiphertext.body!, 'binary');
        assertEqualArrayBuffers(initialDecrypted, handshakePlaintext);

        alicePrimary.store.close();

        const reopened = await reopenStore(alicePrimary.dbName);

        const reopenedCipher = new SessionCipher(reopened, bobAddress);
        const bobFollowUpPlaintext = binaryStringToArrayBuffer('after reload');
        const bobFollowUp = await bobCipher.encrypt(bobFollowUpPlaintext);
        const reopenedPlaintext = await reopenedCipher.decryptWhisperMessage(bobFollowUp.body!, 'binary');
        assertEqualArrayBuffers(reopenedPlaintext, bobFollowUpPlaintext);

        const reopenedOutboundPlaintext = binaryStringToArrayBuffer('reload reply');
        const reopenedOutbound = await reopenedCipher.encrypt(reopenedOutboundPlaintext);
        const decryptAfterReload = await bobCipher.decryptWhisperMessage(reopenedOutbound.body!, 'binary');
        assertEqualArrayBuffers(decryptAfterReload, reopenedOutboundPlaintext);
    });
});
