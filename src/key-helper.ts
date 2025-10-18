import * as Internal from './internal';
import { KeyPairType, SignedPreKeyPairType, PreKeyPairType } from './types';

/**
 * Utility methods for generating identity keys, registration IDs, and pre-keys.
 */
export class KeyHelper {
    /**
     * Derives a new identity key pair using the configured crypto backend.
     */
    static generateIdentityKeyPair(): Promise<KeyPairType> {
        return Internal.crypto.createKeyPair();
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
        identityKeyPair: KeyPairType,
        signedKeyId: number
    ): Promise<SignedPreKeyPairType> {
        if (
            !(identityKeyPair.privKey instanceof ArrayBuffer) ||
            identityKeyPair.privKey.byteLength !== 32 ||
            !(identityKeyPair.pubKey instanceof ArrayBuffer) ||
            identityKeyPair.pubKey.byteLength !== 33
        ) {
            throw new TypeError('Invalid argument for identityKeyPair');
        }
        if (!isNonNegativeInteger(signedKeyId)) {
            throw new TypeError('Invalid argument for signedKeyId: ' + signedKeyId);
        }
        const keyPair = await Internal.crypto.createKeyPair();
        const sig = await Internal.crypto.Ed25519Sign(identityKeyPair.privKey, keyPair.pubKey);
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
