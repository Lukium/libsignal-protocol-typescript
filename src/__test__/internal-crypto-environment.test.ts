import path from 'path';

const msrcryptoPath = path.resolve(__dirname, '../../lib/msrcrypto');

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const originalMsCrypto = (globalThis as Record<string, unknown>).msCrypto;

const restore = () => {
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

afterEach(() => {
    jest.resetModules();
    jest.unmock(msrcryptoPath);
    restore();
    jest.restoreAllMocks();
});

describe('internal crypto environment detection', () => {
    test('prefers msCrypto when only that exists', async () => {
        const getRandomValues = jest.fn((buffer: Uint8Array) => {
            buffer.fill(7);
            return buffer;
        });
        const subtle = {
            importKey: jest.fn().mockResolvedValue({}),
            encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
            decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
            sign: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
            digest: jest.fn().mockResolvedValue(new ArrayBuffer(64)),
        };
        unsetCrypto();
        (globalThis as Record<string, unknown>).msCrypto = {
            getRandomValues,
            subtle,
        };

        const module = await import('../internal/crypto');
        const random = module.crypto.getRandomBytes(4);
        expect(getRandomValues).toHaveBeenCalled();
        expect(random.byteLength).toBe(4);
    });

    test('loads msrcrypto fallback when available via require', async () => {
        const subtle = {
            importKey: jest.fn().mockResolvedValue({}),
            encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
            decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
            sign: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
            digest: jest.fn().mockResolvedValue(new ArrayBuffer(64)),
        };
        const getRandomValues = jest.fn((buffer: Uint8Array) => buffer);
        unsetCrypto();
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (globalThis as Record<string, unknown>).msCrypto;
        jest.doMock(msrcryptoPath, () => ({
            getRandomValues,
            subtle,
        }));

        const module = await import('../internal/crypto');
        await module.crypto.hash(new ArrayBuffer(0));
        expect(subtle.digest).toHaveBeenCalled();
    });

    test('throws when no WebCrypto implementation can be resolved', async () => {
        unsetCrypto();
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (globalThis as Record<string, unknown>).msCrypto;
        jest.doMock(msrcryptoPath, () => {
            throw new Error('missing fallback');
        });

        await expect(import('../internal/crypto')).rejects.toThrow('missing fallback');
    });
});
