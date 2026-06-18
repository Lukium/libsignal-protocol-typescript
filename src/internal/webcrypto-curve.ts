/**
 * Native WebCrypto curve backend: X25519 (key agreement) + Ed25519 (signatures).
 *
 * Part of the WebCrypto migration (see README "Cryptographic Backend"). This
 * replaces the asm.js `@privacyresearch/curve25519-typescript` backend with
 * browser-native primitives. It is intentionally **byte-in / byte-out** to keep
 * the library's existing serialization contract: private keys flow as 32-byte
 * scalars/seeds and public keys as 32-byte raw values. Capturing non-extractable
 * key handles is a deliberate follow-on (see README) and out of scope here.
 *
 * The two-key identity split (Ed25519 signing vs X25519 DH) is threaded by the
 * protocol layer; this module just provides both primitive families.
 */

// Fixed PKCS#8 DER prefixes for a bare 32-byte private key of each curve.
// 302e0201003005 06 03 2b65 6e 0422 0420 <32 bytes>   (OID 1.3.101.110 = X25519)
// 302e0201003005 06 03 2b65 70 0422 0420 <32 bytes>   (OID 1.3.101.112 = Ed25519)
const X25519_PKCS8_PREFIX = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
]);
const ED25519_PKCS8_PREFIX = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

let injectedSubtle: SubtleCrypto | undefined;

/** Override the WebCrypto SubtleCrypto implementation (tests / non-standard hosts). */
export function setWebCryptoSubtle(s: SubtleCrypto): void {
    injectedSubtle = s;
}

function subtle(): SubtleCrypto {
    if (injectedSubtle) return injectedSubtle;
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (!c?.subtle) {
        throw new Error('WebCrypto SubtleCrypto is unavailable; call setWebCryptoSubtle() to provide one.');
    }
    return c.subtle;
}

function toU8(buf: ArrayBuffer | Uint8Array): Uint8Array {
    return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

function bufToArrayBuffer(buf: ArrayBuffer | Uint8Array): ArrayBuffer {
    const u8 = toU8(buf);
    const out = new ArrayBuffer(u8.byteLength);
    new Uint8Array(out).set(u8);
    return out;
}

/**
 * RFC 7748 X25519 scalar clamping. The asm.js backend returned the clamped
 * scalar as the private key, and the clamped form is the canonical stored
 * representation, so we match it. Clamping is idempotent and does not change any
 * derived public key or shared secret (WebCrypto clamps internally regardless).
 */
function clampX25519(raw32: Uint8Array): Uint8Array {
    const k = new Uint8Array(raw32);
    k[0] &= 248;
    k[31] &= 127;
    k[31] |= 64;
    return k;
}

function pkcs8(prefix: Uint8Array, raw32: Uint8Array): ArrayBuffer {
    if (raw32.length !== 32) {
        throw new Error(`Invalid private key length: ${raw32.length} (expected 32)`);
    }
    const out = new Uint8Array(prefix.length + 32);
    out.set(prefix, 0);
    out.set(raw32, prefix.length);
    return out.buffer;
}

function base64urlToBytes(b64url: string): Uint8Array {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

// --- X25519 (key agreement) --------------------------------------------------

async function importX25519Private(raw32: Uint8Array): Promise<CryptoKey> {
    return subtle().importKey('pkcs8', pkcs8(X25519_PKCS8_PREFIX, raw32), { name: 'X25519' }, true, ['deriveBits']);
}

async function importX25519Public(raw32: Uint8Array): Promise<CryptoKey> {
    return subtle().importKey('raw', bufToArrayBuffer(raw32), { name: 'X25519' }, true, []);
}

/** Public key bytes (32) for an X25519 private key, via its JWK `x` member. */
async function x25519PublicFromPrivate(priv: CryptoKey): Promise<ArrayBuffer> {
    const jwk = (await subtle().exportKey('jwk', priv)) as JsonWebKey;
    return bufToArrayBuffer(base64urlToBytes(jwk.x as string));
}

export async function x25519CreateKeyPair(
    privKey: ArrayBuffer
): Promise<{ pubKey: ArrayBuffer; privKey: ArrayBuffer }> {
    const clamped = clampX25519(toU8(privKey));
    const priv = await importX25519Private(clamped);
    const pubKey = await x25519PublicFromPrivate(priv);
    return { pubKey, privKey: bufToArrayBuffer(clamped) };
}

export async function x25519GenerateKeyPair(): Promise<{ pubKey: ArrayBuffer; privKey: ArrayBuffer }> {
    const kp = (await subtle().generateKey({ name: 'X25519' }, true, ['deriveBits'])) as CryptoKeyPair;
    const jwk = (await subtle().exportKey('jwk', kp.privateKey)) as JsonWebKey;
    return {
        pubKey: bufToArrayBuffer(await subtle().exportKey('raw', kp.publicKey)),
        privKey: bufToArrayBuffer(base64urlToBytes(jwk.d as string)),
    };
}

export async function x25519SharedSecret(pubKey: ArrayBuffer, privKey: ArrayBuffer): Promise<ArrayBuffer> {
    const priv = await importX25519Private(toU8(privKey));
    const pub = await importX25519Public(toU8(pubKey));
    return subtle().deriveBits({ name: 'X25519', public: pub }, priv, 256);
}

// --- Ed25519 (signatures) ----------------------------------------------------

async function importEd25519Private(raw32: Uint8Array): Promise<CryptoKey> {
    return subtle().importKey('pkcs8', pkcs8(ED25519_PKCS8_PREFIX, raw32), { name: 'Ed25519' }, true, ['sign']);
}

async function importEd25519Public(raw32: Uint8Array): Promise<CryptoKey> {
    return subtle().importKey('raw', bufToArrayBuffer(raw32), { name: 'Ed25519' }, true, ['verify']);
}

export async function ed25519CreateKeyPair(seed: ArrayBuffer): Promise<{ pubKey: ArrayBuffer; privKey: ArrayBuffer }> {
    const priv = await importEd25519Private(toU8(seed));
    const jwk = (await subtle().exportKey('jwk', priv)) as JsonWebKey;
    return { pubKey: bufToArrayBuffer(base64urlToBytes(jwk.x as string)), privKey: bufToArrayBuffer(seed) };
}

export async function ed25519GenerateKeyPair(): Promise<{ pubKey: ArrayBuffer; privKey: ArrayBuffer }> {
    const kp = (await subtle().generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = (await subtle().exportKey('jwk', kp.privateKey)) as JsonWebKey;
    return {
        pubKey: bufToArrayBuffer(await subtle().exportKey('raw', kp.publicKey)),
        privKey: bufToArrayBuffer(base64urlToBytes(jwk.d as string)),
    };
}

export async function ed25519Sign(privKey: ArrayBuffer, message: ArrayBuffer): Promise<ArrayBuffer> {
    const priv = await importEd25519Private(toU8(privKey));
    return subtle().sign({ name: 'Ed25519' }, priv, message);
}

export async function ed25519Verify(
    pubKey: ArrayBuffer,
    message: ArrayBuffer,
    signature: ArrayBuffer
): Promise<boolean> {
    if (signature.byteLength !== 64) {
        throw new Error('Invalid signature');
    }
    const pub = await importEd25519Public(toU8(pubKey));
    return subtle().verify({ name: 'Ed25519' }, pub, signature, message);
}
