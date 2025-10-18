import { SessionBuilder } from '../session-builder';
import { SignalProtocolAddress } from '../signal-protocol-address';
import { StorageType, KeyPairType } from '../types';
import { SessionType, BaseKeyType } from '../session-types';
import { SessionRecord } from '../session-record';
import { PreKeyWhisperMessage } from '@privacyresearch/libsignal-protocol-protobuf-ts';

const createBuffer = (fill: number, length: number): ArrayBuffer => {
    const bytes = new Uint8Array(length);
    bytes.fill(fill);
    return bytes.buffer;
};

const createUint8 = (fill: number, length: number): Uint8Array => {
    const bytes = new Uint8Array(length);
    bytes.fill(fill);
    return bytes;
};

const createKeyPair = (fill = 5): KeyPairType<ArrayBuffer> => ({
    pubKey: createBuffer(fill, 32),
    privKey: createBuffer(fill + 1, 32),
});

const createStorage = (overrides: Partial<StorageType> = {}): StorageType => ({
    getIdentityKeyPair: jest.fn().mockResolvedValue(createKeyPair()),
    getLocalRegistrationId: jest.fn().mockResolvedValue(1),
    isTrustedIdentity: jest.fn().mockResolvedValue(true),
    saveIdentity: jest.fn().mockResolvedValue(true),
    loadPreKey: jest.fn().mockResolvedValue(createKeyPair()),
    storePreKey: jest.fn().mockResolvedValue(undefined),
    removePreKey: jest.fn().mockResolvedValue(undefined),
    storeSession: jest.fn().mockResolvedValue(undefined),
    loadSession: jest.fn().mockResolvedValue(undefined),
    loadSignedPreKey: jest.fn().mockResolvedValue(createKeyPair()),
    storeSignedPreKey: jest.fn().mockResolvedValue(undefined),
    removeSignedPreKey: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

const address = new SignalProtocolAddress('test', 1);

describe('SessionBuilder defensive paths', () => {
    test('startSessionAsInitiator rejects when identity key missing', async () => {
        const builder = new SessionBuilder(
            createStorage({ getIdentityKeyPair: jest.fn().mockResolvedValue(undefined) }),
            address
        );
        await expect(
            builder.startSessionAsInitiator(createKeyPair(), createBuffer(1, 32), createBuffer(2, 32), undefined)
        ).rejects.toThrow('No identity key. Cannot initiate session.');
    });

    test('startSessionAsInitiator rejects when signed prekey is undefined', async () => {
        const builder = new SessionBuilder(createStorage(), address);
        await expect(
            builder.startSessionAsInitiator(
                createKeyPair(),
                createBuffer(1, 32),
                undefined as unknown as ArrayBuffer,
                undefined
            )
        ).rejects.toThrow('theirSignedPubKey is undefined. Cannot proceed with ECDHE');
    });

    test('startSessionWthPreKeyMessage rejects when identity key missing', async () => {
        const builder = new SessionBuilder(
            createStorage({ getIdentityKeyPair: jest.fn().mockResolvedValue(undefined) }),
            address
        );

        const message = {
            identityKey: createUint8(7, 32),
            baseKey: createUint8(8, 32),
            message: createUint8(9, 10),
            signedPreKeyId: 1,
            registrationId: 2,
        } as unknown as PreKeyWhisperMessage;

        await expect(builder.startSessionWthPreKeyMessage(undefined, createKeyPair(), message)).rejects.toThrow(
            'No identity key. Cannot initiate session.'
        );
    });

    test('calculateSendingRatchet rejects when ephemeral key missing', async () => {
        const builder = new SessionBuilder(createStorage(), address);
        const session: SessionType = {
            registrationId: 1,
            currentRatchet: {
                rootKey: createBuffer(1, 32),
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
            },
            indexInfo: {
                remoteIdentityKey: createBuffer(3, 32),
                closed: -1,
            },
            oldRatchetList: [],
            chains: {},
        };

        await expect(builder.calculateSendingRatchet(session, createBuffer(4, 32))).rejects.toThrow(
            'Invalid ratchet - ephemeral key pair is missing'
        );
    });

    test('calculateSendingRatchet rejects when keys are missing', async () => {
        const builder = new SessionBuilder(createStorage(), address);
        const session: SessionType = {
            registrationId: 1,
            currentRatchet: {
                rootKey: undefined as unknown as ArrayBuffer,
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
                ephemeralKeyPair: {
                    pubKey: createBuffer(5, 32),
                    privKey: undefined as unknown as ArrayBuffer,
                },
            },
            indexInfo: {
                remoteIdentityKey: createBuffer(3, 32),
                closed: -1,
            },
            oldRatchetList: [],
            chains: {},
        };

        await expect(builder.calculateSendingRatchet(session, createBuffer(4, 32))).rejects.toThrow(
            'Missing key, cannot calculate sending ratchet'
        );
    });

    test('processV3 returns early when session already exists', async () => {
        const baseKeyBuffer = createBuffer(11, 32);
        const baseKeyBytes = new Uint8Array(baseKeyBuffer);
        const builder = new SessionBuilder(createStorage(), address);
        const record = new SessionRecord();
        const session: SessionType = {
            registrationId: 9,
            currentRatchet: {
                rootKey: createBuffer(1, 32),
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
            },
            indexInfo: {
                remoteIdentityKey: createBuffer(3, 32),
                baseKey: baseKeyBuffer,
                baseKeyType: BaseKeyType.THEIRS,
                closed: -1,
            },
            oldRatchetList: [],
            chains: {},
        };
        record.updateSessionState(session);

        const message = {
            identityKey: createUint8(7, 32),
            baseKey: baseKeyBytes,
            message: createUint8(9, 8),
            signedPreKeyId: 3,
            registrationId: 4,
        } as unknown as PreKeyWhisperMessage;

        const result = await builder.processV3(record, message);
        expect(result).toBeUndefined();
    });

    test('processV3 returns when signed prekey missing but session present', async () => {
        const builder = new SessionBuilder(
            createStorage({
                loadSignedPreKey: jest.fn().mockResolvedValue(undefined),
            }),
            address
        );
        const record = new SessionRecord();
        const session: SessionType = {
            registrationId: 9,
            currentRatchet: {
                rootKey: createBuffer(1, 32),
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
                ephemeralKeyPair: createKeyPair(),
            },
            indexInfo: {
                remoteIdentityKey: createBuffer(3, 32),
                baseKey: createBuffer(12, 32),
                baseKeyType: BaseKeyType.THEIRS,
                closed: -1,
            },
            oldRatchetList: [],
            chains: {},
        };
        record.updateSessionState(session);

        const message = {
            identityKey: createUint8(7, 32),
            baseKey: createUint8(8, 32),
            message: createUint8(9, 8),
            signedPreKeyId: 3,
            registrationId: 4,
        } as unknown as PreKeyWhisperMessage;

        const result = await builder.processV3(record, message);
        expect(result).toBeUndefined();
    });

    test('processV3 throws when signed prekey missing and no open session', async () => {
        const builder = new SessionBuilder(
            createStorage({
                loadSignedPreKey: jest.fn().mockResolvedValue(undefined),
                loadPreKey: jest.fn().mockResolvedValue(undefined),
            }),
            address
        );
        const record = new SessionRecord();
        const message = {
            identityKey: createUint8(7, 32),
            baseKey: createUint8(8, 32),
            message: createUint8(9, 8),
            signedPreKeyId: 3,
            registrationId: 4,
        } as unknown as PreKeyWhisperMessage;

        await expect(builder.processV3(record, message)).rejects.toThrow(
            'Missing Signed PreKey for PreKeyWhisperMessage'
        );
    });
});
