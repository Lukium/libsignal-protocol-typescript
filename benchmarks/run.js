const { performance } = require('node:perf_hooks');
const { TextEncoder } = require('node:util');

const {
    KeyHelper,
    SessionBuilder,
    SessionCipher,
    SignalProtocolAddress,
} = require('../lib/cjs');

const RUNS = Number(process.env.BENCH_RUNS ?? 5);
const encoder = new TextEncoder();
const PLAINTEXT = encoder.encode('benchmark payload');

function getPlaintextBuffer() {
    return PLAINTEXT.slice().buffer;
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
    const av = new Uint8Array(a);
    const bv = new Uint8Array(b);
    if (av.length !== bv.length) {
        return false;
    }
    for (let i = 0; i < av.length; i += 1) {
        if (av[i] !== bv[i]) {
            return false;
        }
    }
    return true;
}

function createMemoryStore() {
    let identityKeyPair;
    let registrationId;
    const identities = new Map();
    const preKeys = new Map();
    const signedPreKeys = new Map();
    const sessions = new Map();

    return {
        async setIdentityKeyPair(keyPair) {
            identityKeyPair = cloneKeyPair(keyPair);
        },
        async getIdentityKeyPair() {
            return identityKeyPair ? cloneKeyPair(identityKeyPair) : undefined;
        },
        async setLocalRegistrationId(id) {
            registrationId = id;
        },
        async getLocalRegistrationId() {
            return registrationId;
        },
        async isTrustedIdentity(identifier, identityKey) {
            const existing = identities.get(identifier);
            if (!existing) {
                return true;
            }
            return buffersEqual(existing, identityKey);
        },
        async saveIdentity(identifier, identityKey) {
            const existing = identities.get(identifier);
            identities.set(identifier, cloneBuffer(identityKey));
            if (!existing) {
                return false;
            }
            return !buffersEqual(existing, identityKey);
        },
        async loadPreKey(id) {
            const keyPair = preKeys.get(id);
            return keyPair ? cloneKeyPair(keyPair) : undefined;
        },
        async storePreKey(id, keyPair) {
            preKeys.set(id, cloneKeyPair(keyPair));
        },
        async removePreKey(id) {
            preKeys.delete(id);
        },
        async loadSignedPreKey(id) {
            const keyPair = signedPreKeys.get(id);
            return keyPair ? cloneKeyPair(keyPair) : undefined;
        },
        async storeSignedPreKey(id, keyPair) {
            signedPreKeys.set(id, cloneKeyPair(keyPair));
        },
        async removeSignedPreKey(id) {
            signedPreKeys.delete(id);
        },
        async storeSession(identifier, record) {
            sessions.set(identifier, record);
        },
        async loadSession(identifier) {
            return sessions.get(identifier);
        },
    };
}

async function initialiseStore(store) {
    const identity = await KeyHelper.generateIdentityKeyPair();
    await store.setIdentityKeyPair(identity);
    await store.setLocalRegistrationId(KeyHelper.generateRegistrationId());
}

async function generatePreKeyBundle(store, preKeyId, signedPreKeyId) {
    const identity = await store.getIdentityKeyPair();
    const registrationId = await store.getLocalRegistrationId();

    const preKey = await KeyHelper.generatePreKey(preKeyId);
    const signedPreKey = await KeyHelper.generateSignedPreKey(identity, signedPreKeyId);

    await store.storePreKey(preKeyId, preKey.keyPair);
    await store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);

    return {
        identityKey: identity.pubKey,
        registrationId,
        preKey: {
            keyId: preKeyId,
            publicKey: preKey.keyPair.pubKey,
        },
        signedPreKey: {
            keyId: signedPreKeyId,
            publicKey: signedPreKey.keyPair.pubKey,
            signature: signedPreKey.signature,
        },
    };
}

async function prepareSession() {
    const aliceStore = createMemoryStore();
    const bobStore = createMemoryStore();

    await initialiseStore(aliceStore);
    await initialiseStore(bobStore);

    const bobAddress = new SignalProtocolAddress('bob', 1);
    const aliceAddress = new SignalProtocolAddress('alice', 1);

    const bundle = await generatePreKeyBundle(bobStore, 1, 1);
    const builder = new SessionBuilder(aliceStore, bobAddress);

    return { aliceStore, bobStore, bobAddress, aliceAddress, builder, bundle };
}

async function measure(label, fn) {
    let total = 0;
    for (let i = 0; i < RUNS; i += 1) {
        const duration = await fn();
        total += duration;
    }
    return [label, total / RUNS];
}

async function benchmarkKeyGeneration() {
    const start = performance.now();
    await KeyHelper.generateIdentityKeyPair();
    return performance.now() - start;
}

async function benchmarkSessionSetup() {
    const { builder, bundle } = await prepareSession();
    const start = performance.now();
    await builder.processPreKey(bundle);
    return performance.now() - start;
}

async function benchmarkEncrypt() {
    const { builder, bundle, aliceStore, bobStore, bobAddress } = await prepareSession();
    await builder.processPreKey(bundle);
    const aliceCipher = new SessionCipher(aliceStore, bobAddress);
    // warm-up
    await aliceCipher.encrypt(getPlaintextBuffer());
    const start = performance.now();
    await aliceCipher.encrypt(getPlaintextBuffer());
    return performance.now() - start;
}

async function benchmarkDecrypt() {
    const { builder, bundle, aliceStore, bobStore, bobAddress, aliceAddress } = await prepareSession();
    await builder.processPreKey(bundle);
    const aliceCipher = new SessionCipher(aliceStore, bobAddress);
    const bobCipher = new SessionCipher(bobStore, aliceAddress);
    const message = await aliceCipher.encrypt(getPlaintextBuffer());
    const start = performance.now();
    if (message.type === 3) {
        await bobCipher.decryptPreKeyWhisperMessage(message.body, 'binary');
    } else {
        await bobCipher.decryptWhisperMessage(message.body, 'binary');
    }
    return performance.now() - start;
}

async function run() {
    const measurements = [];

    measurements.push(await measure('KeyHelper.generateIdentityKeyPair', benchmarkKeyGeneration));
    measurements.push(await measure('SessionBuilder.processPreKey', benchmarkSessionSetup));
    measurements.push(await measure('SessionCipher.encrypt', benchmarkEncrypt));
    measurements.push(await measure('SessionCipher.decrypt', benchmarkDecrypt));

    console.log(`Benchmark runs: ${RUNS}`);
    for (const [label, value] of measurements) {
        console.log(`${label}: ${value.toFixed(2)} ms (avg)`);
    }
}

run().catch((error) => {
    console.error('Benchmark failed:', error);
    process.exit(1);
});
