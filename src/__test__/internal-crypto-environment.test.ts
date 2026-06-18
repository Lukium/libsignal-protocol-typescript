export {}; // ensure this file is a module (isolated scope)

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

    test('throws on first use when no native WebCrypto is available', async () => {
        // The asm.js msrcrypto fallback was removed in 0.2.0. Resolution is lazy
        // (so a host can inject via setWebCrypto after import), so importing
        // succeeds but the first crypto USE throws when none is available.
        unsetCrypto();
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (globalThis as Record<string, unknown>).msCrypto;

        const module = await import('../internal/crypto');
        expect(() => module.crypto.getRandomBytes(4)).toThrow('No WebCrypto implementation found');
    });
});
