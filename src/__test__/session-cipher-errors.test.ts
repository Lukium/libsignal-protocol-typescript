import { SessionCipher } from '../session-cipher';
import { SessionBuilder } from '../session-builder';
import { SessionRecord } from '../session-record';
import { ChainType, SessionType, BaseKeyType, Chain } from '../session-types';
import { StorageType, KeyPairType } from '../types';
import { PreKeyWhisperMessage, WhisperMessage } from '../protobuf/wire';
import * as base64 from 'base64-js';

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

describe('SessionCipher error handling', () => {
    const address = 'device.1';

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
});
