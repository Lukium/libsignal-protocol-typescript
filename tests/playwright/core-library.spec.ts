import { test, expect } from '@playwright/test';

/**
 * Core library tests that run directly in the browser without Service Workers.
 * These tests verify that the Signal Protocol library works correctly in all browsers.
 *
 * The library is exposed via window.SignalProtocol from a test harness page.
 */
test.describe('Core library functionality', () => {
    test.beforeEach(async ({ page }) => {
        // Log console errors for debugging
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                console.log(`Browser console error: ${msg.text()}`);
            }
        });
        page.on('pageerror', (error) => {
            console.log(`Page error: ${error.message}`);
        });

        // Navigate to the test harness page
        await page.goto('/test-harness.html', { waitUntil: 'domcontentloaded' });

        // Wait for status to update (either success or error)
        await page.waitForFunction(
            () => {
                const status = document.getElementById('status');
                return status && status.textContent !== 'Loading...';
            },
            { timeout: 30000 }
        );

        // Check if there was an error
        const statusText = await page.locator('#status').textContent();
        if (statusText?.startsWith('Error:')) {
            throw new Error(`Library failed to load: ${statusText}`);
        }

        // Wait for the library to be loaded
        await page.waitForFunction(() => (window as any).SignalProtocol !== undefined, { timeout: 5000 });
    });

    test('generates identity key pair', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { KeyHelper } = (window as any).SignalProtocol;
            const keyPair = await KeyHelper.generateIdentityKeyPair();
            return {
                hasPubKey: keyPair.pubKey instanceof ArrayBuffer && keyPair.pubKey.byteLength === 33,
                hasPrivKey: keyPair.privKey instanceof ArrayBuffer && keyPair.privKey.byteLength === 32,
            };
        });

        expect(result.hasPubKey).toBe(true);
        expect(result.hasPrivKey).toBe(true);
    });

    test('generates registration ID', async ({ page }) => {
        const registrationId = await page.evaluate(async () => {
            const { KeyHelper } = (window as any).SignalProtocol;
            return KeyHelper.generateRegistrationId();
        });

        expect(registrationId).toBeGreaterThan(0);
        expect(registrationId).toBeLessThanOrEqual(16383);
    });

    test('generates pre-key', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { KeyHelper } = (window as any).SignalProtocol;
            const preKey = await KeyHelper.generatePreKey(1);
            return {
                keyId: preKey.keyId,
                hasPubKey: preKey.keyPair.pubKey instanceof ArrayBuffer && preKey.keyPair.pubKey.byteLength === 33,
                hasPrivKey: preKey.keyPair.privKey instanceof ArrayBuffer && preKey.keyPair.privKey.byteLength === 32,
            };
        });

        expect(result.keyId).toBe(1);
        expect(result.hasPubKey).toBe(true);
        expect(result.hasPrivKey).toBe(true);
    });

    test('generates signed pre-key', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { KeyHelper } = (window as any).SignalProtocol;
            const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
            const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, 1);
            return {
                keyId: signedPreKey.keyId,
                hasPubKey:
                    signedPreKey.keyPair.pubKey instanceof ArrayBuffer && signedPreKey.keyPair.pubKey.byteLength === 33,
                hasPrivKey:
                    signedPreKey.keyPair.privKey instanceof ArrayBuffer &&
                    signedPreKey.keyPair.privKey.byteLength === 32,
                hasSignature: signedPreKey.signature instanceof ArrayBuffer && signedPreKey.signature.byteLength === 64,
            };
        });

        expect(result.keyId).toBe(1);
        expect(result.hasPubKey).toBe(true);
        expect(result.hasPrivKey).toBe(true);
        expect(result.hasSignature).toBe(true);
    });

    test('encrypts and decrypts message round-trip', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { KeyHelper, SessionBuilder, SessionCipher, SignalProtocolAddress } = (window as any).SignalProtocol;

            // Create in-memory stores for Alice and Bob
            const createStore = () => {
                const store: Record<string, unknown> = {};
                return {
                    getIdentityKeyPair: () => Promise.resolve(store.identityKeyPair),
                    getLocalRegistrationId: () => Promise.resolve(store.registrationId as number),
                    isTrustedIdentity: () => Promise.resolve(true),
                    saveIdentity: () => Promise.resolve(true),
                    loadPreKey: (keyId: number) => Promise.resolve(store[`preKey${keyId}`]),
                    storePreKey: (keyId: number, keyPair: unknown) => {
                        store[`preKey${keyId}`] = keyPair;
                        return Promise.resolve();
                    },
                    removePreKey: () => Promise.resolve(),
                    loadSignedPreKey: (keyId: number) => Promise.resolve(store[`signedPreKey${keyId}`]),
                    storeSignedPreKey: (keyId: number, keyPair: unknown) => {
                        store[`signedPreKey${keyId}`] = keyPair;
                        return Promise.resolve();
                    },
                    loadSession: (addr: string) => Promise.resolve(store[`session${addr}`] as string),
                    storeSession: (addr: string, session: string) => {
                        store[`session${addr}`] = session;
                        return Promise.resolve();
                    },
                    setIdentityKeyPair: (keyPair: unknown) => {
                        store.identityKeyPair = keyPair;
                    },
                    setRegistrationId: (id: number) => {
                        store.registrationId = id;
                    },
                };
            };

            // Setup Alice
            const aliceStore = createStore();
            const aliceIdentity = await KeyHelper.generateIdentityKeyPair();
            aliceStore.setIdentityKeyPair(aliceIdentity);
            aliceStore.setRegistrationId(KeyHelper.generateRegistrationId());

            // Setup Bob
            const bobStore = createStore();
            const bobIdentity = await KeyHelper.generateIdentityKeyPair();
            bobStore.setIdentityKeyPair(bobIdentity);
            const bobRegistrationId = KeyHelper.generateRegistrationId();
            bobStore.setRegistrationId(bobRegistrationId);

            // Generate Bob's pre-keys
            const bobPreKey = await KeyHelper.generatePreKey(1);
            const bobSignedPreKey = await KeyHelper.generateSignedPreKey(bobIdentity, 1);
            await bobStore.storePreKey(bobPreKey.keyId, bobPreKey.keyPair);
            await bobStore.storeSignedPreKey(bobSignedPreKey.keyId, bobSignedPreKey.keyPair);

            // Create Bob's pre-key bundle
            const bobBundle = {
                identityKey: bobIdentity.pubKey,
                registrationId: bobRegistrationId,
                preKey: {
                    keyId: bobPreKey.keyId,
                    publicKey: bobPreKey.keyPair.pubKey,
                },
                signedPreKey: {
                    keyId: bobSignedPreKey.keyId,
                    publicKey: bobSignedPreKey.keyPair.pubKey,
                    signature: bobSignedPreKey.signature,
                },
            };

            // Alice builds session with Bob
            const bobAddress = new SignalProtocolAddress('bob', 1);
            const aliceSessionBuilder = new SessionBuilder(aliceStore, bobAddress);
            await aliceSessionBuilder.processPreKey(bobBundle);

            // Alice encrypts message
            const aliceCipher = new SessionCipher(aliceStore, bobAddress);
            const plaintext = 'Hello, Bob!';
            const encoder = new TextEncoder();
            const ciphertext = await aliceCipher.encrypt(encoder.encode(plaintext).buffer);

            // Bob decrypts message
            const aliceAddress = new SignalProtocolAddress('alice', 1);
            const bobCipher = new SessionCipher(bobStore, aliceAddress);
            const decrypted = await bobCipher.decryptPreKeyWhisperMessage(ciphertext.body, 'binary');
            const decoder = new TextDecoder();
            const decryptedText = decoder.decode(new Uint8Array(decrypted));

            return {
                originalText: plaintext,
                decryptedText: decryptedText,
                ciphertextType: ciphertext.type,
            };
        });

        expect(result.decryptedText).toBe(result.originalText);
        expect(result.ciphertextType).toBe(3); // PreKeyWhisperMessage
    });
});
