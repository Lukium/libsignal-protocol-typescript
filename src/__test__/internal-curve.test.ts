import * as Internal from '../internal/curve';
import {
    AsyncCurve as AsyncCurveType,
    Curve as CurveType,
    Curve25519Wrapper,
} from '@privacyresearch/curve25519-typescript';

const createBuffer = (length: number, fill = 1): ArrayBuffer => {
    const array = new Uint8Array(length);
    array.fill(fill);
    return array.buffer;
};

describe('Internal Curve wrapper', () => {
    const privKey = createBuffer(32);
    const message = createBuffer(16);
    const signature = createBuffer(64);

    let sharedSecretMock: jest.Mock;
    let signMock: jest.Mock;
    let verifyMock: jest.Mock;
    let keyPairMock: jest.Mock;

    beforeEach(() => {
        sharedSecretMock = jest.fn().mockReturnValue(createBuffer(32, 7));
        signMock = jest.fn().mockReturnValue(signature);
        verifyMock = jest.fn().mockReturnValue(false);
        keyPairMock = jest.fn().mockReturnValue({ pubKey: createBuffer(32, 5), privKey });
    });

    const buildCurve = (): Internal.Curve => {
        const curve = new Internal.Curve({} as unknown as Curve25519Wrapper);
        curve.curve = {
            keyPair: keyPairMock,
            sharedSecret: sharedSecretMock,
            sign: signMock,
            verify: verifyMock,
        } as unknown as CurveType;
        return curve;
    };

    const buildAsyncCurve = (overrides: Partial<AsyncCurveType> = {}): Internal.AsyncCurve => {
        const asyncCurve = new Internal.AsyncCurve();
        asyncCurve.curve = {
            keyPair: jest.fn(),
            sharedSecret: jest.fn().mockResolvedValue(createBuffer(32, 7)),
            sign: jest.fn().mockResolvedValue(signature),
            verify: jest.fn().mockResolvedValue(false),
            ...overrides,
        } as unknown as AsyncCurveType;
        return asyncCurve;
    };

    test('createKeyPair throws when private key invalid', () => {
        const curve = buildCurve();

        expect(() => curve.createKeyPair(createBuffer(31))).toThrow('Invalid private key');
    });

    test('ECDHE strips version byte and enforces length', () => {
        const curve = buildCurve();

        const versionedPubKey = createBuffer(33);
        new Uint8Array(versionedPubKey)[0] = 5;

        curve.ECDHE(versionedPubKey, privKey);
        expect(sharedSecretMock).toHaveBeenCalledWith(expect.any(ArrayBuffer), privKey);
        const calledPubKey = sharedSecretMock.mock.calls[0][0] as ArrayBuffer;
        expect((calledPubKey as ArrayBuffer).byteLength).toBe(32);

        const rawPubKey = createBuffer(32);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        curve.ECDHE(rawPubKey, privKey);
        expect(sharedSecretMock).toHaveBeenCalledWith(rawPubKey, privKey);
        errorSpy.mockRestore();
    });

    test('ECDHE rejects malformed pubkey', () => {
        const curve = buildCurve();

        const malformed = createBuffer(33);
        new Uint8Array(malformed)[0] = 4;
        expect(() => curve.ECDHE(malformed, privKey)).toThrow('Invalid public key');
    });

    test('Ed25519Sign rejects missing message', () => {
        const curve = buildCurve();

        expect(() => curve.Ed25519Sign(privKey, undefined as unknown as ArrayBuffer)).toThrow('Invalid message');
    });

    test('Ed25519Verify enforces signature length', () => {
        const curve = buildCurve();

        const rawPubKey = createBuffer(32);
        expect(() => curve.Ed25519Verify(rawPubKey, message, createBuffer(10))).toThrow('Invalid signature');
    });

    test('Ed25519Verify rejects missing message', () => {
        const curve = buildCurve();

        const rawPubKey = createBuffer(32);
        expect(() => curve.Ed25519Verify(rawPubKey, undefined as unknown as ArrayBuffer, signature)).toThrow(
            'Invalid message'
        );
    });

    test('Ed25519Verify rejects missing signature buffer', () => {
        const curve = buildCurve();

        const rawPubKey = createBuffer(32);
        expect(() => curve.Ed25519Verify(rawPubKey, message, undefined as unknown as ArrayBuffer)).toThrow(
            'Invalid signature'
        );
    });

    test('Async verify throws when backend returns true', async () => {
        const asyncCurve = buildAsyncCurve({ verify: jest.fn().mockResolvedValue(true) });

        const pubKey = createBuffer(33);
        new Uint8Array(pubKey)[0] = 5;

        await expect(asyncCurve.Ed25519Verify(pubKey, message, signature)).rejects.toThrow('Invalid signature');
    });

    test('Async ECDHE rejects malformed pubkey', () => {
        const asyncCurve = buildAsyncCurve();

        const malformed = createBuffer(33);
        new Uint8Array(malformed)[0] = 4;
        expect(() => asyncCurve.ECDHE(malformed, privKey)).toThrow('Invalid public key');
    });

    test('Async Ed25519Sign rejects missing message', () => {
        const asyncCurve = buildAsyncCurve();
        expect(() => asyncCurve.Ed25519Sign(privKey, undefined as unknown as ArrayBuffer)).toThrow('Invalid message');
    });

    test('Async Ed25519Verify rejects missing message', async () => {
        const asyncCurve = buildAsyncCurve();

        const pubKey = createBuffer(33);
        new Uint8Array(pubKey)[0] = 5;

        await expect(asyncCurve.Ed25519Verify(pubKey, undefined as unknown as ArrayBuffer, signature)).rejects.toThrow(
            'Invalid message'
        );
    });

    test('Async Ed25519Verify rejects missing signature buffer', async () => {
        const asyncCurve = buildAsyncCurve();

        const pubKey = createBuffer(33);
        new Uint8Array(pubKey)[0] = 5;

        await expect(asyncCurve.Ed25519Verify(pubKey, message, undefined as unknown as ArrayBuffer)).rejects.toThrow(
            'Invalid signature'
        );
    });
});
