import { KeyHelper, SessionBuilder, SessionCipher, SignalProtocolAddress } from '@lukium/libsignal-protocol-typescript';
import type {
    Direction,
    StorageType,
    KeyPairType,
    SignedPublicPreKeyType,
    PreKeyType,
} from '@lukium/libsignal-protocol-typescript';

const { TextEncoder, TextDecoder } = globalThis;

class InMemorySignalProtocolStore implements StorageType {
    private store = new Map<string, unknown>();

    setIdentityKeyPair(keyPair: KeyPairType): void {
        this.store.set('identityKey', cloneKeyPair(keyPair));
    }

    setLocalRegistrationId(id: number): void {
        this.store.set('registrationId', id);
    }

    async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
        const kp = this.store.get('identityKey') as KeyPairType | undefined;
        return kp ? cloneKeyPair(kp) : undefined;
    }

    async getLocalRegistrationId(): Promise<number | undefined> {
        const rid = this.store.get('registrationId');
        return typeof rid === 'number' ? rid : undefined;
    }

    async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer, _direction: Direction): Promise<boolean> {
        const stored = this.store.get(`identity:${identifier}`) as ArrayBuffer | undefined;
        if (!stored) {
            return true;
        }
        return buffersEqual(stored, identityKey);
    }

    async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
        const existing = this.store.get(`identity:${identifier}`) as ArrayBuffer | undefined;
        this.store.set(`identity:${identifier}`, cloneBuffer(identityKey));
        if (!existing) {
            return false;
        }
        return !buffersEqual(existing, identityKey);
    }

    async loadPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
        const kp = this.store.get(`preKey:${keyId}`) as KeyPairType | undefined;
        return kp ? cloneKeyPair(kp) : undefined;
    }

    async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
        this.store.set(`preKey:${keyId}`, cloneKeyPair(keyPair));
    }

    async removePreKey(keyId: number | string): Promise<void> {
        this.store.delete(`preKey:${keyId}`);
    }

    async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
        const kp = this.store.get(`signedPreKey:${keyId}`) as KeyPairType | undefined;
        return kp ? cloneKeyPair(kp) : undefined;
    }

    async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
        this.store.set(`signedPreKey:${keyId}`, cloneKeyPair(keyPair));
    }

    async removeSignedPreKey(keyId: number | string): Promise<void> {
        this.store.delete(`signedPreKey:${keyId}`);
    }

    async loadSession(encodedAddress: string) {
        const record = this.store.get(`session:${encodedAddress}`);
        return typeof record === 'string' ? record : undefined;
    }

    async storeSession(encodedAddress: string, record: string): Promise<void> {
        this.store.set(`session:${encodedAddress}`, record);
    }

    async removeSession(identifier: string): Promise<void> {
        this.store.delete(`session:${identifier}`);
    }

    async removeAllSessions(identifier: string): Promise<void> {
        for (const key of this.store.keys()) {
            if (key.startsWith('session:') && sessionKeyBelongsTo(key.slice('session:'.length), identifier)) {
                this.store.delete(key);
            }
        }
    }
}

// True when a session address is exactly the identity or one of its
// `identity.deviceId` device entries — avoids `alice` matching `alicebob.1`.
function sessionKeyBelongsTo(address: string, identifier: string): boolean {
    if (address === identifier) {
        return true;
    }
    const prefix = `${identifier}.`;
    return address.startsWith(prefix) && /^\d+$/.test(address.slice(prefix.length));
}

function cloneBuffer(buffer: ArrayBuffer): ArrayBuffer {
    return buffer.slice(0);
}

function cloneKeyPair(keyPair: KeyPairType): KeyPairType {
    return {
        pubKey: cloneBuffer(keyPair.pubKey),
        privKey: cloneBuffer(keyPair.privKey),
    };
}

function buffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
    if (a.byteLength !== b.byteLength) {
        return false;
    }
    const av = new Uint8Array(a);
    const bv = new Uint8Array(b);
    for (let i = 0; i < av.length; i += 1) {
        if (av[i] !== bv[i]) {
            return false;
        }
    }
    return true;
}

async function bootstrapUser(name: string, deviceId: number) {
    const store = new InMemorySignalProtocolStore();
    const address = new SignalProtocolAddress(name, deviceId);

    const identity = await KeyHelper.generateIdentityKeyPair();
    const registrationId = KeyHelper.generateRegistrationId();
    store.setIdentityKeyPair(identity);
    store.setLocalRegistrationId(registrationId);

    const signedKeyId = 1;
    const signedPreKey = await KeyHelper.generateSignedPreKey(identity, signedKeyId);
    await store.storeSignedPreKey(signedKeyId, signedPreKey.keyPair);

    const preKeyId = 1;
    const preKey = await KeyHelper.generatePreKey(preKeyId);
    await store.storePreKey(preKeyId, preKey.keyPair);

    const device: DeviceType = {
        identityKey: identity.pubKey,
        // Two-key identity: the Ed25519 signing key verifies the signed pre-key.
        identitySigningKey: identity.signingPubKey,
        signedPreKey: {
            keyId: signedKeyId,
            publicKey: signedPreKey.keyPair.pubKey,
            signature: signedPreKey.signature,
        } satisfies SignedPublicPreKeyType,
        preKey: {
            keyId: preKey.keyId,
            publicKey: preKey.keyPair.pubKey,
        } satisfies PreKeyType,
        registrationId,
    };

    return { store, address, device };
}

type DeviceType = {
    identityKey: ArrayBuffer;
    identitySigningKey: ArrayBuffer;
    signedPreKey: SignedPublicPreKeyType;
    preKey?: PreKeyType;
    registrationId?: number;
};

export async function demo(): Promise<string> {
    const alice = await bootstrapUser('alice', 1);
    const bob = await bootstrapUser('bob', 1);

    const aliceBuilder = new SessionBuilder(alice.store, bob.address);
    await aliceBuilder.processPreKey(bob.device);

    const aliceCipher = new SessionCipher(alice.store, bob.address);
    const bobCipher = new SessionCipher(bob.store, alice.address);

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const plaintext = encoder.encode('hello from alice').buffer;

    const encrypted = await aliceCipher.encrypt(plaintext);

    let decrypted: ArrayBuffer;
    if (encrypted.type === 3 && encrypted.body) {
        decrypted = await bobCipher.decryptPreKeyWhisperMessage(encrypted.body);
    } else if (encrypted.body) {
        decrypted = await bobCipher.decryptWhisperMessage(encrypted.body);
    } else {
        throw new Error('Ciphertext missing body');
    }

    return decoder.decode(new Uint8Array(decrypted));
}
