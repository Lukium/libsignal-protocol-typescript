import { Crypto, HKDF, calculateMAC, crypto as defaultCrypto, verifyMAC } from '../internal/crypto';
import { AsyncCurve as AsyncCurveType } from '@privacyresearch/curve25519-typescript';
import * as util from '../helpers';

const toAB = (arr: number[]): ArrayBuffer => util.uint8ArrayToArrayBuffer(Uint8Array.from(arr));

describe('Internal crypto helpers', () => {
    const key = toAB(new Array(32).fill(1));
    const iv = toAB(new Array(16).fill(2));
    const data = toAB([1, 2, 3, 4, 5, 6, 7, 8]);

    test('encrypt and decrypt round trip', async () => {
        const instance = new Crypto(globalThis.crypto);
        const ciphertext = await instance.encrypt(key, data, iv);
        const plaintext = await instance.decrypt(key, ciphertext, iv);
        expect(util.arrayBufferToString(plaintext)).toBe(util.arrayBufferToString(data));
    });

    test('HKDF produces three 32 byte blocks', async () => {
        const [t1, t2, t3] = await HKDF(data, key, 'info');
        expect(t1.byteLength).toBe(32);
        expect(t2.byteLength).toBe(32);
        expect(t3.byteLength).toBe(32);
        expect(util.arrayBufferToString(t1)).not.toBe(util.arrayBufferToString(t2));
    });

    test('HKDF rejects incorrect salt length', () => {
        expect(() => HKDF(data, toAB(new Array(16).fill(1)), 'info')).toThrow('Got salt of incorrect length');
    });

    test('Crypto HKDF rejects string info argument', async () => {
        const instance = new Crypto(globalThis.crypto);
        await expect(instance.HKDF(data, key, 'bad' as unknown as ArrayBuffer)).rejects.toThrow(
            'HKDF info was a string'
        );
    });

    test('calculateMAC matches verifyMAC', async () => {
        const mac = await calculateMAC(key, data);
        await expect(verifyMAC(data, key, mac, mac.byteLength)).resolves.toBeUndefined();
    });

    test('verifyMAC rejects mismatched mac', async () => {
        const mac = await defaultCrypto.sign(key, data);
        const badMac = toAB(new Array(mac.byteLength).fill(9));
        await expect(verifyMAC(data, key, badMac, mac.byteLength)).rejects.toThrow('Bad MAC');
    });

    test('verifyMAC enforces mac length', async () => {
        const mac = await defaultCrypto.sign(key, data);
        const truncated = mac.slice(0, 8);
        await expect(verifyMAC(data, key, truncated, mac.byteLength)).rejects.toThrow('Bad MAC length');
    });

    test('getRandomBytes uses configured crypto', () => {
        const instance = new Crypto(globalThis.crypto);
        const random = instance.getRandomBytes(24);
        expect(random.byteLength).toBe(24);
    });

    test('createKeyPair generates random when no privKey provided', async () => {
        const instance = new Crypto(globalThis.crypto);
        const backend = {
            keyPair: jest.fn().mockResolvedValue({ pubKey: data, privKey: data }),
            sharedSecret: jest.fn(),
            sign: jest.fn(),
            verify: jest.fn(),
        } as unknown as AsyncCurveType;
        instance.curve = backend;

        await instance.createKeyPair();
        expect(backend.keyPair).toHaveBeenCalled();
    });
});
