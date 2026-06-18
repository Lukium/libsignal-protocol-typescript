/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/**
 * Public type definitions consumed by applications embedding the library.
 */
export interface SignalProtocolAddressType {
    readonly name: string;
    readonly deviceId: number;
    toString: () => string;
    equals: (other: SignalProtocolAddressType) => boolean;
}

/** Generates displayable safety numbers for a pair of identities. */
export interface FingerprintGeneratorType {
    createFor: (
        localIdentifier: string,
        localIdentityKey: ArrayBuffer,
        remoteIdentifier: string,
        remoteIdentityKey: ArrayBuffer
    ) => Promise<string>;
}

export interface KeyPairType<T = ArrayBuffer> {
    pubKey: T;
    privKey: T;
}

/**
 * The long-term identity key. As of the WebCrypto backend, an identity is TWO
 * keys (see README "Cryptographic Backend"): an X25519 key for X3DH Diffie-
 * Hellman (`pubKey`/`privKey`, same role and 33-byte DJB form as before) and an
 * Ed25519 key for signing signed-prekeys (`signingPubKey`/`signingPrivKey`,
 * raw 32-byte). This replaces the single-key XEdDSA identity.
 */
export interface IdentityKeyPairType<T = ArrayBuffer> {
    pubKey: T; // X25519 DH public (33-byte, 0x05-prefixed)
    privKey: T; // X25519 DH private (32-byte)
    signingPubKey: T; // Ed25519 public (32-byte)
    signingPrivKey: T; // Ed25519 private (32-byte)
}

export interface PreKeyPairType<T = ArrayBuffer> {
    keyId: number;
    keyPair: KeyPairType<T>;
}

export interface SignedPreKeyPairType<T = ArrayBuffer> extends PreKeyPairType<T> {
    signature: T;
}

export interface PreKeyType<T = ArrayBuffer> {
    keyId: number;
    publicKey: T;
}

export interface SignedPublicPreKeyType<T = ArrayBuffer> extends PreKeyType<T> {
    signature: T;
}

export type SessionRecordType = string;

/** Indicates whether the caller is encrypting or decrypting. */
export enum Direction {
    SENDING = 1,
    RECEIVING = 2,
}
/**
 * Application-provided persistence layer. All methods must be asynchronous and
 * resolve once the operation is complete.
 */
export interface StorageType {
    getIdentityKeyPair: () => Promise<IdentityKeyPairType | undefined>;
    getLocalRegistrationId: () => Promise<number | undefined>;

    isTrustedIdentity: (identifier: string, identityKey: ArrayBuffer, direction: Direction) => Promise<boolean>;
    saveIdentity: (encodedAddress: string, publicKey: ArrayBuffer, nonblockingApproval?: boolean) => Promise<boolean>;

    loadPreKey: (encodedAddress: string | number) => Promise<KeyPairType | undefined>;
    storePreKey: (keyId: number | string, keyPair: KeyPairType) => Promise<void>;
    removePreKey: (keyId: number | string) => Promise<void>;

    storeSession: (encodedAddress: string, record: SessionRecordType) => Promise<void>;
    loadSession: (encodedAddress: string) => Promise<SessionRecordType | undefined>;

    // This returns a KeyPairType, but note that it's the implenenter's responsibility to validate!
    loadSignedPreKey: (keyId: number | string) => Promise<KeyPairType | undefined>;
    storeSignedPreKey: (keyId: number | string, keyPair: KeyPairType) => Promise<void>;
    removeSignedPreKey: (keyId: number | string) => Promise<void>;
}

export interface CurveType {
    generateKeyPair: () => Promise<KeyPairType>;
    createKeyPair: (privKey: ArrayBuffer) => Promise<KeyPairType>;
    calculateAgreement: (pubKey: ArrayBuffer, privKey: ArrayBuffer) => Promise<ArrayBuffer>;
    verifySignature: (pubKey: ArrayBuffer, msg: ArrayBuffer, sig: ArrayBuffer) => Promise<void>;
    calculateSignature: (privKey: ArrayBuffer, message: ArrayBuffer) => ArrayBuffer | Promise<ArrayBuffer>;
    validatePubKeyFormat: (buffer: ArrayBuffer) => ArrayBuffer;
}

export interface AsyncCurveType {
    generateKeyPair: () => Promise<KeyPairType>;
    createKeyPair: (privKey: ArrayBuffer) => Promise<KeyPairType>;
    calculateAgreement: (pubKey: ArrayBuffer, privKey: ArrayBuffer) => Promise<ArrayBuffer>;
    verifySignature: (pubKey: ArrayBuffer, msg: ArrayBuffer, sig: ArrayBuffer) => Promise<boolean>;
    calculateSignature: (privKey: ArrayBuffer, message: ArrayBuffer) => Promise<ArrayBuffer>;
}
