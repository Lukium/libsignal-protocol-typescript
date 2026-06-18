import * as Internal from './internal';
import { IdentityKeyPairType, SignedPreKeyPairType, PreKeyPairType } from './types';

/**
 * Utility methods for generating identity keys, registration IDs, and pre-keys.
 */
export class KeyHelper {
    /**
     * Derives a new two-key identity (X25519 DH + Ed25519 signing). See
     * IdentityKeyPairType and the README "Cryptographic Backend" section.
     */
    static async generateIdentityKeyPair(): Promise<IdentityKeyPairType> {
        const dh = await Internal.crypto.createKeyPair();
        const signing = await Internal.crypto.createSigningKeyPair();
        return {
            pubKey: dh.pubKey,
            privKey: dh.privKey,
            signingPubKey: signing.pubKey,
            signingPrivKey: signing.privKey,
        };
    }

    /**
     * Generates a random 14-bit registration ID as specified by the Signal protocol.
     */
    static generateRegistrationId(): number {
        const registrationId = new Uint16Array(Internal.crypto.getRandomBytes(2))[0];
        return registrationId & 0x3fff;
    }

    /**
     * Produces a signed pre-key pair and signature for the supplied identity key.
     */
    static async generateSignedPreKey(
        identityKeyPair: IdentityKeyPairType,
        signedKeyId: number
    ): Promise<SignedPreKeyPairType> {
        if (
            !(identityKeyPair.privKey instanceof ArrayBuffer) ||
            identityKeyPair.privKey.byteLength !== 32 ||
            !(identityKeyPair.pubKey instanceof ArrayBuffer) ||
            identityKeyPair.pubKey.byteLength !== 33 ||
            !(identityKeyPair.signingPrivKey instanceof ArrayBuffer) ||
            identityKeyPair.signingPrivKey.byteLength !== 32 ||
            !(identityKeyPair.signingPubKey instanceof ArrayBuffer) ||
            identityKeyPair.signingPubKey.byteLength !== 32
        ) {
            throw new TypeError('Invalid argument for identityKeyPair');
        }
        if (!isNonNegativeInteger(signedKeyId)) {
            throw new TypeError('Invalid argument for signedKeyId: ' + signedKeyId);
        }
        const keyPair = await Internal.crypto.createKeyPair();
        // Sign the X25519 signed-prekey public with the Ed25519 identity key.
        const sig = await Internal.crypto.Ed25519Sign(identityKeyPair.signingPrivKey, keyPair.pubKey);
        return {
            keyId: signedKeyId,
            keyPair: keyPair,
            signature: sig,
        };
    }

    /**
     * Generates a one-time pre-key identified by `keyId`.
     */
    static async generatePreKey(keyId: number): Promise<PreKeyPairType> {
        if (!isNonNegativeInteger(keyId)) {
            throw new TypeError('Invalid argument for keyId: ' + keyId);
        }

        const keyPair = await Internal.crypto.createKeyPair();
        return { keyId: keyId, keyPair: keyPair };
    }
}

function isNonNegativeInteger(n: unknown): n is number {
    return typeof n === 'number' && n % 1 === 0 && n >= 0;
}
