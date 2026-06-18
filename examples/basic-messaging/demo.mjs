import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cjsEntry = resolve(__dirname, '../../lib/cjs/index.js');
const require = createRequire(import.meta.url);

async function loadLibrary() {
    try {
        await access(cjsEntry);
    } catch {
        console.error('Build artifacts missing. Run "yarn build" before executing the basic messaging demo.');
        process.exit(1);
    }
    return require(cjsEntry);
}

const { KeyHelper, SessionBuilder, SessionCipher, SignalProtocolAddress } = await loadLibrary();

const { TextEncoder, TextDecoder } = globalThis;

class InMemorySignalProtocolStore {
    constructor() {
        this.store = new Map();
    }

    setIdentityKeyPair(keyPair) {
        this.store.set('identityKey', cloneKeyPair(keyPair));
    }

    setLocalRegistrationId(id) {
        this.store.set('registrationId', id);
    }

    async getIdentityKeyPair() {
        const kp = this.store.get('identityKey');
        return kp ? cloneKeyPair(kp) : undefined;
    }

    async getLocalRegistrationId() {
        const rid = this.store.get('registrationId');
        return typeof rid === 'number' ? rid : undefined;
    }

    async isTrustedIdentity(identifier, identityKey) {
        const stored = this.store.get(`identity:${identifier}`);
        if (!stored) {
            return true;
        }
        return buffersEqual(stored, identityKey);
    }

    async saveIdentity(identifier, identityKey) {
        const existing = this.store.get(`identity:${identifier}`);
        this.store.set(`identity:${identifier}`, cloneBuffer(identityKey));
        if (!existing) {
            return false;
        }
        return !buffersEqual(existing, identityKey);
    }

    async loadPreKey(keyId) {
        const kp = this.store.get(`preKey:${keyId}`);
        return kp ? cloneKeyPair(kp) : undefined;
    }

    async storePreKey(keyId, keyPair) {
        this.store.set(`preKey:${keyId}`, cloneKeyPair(keyPair));
    }

    async removePreKey(keyId) {
        this.store.delete(`preKey:${keyId}`);
    }

    async loadSignedPreKey(keyId) {
        const kp = this.store.get(`signedPreKey:${keyId}`);
        return kp ? cloneKeyPair(kp) : undefined;
    }

    async storeSignedPreKey(keyId, keyPair) {
        this.store.set(`signedPreKey:${keyId}`, cloneKeyPair(keyPair));
    }

    async removeSignedPreKey(keyId) {
        this.store.delete(`signedPreKey:${keyId}`);
    }

    async loadSession(encodedAddress) {
        const record = this.store.get(`session:${encodedAddress}`);
        return typeof record === 'string' ? record : undefined;
    }

    async storeSession(encodedAddress, record) {
        this.store.set(`session:${encodedAddress}`, record);
    }

    async removeSession(identifier) {
        this.store.delete(`session:${identifier}`);
    }

    async removeAllSessions(identifier) {
        for (const key of this.store.keys()) {
            if (key.startsWith('session:') && sessionKeyBelongsTo(key.slice('session:'.length), identifier)) {
                this.store.delete(key);
            }
        }
    }
}

// True when a session address is exactly the identity or one of its
// `identity.deviceId` device entries — avoids `alice` matching `alicebob.1`.
function sessionKeyBelongsTo(address, identifier) {
    if (address === identifier) {
        return true;
    }
    const prefix = `${identifier}.`;
    return address.startsWith(prefix) && /^\d+$/.test(address.slice(prefix.length));
}

function cloneBuffer(buffer) {
    return buffer.slice(0);
}

function cloneKeyPair(keyPair) {
    return {
        pubKey: cloneBuffer(keyPair.pubKey),
        privKey: cloneBuffer(keyPair.privKey),
    };
}

function buffersEqual(a, b) {
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

async function bootstrapUser(name, deviceId) {
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

    const device = {
        identityKey: identity.pubKey,
        // Two-key identity: the Ed25519 signing key verifies the signed pre-key.
        identitySigningKey: identity.signingPubKey,
        signedPreKey: {
            keyId: signedPreKey.keyId,
            publicKey: signedPreKey.keyPair.pubKey,
            signature: signedPreKey.signature,
        },
        preKey: {
            keyId: preKey.keyId,
            publicKey: preKey.keyPair.pubKey,
        },
        registrationId,
    };

    return { store, address, device };
}

async function demo(message = 'hello from alice') {
    const alice = await bootstrapUser('alice', 1);
    const bob = await bootstrapUser('bob', 1);

    const aliceBuilder = new SessionBuilder(alice.store, bob.address);
    await aliceBuilder.processPreKey(bob.device);

    const aliceCipher = new SessionCipher(alice.store, bob.address);
    const bobCipher = new SessionCipher(bob.store, alice.address);

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const plaintext = encoder.encode(message).buffer;

    const encrypted = await aliceCipher.encrypt(plaintext);

    let decrypted;
    if (encrypted.type === 3 && encrypted.body) {
        decrypted = await bobCipher.decryptPreKeyWhisperMessage(encrypted.body);
    } else if (encrypted.body) {
        decrypted = await bobCipher.decryptWhisperMessage(encrypted.body);
    } else {
        throw new Error('Ciphertext missing body');
    }

    return decoder.decode(new Uint8Array(decrypted));
}

(async () => {
    try {
        const payload = process.argv[2];
        const result = await demo(payload);
        console.log(result);
    } catch (error) {
        console.error('Basic messaging demo failed');
        console.error((error && error.stack) || error);
        process.exitCode = 1;
    }
})();
