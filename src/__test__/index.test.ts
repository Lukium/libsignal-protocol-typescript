import * as libsignal from '../index';

describe('index entrypoint', () => {
    test('exports the public API', () => {
        expect(typeof libsignal.KeyHelper).toBe('function');
        expect(typeof libsignal.SessionBuilder).toBe('function');
        expect(typeof libsignal.SessionCipher).toBe('function');
        expect(typeof libsignal.SignalProtocolAddress).toBe('function');
        expect(typeof libsignal.FingerprintGenerator).toBe('function');
        expect(typeof libsignal.setWebCrypto).toBe('function');
        expect(typeof libsignal.setWebCryptoSubtle).toBe('function');
    });

    test('no longer exports the removed asm.js Curve facade / setCurve', () => {
        const mod = libsignal as Record<string, unknown>;
        expect(mod.Curve).toBeUndefined();
        expect(mod.AsyncCurve).toBeUndefined();
        expect(mod.setCurve).toBeUndefined();
    });
});
