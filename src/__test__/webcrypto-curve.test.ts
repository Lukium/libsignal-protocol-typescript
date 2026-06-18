import {
    x25519CreateKeyPair,
    x25519GenerateKeyPair,
    x25519SharedSecret,
    ed25519CreateKeyPair,
    ed25519GenerateKeyPair,
    ed25519Sign,
    ed25519Verify,
} from '../internal/webcrypto-curve';

const hexToAB = (h: string): ArrayBuffer => {
    const m = h.match(/.{2}/g) ?? [];
    return new Uint8Array(m.map((b) => parseInt(b, 16))).buffer;
};
const toHex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('webcrypto-curve: X25519', () => {
    // RFC 7748 §6.1 known-answer vector.
    const alicePriv = '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a';
    const alicePub = '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a';
    const bobPriv = '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb';
    const bobPub = 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f';
    const shared = '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742';

    it('derives the RFC 7748 public key from a private scalar', async () => {
        const kp = await x25519CreateKeyPair(hexToAB(alicePriv));
        expect(toHex(kp.pubKey)).toBe(alicePub);
        expect(kp.pubKey.byteLength).toBe(32);
        expect(kp.privKey.byteLength).toBe(32);
    });

    it('computes the RFC 7748 shared secret', async () => {
        const ab = await x25519SharedSecret(hexToAB(bobPub), hexToAB(alicePriv));
        const ba = await x25519SharedSecret(hexToAB(alicePub), hexToAB(bobPriv));
        expect(toHex(ab)).toBe(shared);
        expect(toHex(ba)).toBe(shared); // DH symmetry
    });

    it('generates working key pairs (round-trip DH agrees)', async () => {
        const a = await x25519GenerateKeyPair();
        const b = await x25519GenerateKeyPair();
        const ab = await x25519SharedSecret(b.pubKey, a.privKey);
        const ba = await x25519SharedSecret(a.pubKey, b.privKey);
        expect(toHex(ab)).toBe(toHex(ba));
        expect(a.pubKey.byteLength).toBe(32);
    });

    it('createKeyPair is deterministic for a given private key', async () => {
        const a = await x25519CreateKeyPair(hexToAB(bobPriv));
        const b = await x25519CreateKeyPair(hexToAB(bobPriv));
        expect(toHex(a.pubKey)).toBe(toHex(b.pubKey));
        expect(toHex(a.pubKey)).toBe(bobPub);
    });
});

describe('webcrypto-curve: Ed25519', () => {
    it('signs and verifies (createKeyPair seed round-trip)', async () => {
        const seed = await ed25519GenerateKeyPair().then((k) => k.privKey);
        const { pubKey } = await ed25519CreateKeyPair(seed);
        const msg = new TextEncoder().encode('hello signal').buffer;
        const sig = await ed25519Sign(seed, msg);
        expect(sig.byteLength).toBe(64);
        expect(await ed25519Verify(pubKey, msg, sig)).toBe(true);
    });

    it('rejects a tampered signature', async () => {
        const { pubKey, privKey } = await ed25519GenerateKeyPair();
        const msg = new TextEncoder().encode('x3dh signed prekey').buffer;
        const sig = new Uint8Array(await ed25519Sign(privKey, msg));
        sig[0] ^= 0xff;
        expect(await ed25519Verify(pubKey, msg, sig.buffer)).toBe(false);
    });

    it('rejects a signature over a different message', async () => {
        const { pubKey, privKey } = await ed25519GenerateKeyPair();
        const sig = await ed25519Sign(privKey, new TextEncoder().encode('a').buffer);
        expect(await ed25519Verify(pubKey, new TextEncoder().encode('b').buffer, sig)).toBe(false);
    });

    it('throws on a wrong-length signature', async () => {
        const { pubKey } = await ed25519GenerateKeyPair();
        await expect(ed25519Verify(pubKey, new ArrayBuffer(4), new ArrayBuffer(32))).rejects.toThrow(
            'Invalid signature'
        );
    });

    it('generates 32-byte public and private keys', async () => {
        const k = await ed25519GenerateKeyPair();
        expect(k.pubKey.byteLength).toBe(32);
        expect(k.privKey.byteLength).toBe(32);
    });
});
