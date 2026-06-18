import * as Internal from '.';
import * as util from '../helpers';
import { KeyPairType } from '../types';
import { AsyncCurve as AsyncCurveType } from '@privacyresearch/curve25519-typescript';
import * as WebCryptoCurve from './webcrypto-curve';

// X25519 public keys are carried in the legacy 33-byte "DJB" form (0x05 prefix);
// the native WebCrypto backend works with raw 32-byte keys, so we add/strip the
// prefix at this boundary. Ed25519 signing keys are kept raw (no prefix).
function prefixDjbKey(raw32: ArrayBuffer): ArrayBuffer {
    const out = new ArrayBuffer(33);
    const v = new Uint8Array(out);
    v[0] = 5;
    v.set(new Uint8Array(raw32), 1);
    return out;
}
function stripDjbKey(pub: ArrayBuffer): ArrayBuffer {
    const u8 = new Uint8Array(pub);
    if (u8.length === 33 && u8[0] === 5) {
        return pub.slice(1);
    }
    if (u8.length === 32) {
        return pub;
    }
    throw new Error(`Invalid public key length: ${u8.length}`);
}

const resolveWebCrypto = (): globalThis.Crypto => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
        return globalThis.crypto;
    }

    const maybeMsCrypto =
        typeof globalThis !== 'undefined' ? (globalThis as unknown as { msCrypto?: Crypto }).msCrypto : undefined;
    if (maybeMsCrypto) {
        return maybeMsCrypto as unknown as globalThis.Crypto;
    }

    if (typeof require === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('../../lib/msrcrypto');
    }

    throw new Error(
        'No WebCrypto implementation found. Provide one via setWebCrypto() before using libsignal-protocol-typescript.'
    );
};

const webcrypto = resolveWebCrypto();

export class Crypto {
    private _curve: Internal.AsyncCurve;
    private _webcrypto: globalThis.Crypto;

    constructor(crypto?: globalThis.Crypto) {
        this._curve = new Internal.AsyncCurve();
        this._webcrypto = crypto || webcrypto;
    }

    set webcrypto(wc: globalThis.Crypto) {
        this._webcrypto = wc;
    }
    set curve(c: AsyncCurveType) {
        this._curve.curve = c;
    }

    getRandomBytes(n: number): ArrayBuffer {
        const array = new Uint8Array(n);
        this._webcrypto.getRandomValues(array);
        return util.uint8ArrayToArrayBuffer(array);
    }

    async encrypt(key: ArrayBuffer, data: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
        const impkey = await this._webcrypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['encrypt']);

        return this._webcrypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(iv) }, impkey, data);
    }

    async decrypt(key: ArrayBuffer, data: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
        const impkey = await this._webcrypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['decrypt']);

        return this._webcrypto.subtle.decrypt({ name: 'AES-CBC', iv: new Uint8Array(iv) }, impkey, data);
    }
    async sign(key: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> {
        const impkey = await this._webcrypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: { name: 'SHA-256' } },
            false,
            ['sign']
        );

        try {
            return this._webcrypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' }, impkey, data);
        } catch (e) {
            // console.log({ e, data, impkey })
            throw e;
        }
    }
    async hash(data: ArrayBuffer): Promise<ArrayBuffer> {
        return this._webcrypto.subtle.digest({ name: 'SHA-512' }, data);
    }

    async HKDF(input: ArrayBuffer, salt: ArrayBuffer, info: ArrayBuffer): Promise<ArrayBuffer[]> {
        // Specific implementation of RFC 5869 that only returns the first 3 32-byte chunks
        if (typeof info === 'string') {
            throw new Error(`HKDF info was a string`);
        }
        const PRK = await Internal.crypto.sign(salt, input);
        const infoBuffer = new ArrayBuffer(info.byteLength + 1 + 32);
        const infoArray = new Uint8Array(infoBuffer);
        infoArray.set(new Uint8Array(info), 32);
        infoArray[infoArray.length - 1] = 1;
        const T1 = await Internal.crypto.sign(PRK, infoBuffer.slice(32));
        infoArray.set(new Uint8Array(T1));
        infoArray[infoArray.length - 1] = 2;
        const T2 = await Internal.crypto.sign(PRK, infoBuffer);
        infoArray.set(new Uint8Array(T2));
        infoArray[infoArray.length - 1] = 3;
        const T3 = await Internal.crypto.sign(PRK, infoBuffer);
        return [T1, T2, T3];
    }

    // Curve25519 crypto

    // X25519 key agreement (DH). Public keys returned in 33-byte DJB form.
    async createKeyPair(privKey?: ArrayBuffer): Promise<KeyPairType> {
        const seed = privKey ?? this.getRandomBytes(32);
        const kp = await WebCryptoCurve.x25519CreateKeyPair(seed);
        return { pubKey: prefixDjbKey(kp.pubKey), privKey: kp.privKey };
    }

    // Ed25519 signing key pair (for the identity signing key). Raw 32-byte keys.
    createSigningKeyPair(seed?: ArrayBuffer): Promise<KeyPairType> {
        return seed ? WebCryptoCurve.ed25519CreateKeyPair(seed) : WebCryptoCurve.ed25519GenerateKeyPair();
    }

    ECDHE(pubKey: ArrayBuffer, privKey: ArrayBuffer): Promise<ArrayBuffer> {
        return WebCryptoCurve.x25519SharedSecret(stripDjbKey(pubKey), privKey);
    }

    Ed25519Sign(privKey: ArrayBuffer, message: ArrayBuffer): Promise<ArrayBuffer> {
        return WebCryptoCurve.ed25519Sign(privKey, message);
    }

    // NOTE: preserves the library's historical async verify contract — resolves
    // `false` on a VALID signature and THROWS on an invalid one. Callers
    // (session-builder) depend on the throw; existing tests assert the false
    // return. A sane boolean is a candidate cleanup for a future major.
    async Ed25519Verify(pubKey: ArrayBuffer, msg: ArrayBuffer, sig: ArrayBuffer): Promise<boolean> {
        const valid = await WebCryptoCurve.ed25519Verify(pubKey, msg, sig);
        if (valid) {
            return false;
        }
        throw new Error('Invalid signature');
    }
}

export const crypto = new Crypto();

export function setWebCrypto(webcrypto: globalThis.Crypto): void {
    crypto.webcrypto = webcrypto;
}

export function setCurve(curve: AsyncCurveType): void {
    crypto.curve = curve;
}

// HKDF for TextSecure has a bit of additional handling - salts always end up being 32 bytes
export function HKDF(input: ArrayBuffer, salt: ArrayBuffer, info: string): Promise<ArrayBuffer[]> {
    if (salt.byteLength != 32) {
        throw new Error('Got salt of incorrect length');
    }

    const abInfo = util.binaryStringToArrayBuffer(info);
    if (!abInfo) {
        throw new Error(`Invalid HKDF info`);
    }

    return crypto.HKDF(input, salt, abInfo);
}

export async function verifyMAC(data: ArrayBuffer, key: ArrayBuffer, mac: ArrayBuffer, length: number): Promise<void> {
    const calculated_mac = await crypto.sign(key, data);
    if (mac.byteLength != length || calculated_mac.byteLength < length) {
        throw new Error('Bad MAC length');
    }
    const a = new Uint8Array(calculated_mac);
    const b = new Uint8Array(mac);
    let result = 0;
    for (let i = 0; i < mac.byteLength; ++i) {
        result = result | (a[i] ^ b[i]);
    }
    if (result !== 0) {
        throw new Error('Bad MAC');
    }
}

export function calculateMAC(key: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> {
    return crypto.sign(key, data);
}
