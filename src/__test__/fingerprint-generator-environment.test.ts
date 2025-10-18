import path from 'path';

const msrcryptoPath = path.resolve(__dirname, '../../lib/msrcrypto');

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const originalMsCrypto = (globalThis as Record<string, unknown>).msCrypto;

const restoreGlobals = () => {
    if (originalCryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
    } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (globalThis as Record<string, unknown>).crypto;
    }
    if (originalMsCrypto === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (globalThis as Record<string, unknown>).msCrypto;
    } else {
        (globalThis as Record<string, unknown>).msCrypto = originalMsCrypto;
    }
};

const unsetCrypto = () => {
    Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true,
        writable: true,
    });
};

const simpleKey = new Uint8Array(32).buffer;

afterEach(() => {
    jest.resetModules();
    jest.unmock(msrcryptoPath);
    restoreGlobals();
    jest.restoreAllMocks();
});

describe('FingerprintGenerator environment resolution', () => {
    test('falls back to msCrypto when SubtleCrypto lives there', async () => {
        const digestMock = jest.fn(async () => new Uint8Array(64).buffer);
        unsetCrypto();
        (globalThis as Record<string, unknown>).msCrypto = {
            subtle: { digest: digestMock },
        };

        const { FingerprintGenerator } = await import('../fingerprint-generator');
        const generator = new FingerprintGenerator(1);
        const fingerprint = await generator.createFor('alice', simpleKey, 'bob', simpleKey);
        expect(fingerprint).toMatch(/^\d+$/);
        expect(fingerprint.length % 5).toBe(0);
        expect(digestMock).toHaveBeenCalled();
    });

    test('requires msrcrypto fallback when no native WebCrypto exists', async () => {
        const digestMock = jest.fn(async () => new Uint8Array(64).buffer);
        unsetCrypto();
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (globalThis as Record<string, unknown>).msCrypto;
        jest.doMock(msrcryptoPath, () => ({
            subtle: { digest: digestMock },
        }));

        const { FingerprintGenerator } = await import('../fingerprint-generator');
        const generator = new FingerprintGenerator(1);
        await generator.createFor('alice', simpleKey, 'bob', simpleKey);
        expect(digestMock).toHaveBeenCalled();
    });

    test('throws a helpful error when no SubtleCrypto implementation exists', async () => {
        unsetCrypto();
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (globalThis as Record<string, unknown>).msCrypto;
        jest.doMock(msrcryptoPath, () => ({}));

        await expect(import('../fingerprint-generator')).rejects.toThrow(
            'No SubtleCrypto implementation found. Provide one via globalThis.crypto or assign a fallback before using FingerprintGenerator.'
        );
    });
});
