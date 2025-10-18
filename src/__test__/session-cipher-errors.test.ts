import { SessionCipher } from '../session-cipher';
import { SessionBuilder } from '../session-builder';
import { SessionRecord } from '../session-record';
import { ChainType, SessionType, BaseKeyType, Chain } from '../session-types';
import { StorageType, KeyPairType } from '../types';
import { PreKeyWhisperMessage, WhisperMessage } from '../protobuf/wire';
import * as base64 from 'base64-js';
import * as Internal from '../internal';
import { setLogger } from '../logger';

const createBuffer = (fill: number, length: number): ArrayBuffer => {
    const array = new Uint8Array(length);
    array.fill(fill);
    return array.buffer;
};

const createKeyPair = (fill = 7): KeyPairType => ({
    pubKey: createBuffer(fill, 32),
    privKey: createBuffer(fill + 1, 32),
});

const createStorage = (overrides: Partial<StorageType> = {}): StorageType => ({
    getIdentityKeyPair: jest.fn().mockResolvedValue(undefined),
    getLocalRegistrationId: jest.fn().mockResolvedValue(undefined),
    isTrustedIdentity: jest.fn().mockResolvedValue(true),
    saveIdentity: jest.fn().mockResolvedValue(true),
    loadPreKey: jest.fn().mockResolvedValue(undefined),
    storePreKey: jest.fn().mockResolvedValue(undefined),
    removePreKey: jest.fn().mockResolvedValue(undefined),
    storeSession: jest.fn().mockResolvedValue(undefined),
    loadSession: jest.fn().mockResolvedValue(undefined),
    loadSignedPreKey: jest.fn().mockResolvedValue(undefined),
    storeSignedPreKey: jest.fn().mockResolvedValue(undefined),
    removeSignedPreKey: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

const createRecordWithSession = (
    options: Partial<SessionType> = {},
    chain?: { type: ChainType; hasKey?: boolean; keyValue?: ArrayBuffer }
): { record: SessionRecord; session: SessionType; chainKey?: string } => {
    const baseKey = createBuffer(3, 32);
    const remoteIdentity = createBuffer(4, 32);
    const session: SessionType = {
        registrationId: 42,
        currentRatchet: {
            rootKey: createBuffer(5, 32),
            lastRemoteEphemeralKey: createBuffer(6, 32),
            previousCounter: 0,
            ...(options.currentRatchet ?? {}),
        },
        indexInfo: {
            remoteIdentityKey: remoteIdentity,
            baseKey,
            baseKeyType: BaseKeyType.OURS,
            closed: -1,
            ...(options.indexInfo ?? {}),
        },
        oldRatchetList: [],
        chains: {},
        ...options,
    };

    let chainKey: string | undefined;
    if (chain) {
        const pub = session.currentRatchet.ephemeralKeyPair?.pubKey ?? createBuffer(8, 32);
        const key = base64.fromByteArray(new Uint8Array(pub));
        session.chains[key] = {
            chainType: chain.type,
            chainKey: {
                counter: 0,
                key:
                    chain.hasKey === false
                        ? undefined
                        : chain.keyValue === undefined
                          ? createBuffer(9, 32)
                          : chain.keyValue,
            },
            messageKeys: {},
        };
        chainKey = key;
    }

    const record = new SessionRecord();
    record.updateSessionState(session);
    return { record, session, chainKey };
};

const createPreKeyPayload = (
    overrides: Partial<Parameters<typeof PreKeyWhisperMessage.create>[0]> = {}
): ArrayBuffer => {
    const message = PreKeyWhisperMessage.create({
        registrationId: 9,
        baseKey: new Uint8Array(32).fill(3),
        identityKey: new Uint8Array(32).fill(4),
        message: new Uint8Array([0x05]),
        ...overrides,
    });
    const encoded = PreKeyWhisperMessage.encode(message).finish();
    const bytes = new Uint8Array(1 + encoded.length);
    bytes[0] = 0x33;
    bytes.set(encoded, 1);
    return bytes.buffer;
};

describe('SessionCipher error handling', () => {
    const address = 'device.1';

    beforeEach(() => {
        setLogger({
            warn: jest.fn(),
            error: jest.fn(),
        });
    });

    afterEach(() => {
        setLogger();
    });

    test('encryptJob rejects non ArrayBuffer payloads', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        await expect((cipher as any).encryptJob('oops')).rejects.toThrow('Expected buffer to be an ArrayBuffer');
    });

    test('encryptJob rejects when session record is missing', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const identity = createKeyPair();
        (cipher as any).loadKeysAndRecord = jest.fn().mockResolvedValue([identity, 1, undefined]);
        await expect((cipher as any).encryptJob(createBuffer(1, 4))).rejects.toThrow('No record for device.1');
    });

    test('encryptJob rejects when identity key missing', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const record = new SessionRecord();
        (cipher as any).loadKeysAndRecord = jest.fn().mockResolvedValue([undefined, 1, record]);
        await expect((cipher as any).encryptJob(createBuffer(1, 4))).rejects.toThrow(
            'cannot encrypt without identity key'
        );
    });

    test('prepareChain rejects when there is no open session', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const msg = WhisperMessage.create();
        await expect((cipher as any).prepareChain(address, new SessionRecord(), msg)).rejects.toThrow(
            `No session to encrypt message for ${address}`
        );
    });

    test('prepareChain rejects when ephemeral key pair is missing', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const { record } = createRecordWithSession({
            currentRatchet: {
                rootKey: createBuffer(1, 32),
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
            },
        });
        const msg = WhisperMessage.create();
        await expect((cipher as any).prepareChain(address, record, msg)).rejects.toThrow(
            'ratchet missing ephemeralKeyPair'
        );
    });

    test('prepareChain rejects when encrypting on receiving chain', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const eph = createKeyPair();
        const { record, chainKey } = createRecordWithSession(
            {
                currentRatchet: {
                    rootKey: createBuffer(1, 32),
                    lastRemoteEphemeralKey: createBuffer(2, 32),
                    previousCounter: 0,
                    ephemeralKeyPair: eph,
                },
            },
            { type: ChainType.RECEIVING }
        );
        const msg = WhisperMessage.create();
        if (chainKey) {
            msg.ratchetKey = new Uint8Array(eph.pubKey);
        }
        await expect((cipher as any).prepareChain(address, record, msg)).rejects.toThrow(
            'Tried to encrypt on a receiving chain'
        );
    });

    test('fillMessageKeys guards against large future counters', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const chain = {
            chainType: ChainType.SENDING,
            chainKey: { counter: 0, key: createBuffer(1, 32) },
            messageKeys: {},
        };
        await expect((cipher as any).fillMessageKeys(chain, 2500)).rejects.toThrow(
            'Over 2000 messages into the future!'
        );
    });

    test('fillMessageKeys rejects closed chains', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const chain = {
            chainType: ChainType.SENDING,
            chainKey: { counter: 0, key: undefined },
            messageKeys: {},
        };
        await expect((cipher as any).fillMessageKeys(chain, 1)).rejects.toThrow(
            'Got invalid request to extend chain after it was already closed'
        );
    });

    test('fillMessageKeys rejects missing chain keys', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const chain: any = {
            chainType: ChainType.SENDING,
            chainKey: { counter: 0, key: null },
            messageKeys: {},
        };
        await expect((cipher as any).fillMessageKeys(chain as Chain<ArrayBuffer>, 1)).rejects.toThrow(
            'chain key is missing'
        );
    });

    test('calculateRatchet rejects when ephemeral key is missing', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const { session } = createRecordWithSession({
            currentRatchet: {
                rootKey: createBuffer(1, 32),
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
                ephemeralKeyPair: undefined,
            },
        });

        await expect((cipher as any).calculateRatchet(session, createBuffer(3, 32), true)).rejects.toThrow(
            'currentRatchet has no ephemeral key'
        );
    });

    test('decryptWithSessionList rejects when list is empty', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        await expect((cipher as any).decryptWithSessionList(new ArrayBuffer(0), [], [])).rejects.toBeUndefined();
    });

    test('decryptWithSessionList rejects when popped session missing', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const errors = [new Error('first failure')];
        await expect(
            (cipher as any).decryptWithSessionList(new ArrayBuffer(0), [undefined as any], errors)
        ).rejects.toBe(errors[0]);
    });

    test('decryptPreKeyWhisperMessage rejects unsupported encodings', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        await expect(cipher.decryptPreKeyWhisperMessage(new ArrayBuffer(0), 'hex')).rejects.toThrow(
            'unsupported encoding: hex'
        );
    });

    test('decryptPreKeyWhisperMessage rejects incompatible versions', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const payload = new Uint8Array([0x34]); // min version 4 triggers incompatibility
        await expect(cipher.decryptPreKeyWhisperMessage(payload.buffer)).rejects.toThrow(
            'Incompatible version number on PreKeyWhisperMessage'
        );
    });

    test('decryptPreKeyWhisperMessage rejects when registrationId missing', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const decoded = PreKeyWhisperMessage.create({
            baseKey: new Uint8Array(32).fill(1),
            identityKey: new Uint8Array(32).fill(2),
            message: new Uint8Array([0x01, 0x02]),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (decoded as any).registrationId;
        const decodeSpy = jest.spyOn(PreKeyWhisperMessage, 'decode').mockReturnValue(decoded);
        const payload = new Uint8Array([0x33]);
        await expect(cipher.decryptPreKeyWhisperMessage(payload.buffer)).rejects.toThrow('No registrationId');
        decodeSpy.mockRestore();
    });

    test('decryptPreKeyWhisperMessage rejects when builder leaves required fields missing', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        (cipher as any).getRecord = jest.fn().mockResolvedValue(new SessionRecord());
        const spy = jest.spyOn(SessionBuilder.prototype, 'processV3').mockImplementation(async (_record, message) => {
            message.baseKey = undefined;
            return undefined;
        });
        const encoded = PreKeyWhisperMessage.encode(
            PreKeyWhisperMessage.create({
                registrationId: 9,
                baseKey: new Uint8Array(32).fill(3),
                identityKey: new Uint8Array(32).fill(4),
                message: new Uint8Array([0x05]),
            })
        ).finish();
        const bytes = new Uint8Array(1 + encoded.length);
        bytes[0] = 0x33;
        bytes.set(encoded, 1);
        await expect(cipher.decryptPreKeyWhisperMessage(bytes.buffer)).rejects.toThrow(
            'PreKeySignalMessage missing required fields'
        );
        spy.mockRestore();
    });

    test('decryptWithSessionList retries after non-counter failure', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const { session: first } = createRecordWithSession();
        const { session: second } = createRecordWithSession({
            indexInfo: {
                ...createRecordWithSession().session.indexInfo,
                baseKey: createBuffer(7, 32),
                baseKeyType: BaseKeyType.OURS,
            },
        });
        const spy = jest.spyOn(
            SessionCipher.prototype as unknown as {
                doDecryptWhisperMessage: (...args: unknown[]) => Promise<ArrayBuffer>;
            },
            'doDecryptWhisperMessage'
        );
        spy.mockImplementationOnce(() => Promise.reject(new Error('transient')));
        spy.mockImplementationOnce(() => Promise.resolve(new ArrayBuffer(0)));
        const result = await (cipher as any).decryptWithSessionList(new ArrayBuffer(0), [first, second], []);
        expect(result.session).toEqual(second);
        expect(spy).toHaveBeenCalledTimes(2);
        spy.mockRestore();
    });

    test('maybeStepRatchet rejects missing remote key', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const { session } = createRecordWithSession({
            currentRatchet: {
                rootKey: createBuffer(1, 32),
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
                ephemeralKeyPair: createKeyPair(),
            },
        });
        await expect((cipher as any).maybeStepRatchet(session, undefined, 0)).rejects.toThrow(
            'Signal message missing ratchet key'
        );
    });

    test('decryptWithSessionList propagates MessageCounterError without retries', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const err = new Error('missing key');
        err.name = 'MessageCounterError';
        jest.spyOn(
            SessionCipher.prototype as unknown as {
                doDecryptWhisperMessage: (...args: unknown[]) => Promise<ArrayBuffer>;
            },
            'doDecryptWhisperMessage'
        ).mockRejectedValue(err);
        const { session } = createRecordWithSession();
        await expect((cipher as any).decryptWithSessionList(new ArrayBuffer(0), [session], [])).rejects.toBe(err);
        jest.restoreAllMocks();
    });

    test('decryptWhisperMessage promotes new session when base key differs', async () => {
        const storage = createStorage({
            isTrustedIdentity: jest.fn().mockResolvedValue(true),
            saveIdentity: jest.fn().mockResolvedValue(true),
            storeSession: jest.fn(),
        });
        const cipher = new SessionCipher(storage, address);
        const openSession = createRecordWithSession().session;
        const promotedSession = {
            ...openSession,
            indexInfo: {
                ...openSession.indexInfo,
                baseKey: createBuffer(99, 32),
            },
        };
        const record = {
            getSessions: jest.fn().mockReturnValue([promotedSession]),
            getOpenSession: jest.fn().mockReturnValue(openSession),
            archiveCurrentState: jest.fn(),
            promoteState: jest.fn(),
            updateSessionState: jest.fn(),
            serialize: jest.fn().mockReturnValue('serialized'),
        } as unknown as SessionRecord;
        jest.spyOn(
            cipher as unknown as { getRecord(a: string): Promise<SessionRecord | undefined> },
            'getRecord'
        ).mockResolvedValue(record);
        jest.spyOn(
            SessionCipher.prototype as unknown as {
                decryptWithSessionList: (
                    ...args: unknown[]
                ) => Promise<{ plaintext: ArrayBuffer; session: SessionType }>;
            },
            'decryptWithSessionList'
        ).mockResolvedValue({ plaintext: new ArrayBuffer(0), session: promotedSession });

        await cipher.decryptWhisperMessage(new ArrayBuffer(0));
        expect(record.archiveCurrentState).toHaveBeenCalled();
        expect(record.promoteState).toHaveBeenCalledWith(promotedSession);
        jest.restoreAllMocks();
    });

    test('decryptWhisperMessage rejects when no record is stored', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        jest.spyOn(
            cipher as unknown as { getRecord(a: string): Promise<SessionRecord | undefined> },
            'getRecord'
        ).mockResolvedValue(undefined);

        await expect(cipher.decryptWhisperMessage(new ArrayBuffer(0))).rejects.toThrow('No record for device');
        jest.restoreAllMocks();
    });

    test('doDecryptWhisperMessage rejects incompatible whisper version', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const { session } = createRecordWithSession();
        const payload = new Uint8Array(9);
        payload[0] = 0x44; // min version 4 (>3)

        await expect((cipher as any).doDecryptWhisperMessage(payload.buffer, session)).rejects.toThrow(
            'Incompatible version number on WhisperMessage'
        );
    });

    test('doDecryptWhisperMessage rejects when session is undefined', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        const ratchetKey = new Uint8Array(32).fill(5);
        const whisperMessage = WhisperMessage.create({
            ratchetKey,
            previousCounter: 0,
            counter: 1,
            ciphertext: new Uint8Array([1]),
        });
        const encoded = WhisperMessage.encode(whisperMessage).finish();
        const payload = new Uint8Array(1 + encoded.length + 8);
        payload[0] = 0x33;
        payload.set(encoded, 1);

        await expect((cipher as any).doDecryptWhisperMessage(payload.buffer, undefined)).rejects.toThrow(
            'No session found to decrypt message from device.1'
        );
    });

    test('decryptPreKeyWhisperMessage rejects when session is missing for base key', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        jest.spyOn(SessionBuilder.prototype, 'processV3').mockResolvedValue(5);
        jest.spyOn(SessionRecord.prototype, 'getSessionByBaseKey').mockReturnValue(undefined as unknown as SessionType);

        const payload = createPreKeyPayload();
        await expect(cipher.decryptPreKeyWhisperMessage(payload)).rejects.toThrow(
            'unable to find session for base key'
        );

        jest.restoreAllMocks();
    });

    test('decryptPreKeyWhisperMessage removes pre-key when builder returns id', async () => {
        const removePreKey = jest.fn().mockResolvedValue(undefined);
        const storage = createStorage({
            removePreKey,
            storeSession: jest.fn(),
        });
        const cipher = new SessionCipher(storage, address);
        const session: SessionType = {
            registrationId: 1,
            currentRatchet: {
                rootKey: createBuffer(1, 32),
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
            },
            indexInfo: {
                remoteIdentityKey: createBuffer(3, 32),
                baseKey: createBuffer(4, 32),
                baseKeyType: BaseKeyType.OURS,
                closed: -1,
            },
            chains: {},
            oldRatchetList: [],
        };
        const record = {
            getSessionByBaseKey: jest.fn().mockReturnValue(session),
            updateSessionState: jest.fn(),
            serialize: jest.fn().mockReturnValue('serialized'),
        } as unknown as SessionRecord;

        jest.spyOn(
            cipher as unknown as { getRecord(address: string): Promise<SessionRecord | undefined> },
            'getRecord'
        ).mockResolvedValue(record);
        jest.spyOn(SessionBuilder.prototype, 'processV3').mockResolvedValue(12);
        jest.spyOn(
            SessionCipher.prototype as unknown as { doDecryptWhisperMessage: () => Promise<ArrayBuffer> },
            'doDecryptWhisperMessage'
        ).mockResolvedValue(new ArrayBuffer(0));

        await cipher.decryptPreKeyWhisperMessage(createPreKeyPayload());
        expect(removePreKey).toHaveBeenCalledWith(12);

        jest.restoreAllMocks();
    });

    test('doDecryptWhisperMessage rejects when decrypting on sending chain', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        jest.spyOn(
            SessionCipher.prototype as unknown as { maybeStepRatchet: (...args: unknown[]) => Promise<void> },
            'maybeStepRatchet'
        ).mockResolvedValue(undefined);

        const { session, chainKey } = createRecordWithSession(
            {
                currentRatchet: {
                    rootKey: createBuffer(1, 32),
                    lastRemoteEphemeralKey: createBuffer(2, 32),
                    previousCounter: 0,
                    ephemeralKeyPair: createKeyPair(),
                },
            },
            { type: ChainType.SENDING }
        );
        const ratchetBytes = base64.toByteArray(chainKey as string);
        const whisperMessage = WhisperMessage.create({
            ratchetKey: ratchetBytes,
            previousCounter: 0,
            counter: 0,
            ciphertext: new Uint8Array([1]),
        });
        const encoded = WhisperMessage.encode(whisperMessage).finish();
        const payload = new Uint8Array(1 + encoded.length + 8);
        payload[0] = 0x33;
        payload.set(encoded, 1);
        payload.set(new Uint8Array(8), 1 + encoded.length);

        await expect((cipher as any).doDecryptWhisperMessage(payload.buffer, session)).rejects.toThrow(
            'Tried to decrypt on a sending chain'
        );
        jest.restoreAllMocks();
    });

    test('doDecryptWhisperMessage rejects when counter is missing', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        jest.spyOn(
            SessionCipher.prototype as unknown as { maybeStepRatchet: (...args: unknown[]) => Promise<void> },
            'maybeStepRatchet'
        ).mockResolvedValue(undefined);

        const ratchetKey = new Uint8Array(32);
        const ratchetKeyString = base64.fromByteArray(ratchetKey);
        const session: SessionType = {
            registrationId: 1,
            currentRatchet: {
                rootKey: createBuffer(1, 32),
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
                ephemeralKeyPair: createKeyPair(),
            },
            indexInfo: {
                remoteIdentityKey: createBuffer(3, 32),
                baseKey: createBuffer(4, 32),
                baseKeyType: BaseKeyType.OURS,
                closed: -1,
            },
            chains: {
                [ratchetKeyString]: {
                    chainType: ChainType.RECEIVING,
                    chainKey: { counter: 0, key: createBuffer(6, 32) },
                    messageKeys: {},
                },
            },
            oldRatchetList: [],
        };
        const payload = new Uint8Array(9);
        payload[0] = 0x33;
        const decodeSpy = jest.spyOn(WhisperMessage, 'decode').mockReturnValue({
            ratchetKey,
            previousCounter: 0,
        } as unknown as WhisperMessage);

        await expect((cipher as any).doDecryptWhisperMessage(payload.buffer, session)).rejects.toThrow(
            'SignalMessage missing counter'
        );
        decodeSpy.mockRestore();
        jest.restoreAllMocks();
    });

    test('doDecryptWhisperMessage rejects when ciphertext is missing', async () => {
        const identityKey = {
            pubKey: createBuffer(11, 32),
            privKey: createBuffer(12, 32),
        };
        const storage = createStorage({
            getIdentityKeyPair: jest.fn().mockResolvedValue(identityKey),
        });
        const cipher = new SessionCipher(storage, address);
        jest.spyOn(
            SessionCipher.prototype as unknown as { maybeStepRatchet: (...args: unknown[]) => Promise<void> },
            'maybeStepRatchet'
        ).mockResolvedValue(undefined);
        const fillMessageKeys = jest
            .spyOn(
                cipher as unknown as { fillMessageKeys: (chain: Chain<ArrayBuffer>, counter: number) => Promise<void> },
                'fillMessageKeys'
            )
            .mockImplementation(async () => undefined);

        const ratchetKey = new Uint8Array(32).fill(7);
        const ratchetKeyString = base64.fromByteArray(ratchetKey);
        const messageKey = createBuffer(20, 32);
        const session: SessionType = {
            registrationId: 5,
            currentRatchet: {
                rootKey: createBuffer(1, 32),
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
                ephemeralKeyPair: createKeyPair(),
            },
            indexInfo: {
                remoteIdentityKey: createBuffer(3, 32),
                baseKey: createBuffer(4, 32),
                baseKeyType: BaseKeyType.OURS,
                closed: -1,
            },
            chains: {
                [ratchetKeyString]: {
                    chainType: ChainType.RECEIVING,
                    chainKey: { counter: 0, key: createBuffer(5, 32) },
                    messageKeys: { 1: messageKey },
                },
            },
            oldRatchetList: [],
        };

        const whisperMessage = WhisperMessage.create({
            ratchetKey,
            previousCounter: 0,
            counter: 1,
        });
        const encoded = WhisperMessage.encode(whisperMessage).finish();

        const keys = await Internal.HKDF(messageKey, new ArrayBuffer(32), 'WhisperMessageKeys');
        const macInput = new Uint8Array(encoded.length + 33 * 2 + 1);
        macInput.set(new Uint8Array(session.indexInfo.remoteIdentityKey));
        macInput.set(new Uint8Array(identityKey.pubKey), 33);
        macInput[33 * 2] = (3 << 4) | 3;
        macInput.set(encoded, 33 * 2 + 1);
        const fullMac = new Uint8Array(await Internal.crypto.sign(keys[1], macInput.buffer));
        const mac = fullMac.slice(0, 8);

        const payload = new Uint8Array(1 + encoded.length + 8);
        payload[0] = 0x33;
        payload.set(encoded, 1);
        payload.set(mac, 1 + encoded.length);

        await expect((cipher as any).doDecryptWhisperMessage(payload.buffer, session)).rejects.toThrow(
            'SignalMessage missing ciphertext'
        );

        fillMessageKeys.mockRestore();
        jest.restoreAllMocks();
    });

    test('doDecryptWhisperMessage rejects when ratchet key is missing', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        jest.spyOn(
            SessionCipher.prototype as unknown as { maybeStepRatchet: (...args: unknown[]) => Promise<void> },
            'maybeStepRatchet'
        ).mockResolvedValue(undefined);
        const decodeSpy = jest.spyOn(WhisperMessage, 'decode').mockReturnValue({
            previousCounter: 0,
            counter: 1,
        } as unknown as WhisperMessage);
        const payload = new Uint8Array(9);
        payload[0] = 0x33;
        const { session } = createRecordWithSession();
        await expect((cipher as any).doDecryptWhisperMessage(payload.buffer, session)).rejects.toThrow(
            'SignalMessage missing ratchet key'
        );
        decodeSpy.mockRestore();
        jest.restoreAllMocks();
    });

    test('doDecryptWhisperMessage rejects when message key is missing', async () => {
        const cipher = new SessionCipher(createStorage(), address);
        jest.spyOn(
            SessionCipher.prototype as unknown as { maybeStepRatchet: (...args: unknown[]) => Promise<void> },
            'maybeStepRatchet'
        ).mockResolvedValue(undefined);
        const fillMessageKeys = jest
            .spyOn(
                cipher as unknown as { fillMessageKeys: (chain: Chain<ArrayBuffer>, counter: number) => Promise<void> },
                'fillMessageKeys'
            )
            .mockImplementation(async () => undefined);
        const { session, chainKey } = createRecordWithSession(
            {
                currentRatchet: {
                    rootKey: createBuffer(1, 32),
                    lastRemoteEphemeralKey: createBuffer(2, 32),
                    previousCounter: 0,
                    ephemeralKeyPair: createKeyPair(),
                },
            },
            { type: ChainType.RECEIVING }
        );
        const ratchetBytes = base64.toByteArray(chainKey as string);
        const whisperMessage = WhisperMessage.create({
            ratchetKey: ratchetBytes,
            previousCounter: 0,
            counter: 5,
            ciphertext: new Uint8Array([1]),
        });
        const encoded = WhisperMessage.encode(whisperMessage).finish();
        const payload = new Uint8Array(1 + encoded.length + 8);
        payload[0] = 0x33;
        payload.set(encoded, 1);
        payload.set(new Uint8Array(8), 1 + encoded.length);

        const err = await (cipher as any).doDecryptWhisperMessage(payload.buffer, session).catch((e: Error) => e);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).name).toBe('MessageCounterError');
        fillMessageKeys.mockRestore();
        jest.restoreAllMocks();
    });

    test('doDecryptWhisperMessage rejects when identity key is missing', async () => {
        const storage = createStorage({
            getIdentityKeyPair: jest.fn().mockResolvedValue(undefined),
        });
        const cipher = new SessionCipher(storage, address);
        jest.spyOn(
            SessionCipher.prototype as unknown as { maybeStepRatchet: (...args: unknown[]) => Promise<void> },
            'maybeStepRatchet'
        ).mockResolvedValue(undefined);
        const fillMessageKeys = jest
            .spyOn(
                cipher as unknown as { fillMessageKeys: (chain: Chain<ArrayBuffer>, counter: number) => Promise<void> },
                'fillMessageKeys'
            )
            .mockImplementation(async () => undefined);

        const messageKey = createBuffer(15, 32);
        const ratchetKey = new Uint8Array(32).fill(6);
        const ratchetKeyString = base64.fromByteArray(ratchetKey);
        const session: SessionType = {
            registrationId: 1,
            currentRatchet: {
                rootKey: createBuffer(1, 32),
                lastRemoteEphemeralKey: createBuffer(2, 32),
                previousCounter: 0,
                ephemeralKeyPair: createKeyPair(),
            },
            indexInfo: {
                remoteIdentityKey: createBuffer(3, 32),
                baseKey: createBuffer(4, 32),
                baseKeyType: BaseKeyType.OURS,
                closed: -1,
            },
            chains: {
                [ratchetKeyString]: {
                    chainType: ChainType.RECEIVING,
                    chainKey: { counter: 0, key: createBuffer(5, 32) },
                    messageKeys: { 1: messageKey },
                },
            },
            oldRatchetList: [],
        };

        const whisperMessage = WhisperMessage.create({
            ratchetKey,
            previousCounter: 0,
            counter: 1,
            ciphertext: new Uint8Array([1]),
        });
        const encoded = WhisperMessage.encode(whisperMessage).finish();
        const payload = new Uint8Array(1 + encoded.length + 8);
        payload[0] = 0x33;
        payload.set(encoded, 1);
        payload.set(new Uint8Array(8), 1 + encoded.length);

        await expect((cipher as any).doDecryptWhisperMessage(payload.buffer, session)).rejects.toThrow(
            'Our identity key is missing. Cannot decrypt.'
        );
        fillMessageKeys.mockRestore();
        jest.restoreAllMocks();
    });

    test('decryptWhisperMessage rejects unsupported encodings', () => {
        const cipher = new SessionCipher(createStorage(), address);
        expect(() => cipher.decryptWhisperMessage(new ArrayBuffer(0), 'utf8')).toThrow('unsupported encoding: utf8');
    });

    test('closeOpenSessionForDevice is no-op when no record exists', async () => {
        const storage = createStorage({
            storeSession: jest.fn(),
        });
        const cipher = new SessionCipher(storage, address);
        jest.spyOn(
            cipher as unknown as { getRecord(a: string): Promise<SessionRecord | undefined> },
            'getRecord'
        ).mockResolvedValue(undefined);
        await cipher.closeOpenSessionForDevice();
        expect(storage.storeSession).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });

    test('deleteAllSessionsForDevice clears record when present', async () => {
        const storeSession = jest.fn().mockResolvedValue(undefined);
        const storage = createStorage({
            storeSession,
        });
        const cipher = new SessionCipher(storage, address);
        const record = new SessionRecord();
        jest.spyOn(
            cipher as unknown as { getRecord(a: string): Promise<SessionRecord | undefined> },
            'getRecord'
        ).mockResolvedValue(record);
        const deleteSpy = jest.spyOn(record, 'deleteAllSessions').mockImplementation(() => undefined);
        await cipher.deleteAllSessionsForDevice();
        expect(deleteSpy).toHaveBeenCalled();
        expect(storeSession).toHaveBeenCalled();
        jest.restoreAllMocks();
    });
});
