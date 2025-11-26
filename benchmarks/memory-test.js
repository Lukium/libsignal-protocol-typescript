/**
 * Memory leak test for Signal Protocol operations.
 * Run with: node --expose-gc benchmarks/memory-test.js
 */

const { TextEncoder } = require('node:util');

const {
    KeyHelper,
    SessionBuilder,
    SessionCipher,
    SignalProtocolAddress,
} = require('../lib/cjs');

const encoder = new TextEncoder();
const ITERATIONS = 100;
const MESSAGE = encoder.encode('Test message for memory leak detection');

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
    if (av.length !== bv.length) return false;
    for (let i = 0; i < av.length; i++) {
        if (av[i] !== bv[i]) return false;
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
            if (!existing) return true;
            return buffersEqual(existing, identityKey);
        },
        async saveIdentity(identifier, identityKey) {
            const existing = identities.get(identifier);
            identities.set(identifier, cloneBuffer(identityKey));
            if (!existing) return false;
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

function getMemoryUsage() {
    if (global.gc) {
        global.gc();
    }
    return process.memoryUsage().heapUsed;
}

function formatBytes(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function setupSession() {
    const aliceStore = createMemoryStore();
    const bobStore = createMemoryStore();

    const aliceIdentity = await KeyHelper.generateIdentityKeyPair();
    await aliceStore.setIdentityKeyPair(aliceIdentity);
    await aliceStore.setLocalRegistrationId(KeyHelper.generateRegistrationId());

    const bobIdentity = await KeyHelper.generateIdentityKeyPair();
    await bobStore.setIdentityKeyPair(bobIdentity);
    await bobStore.setLocalRegistrationId(KeyHelper.generateRegistrationId());

    const bobAddress = new SignalProtocolAddress('bob', 1);
    const aliceAddress = new SignalProtocolAddress('alice', 1);

    // Generate Bob's pre-key bundle
    const preKey = await KeyHelper.generatePreKey(1);
    const signedPreKey = await KeyHelper.generateSignedPreKey(bobIdentity, 1);
    await bobStore.storePreKey(1, preKey.keyPair);
    await bobStore.storeSignedPreKey(1, signedPreKey.keyPair);

    const bundle = {
        identityKey: bobIdentity.pubKey,
        registrationId: await bobStore.getLocalRegistrationId(),
        preKey: { keyId: 1, publicKey: preKey.keyPair.pubKey },
        signedPreKey: {
            keyId: 1,
            publicKey: signedPreKey.keyPair.pubKey,
            signature: signedPreKey.signature,
        },
    };

    // Establish session
    const builder = new SessionBuilder(aliceStore, bobAddress);
    await builder.processPreKey(bundle);

    return { aliceStore, bobStore, bobAddress, aliceAddress };
}

async function decryptMessage(cipher, message) {
    if (message.type === 3) {
        return cipher.decryptPreKeyWhisperMessage(message.body, 'binary');
    } else {
        return cipher.decryptWhisperMessage(message.body, 'binary');
    }
}

async function testEncryptDecryptLoop() {
    console.log('\n=== Encrypt/Decrypt Loop Memory Test ===');
    console.log(`Running ${ITERATIONS} encrypt/decrypt cycles...`);

    const { aliceStore, bobStore, bobAddress, aliceAddress } = await setupSession();
    const aliceCipher = new SessionCipher(aliceStore, bobAddress);
    const bobCipher = new SessionCipher(bobStore, aliceAddress);

    const startMemory = getMemoryUsage();
    console.log(`Starting memory: ${formatBytes(startMemory)}`);

    // Send first message to establish Bob's session (this is a PreKeyWhisperMessage)
    const firstMsg = await aliceCipher.encrypt(MESSAGE.slice().buffer);
    await decryptMessage(bobCipher, firstMsg);

    for (let i = 0; i < ITERATIONS; i++) {
        // Alice sends to Bob
        const aliceMsg = await aliceCipher.encrypt(MESSAGE.slice().buffer);
        await decryptMessage(bobCipher, aliceMsg);

        // Bob sends to Alice (first message from Bob will also be PreKeyWhisperMessage)
        const bobMsg = await bobCipher.encrypt(MESSAGE.slice().buffer);
        await decryptMessage(aliceCipher, bobMsg);

        if ((i + 1) % 25 === 0) {
            const currentMemory = getMemoryUsage();
            console.log(`After ${i + 1} cycles: ${formatBytes(currentMemory)} (delta: ${formatBytes(currentMemory - startMemory)})`);
        }
    }

    const endMemory = getMemoryUsage();
    const delta = endMemory - startMemory;

    console.log(`\nFinal memory: ${formatBytes(endMemory)}`);
    console.log(`Total delta: ${formatBytes(delta)}`);
    console.log(`Delta per cycle: ${formatBytes(delta / ITERATIONS)}`);

    // Check for significant leak
    // Expected: ~7-10 KB per message cycle for session state growth is normal
    // Concerning: more than 2 MB for 100 cycles would indicate a real leak
    const leakThreshold = 2 * 1024 * 1024; // 2 MB
    if (delta > leakThreshold) {
        console.log(`\nWARNING: Potential memory leak detected (>${formatBytes(leakThreshold)} growth)`);
        return false;
    } else {
        console.log(`\nPASS: Memory growth within acceptable limits`);
        return true;
    }
}

async function testSessionCreationLoop() {
    console.log('\n=== Session Creation/Destruction Memory Test ===');
    console.log(`Running ${ITERATIONS} session creation cycles...`);

    const startMemory = getMemoryUsage();
    console.log(`Starting memory: ${formatBytes(startMemory)}`);

    for (let i = 0; i < ITERATIONS; i++) {
        await setupSession();

        if ((i + 1) % 25 === 0) {
            const currentMemory = getMemoryUsage();
            console.log(`After ${i + 1} sessions: ${formatBytes(currentMemory)} (delta: ${formatBytes(currentMemory - startMemory)})`);
        }
    }

    const endMemory = getMemoryUsage();
    const delta = endMemory - startMemory;

    console.log(`\nFinal memory: ${formatBytes(endMemory)}`);
    console.log(`Total delta: ${formatBytes(delta)}`);
    console.log(`Delta per session: ${formatBytes(delta / ITERATIONS)}`);

    // Check for significant leak
    // Expected: ~8 KB per session for state is normal (sessions are GC'd but Maps hold refs)
    // Concerning: more than 5 MB for 100 sessions would indicate a real leak
    const leakThreshold = 5 * 1024 * 1024; // 5 MB
    if (delta > leakThreshold) {
        console.log(`\nWARNING: Potential memory leak detected (>${formatBytes(leakThreshold)} growth)`);
        return false;
    } else {
        console.log(`\nPASS: Memory growth within acceptable limits`);
        return true;
    }
}

async function run() {
    if (!global.gc) {
        console.log('Warning: Run with --expose-gc for accurate memory measurements');
        console.log('Example: node --expose-gc benchmarks/memory-test.js\n');
    }

    console.log('Signal Protocol Memory Leak Test');
    console.log('================================');

    const results = [];
    results.push(await testEncryptDecryptLoop());
    results.push(await testSessionCreationLoop());

    console.log('\n================================');
    console.log('Summary:');
    console.log(`  Encrypt/Decrypt Loop: ${results[0] ? 'PASS' : 'FAIL'}`);
    console.log(`  Session Creation:     ${results[1] ? 'PASS' : 'FAIL'}`);

    if (results.every(r => r)) {
        console.log('\nAll memory tests passed!');
        process.exit(0);
    } else {
        console.log('\nSome memory tests failed. Review output above.');
        process.exit(1);
    }
}

run().catch((error) => {
    console.error('Memory test failed:', error);
    process.exit(1);
});
