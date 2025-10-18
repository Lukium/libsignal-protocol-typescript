import { Curve, AsyncCurve } from '../curve';
import * as Internal from '../internal';

const createArrayBuffer = (length: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < view.length; i += 1) {
        view[i] = i % 256;
    }
    return buffer;
};

describe('Curve wrapper', () => {
    const privKey = createArrayBuffer(32);
    const pubKey = createArrayBuffer(32);
    const sig = createArrayBuffer(64);
    const keyPair = { pubKey: createArrayBuffer(33), privKey };

    let randomSpy: jest.SpyInstance<ArrayBuffer, [number]>;
    beforeEach(() => {
        randomSpy = jest.spyOn(Internal.crypto, 'getRandomBytes').mockReturnValue(privKey);
    });

    afterEach(() => {
        randomSpy.mockRestore();
    });

    test('delegates synchronous operations', () => {
        const curveImpl = {
            async: {
                createKeyPair: jest.fn(),
                ECDHE: jest.fn(),
                Ed25519Verify: jest.fn(),
                Ed25519Sign: jest.fn(),
            },
            createKeyPair: jest.fn().mockReturnValue(keyPair),
            ECDHE: jest.fn().mockReturnValue(pubKey),
            Ed25519Verify: jest.fn().mockReturnValue(true),
            Ed25519Sign: jest.fn().mockReturnValue(sig),
        };

        const curve = new Curve(curveImpl as unknown as Internal.Curve);

        expect(curve.generateKeyPair()).toBe(keyPair);
        expect(curveImpl.createKeyPair).toHaveBeenCalledWith(privKey);
        expect(randomSpy).toHaveBeenCalledWith(32);

        expect(curve.createKeyPair(privKey)).toBe(keyPair);
        expect(curveImpl.createKeyPair).toHaveBeenCalledWith(privKey);

        expect(curve.calculateAgreement(pubKey, privKey)).toBe(pubKey);
        expect(curveImpl.ECDHE).toHaveBeenCalledWith(pubKey, privKey);

        expect(curve.verifySignature(pubKey, privKey, sig)).toBe(true);
        expect(curveImpl.Ed25519Verify).toHaveBeenCalledWith(pubKey, privKey, sig);

        expect(curve.calculateSignature(privKey, pubKey)).toBe(sig);
        expect(curveImpl.Ed25519Sign).toHaveBeenCalledWith(privKey, pubKey);
    });

    test('delegates asynchronous operations', async () => {
        const asyncImpl = {
            createKeyPair: jest.fn().mockResolvedValue(keyPair),
            ECDHE: jest.fn().mockResolvedValue(pubKey),
            Ed25519Verify: jest.fn().mockResolvedValue(true),
            Ed25519Sign: jest.fn().mockResolvedValue(sig),
        };

        const asyncCurve = new AsyncCurve(asyncImpl as unknown as Internal.AsyncCurve);

        await expect(asyncCurve.generateKeyPair()).resolves.toEqual(keyPair);
        expect(randomSpy).toHaveBeenCalledWith(32);
        expect(asyncImpl.createKeyPair).toHaveBeenLastCalledWith(privKey);

        await expect(asyncCurve.createKeyPair(privKey)).resolves.toEqual(keyPair);
        expect(asyncImpl.createKeyPair).toHaveBeenCalledWith(privKey);

        await expect(asyncCurve.calculateAgreement(pubKey, privKey)).resolves.toEqual(pubKey);
        expect(asyncImpl.ECDHE).toHaveBeenCalledWith(pubKey, privKey);

        await expect(asyncCurve.verifySignature(pubKey, privKey, sig)).resolves.toBe(true);
        expect(asyncImpl.Ed25519Verify).toHaveBeenCalledWith(pubKey, privKey, sig);

        await expect(asyncCurve.calculateSignature(privKey, pubKey)).resolves.toEqual(sig);
        expect(asyncImpl.Ed25519Sign).toHaveBeenCalledWith(privKey, pubKey);
    });
});
