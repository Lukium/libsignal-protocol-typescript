/**
 * Browser entry point for the Signal Protocol library.
 * This is bundled into bundle.js and exposes classes on window.SignalProtocol
 */

import { KeyHelper } from '../../lib/esm/key-helper.js';
import { SessionBuilder } from '../../lib/esm/session-builder.js';
import { SessionCipher } from '../../lib/esm/session-cipher.js';
import { SignalProtocolAddress } from '../../lib/esm/signal-protocol-address.js';

// Create a simple in-memory store for the demo
function createMemoryStore() {
    const data = {};

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

    return {
        // Identity
        setIdentityKeyPair(keyPair) {
            data.identityKeyPair = cloneKeyPair(keyPair);
        },
        async getIdentityKeyPair() {
            return data.identityKeyPair ? cloneKeyPair(data.identityKeyPair) : undefined;
        },
        setLocalRegistrationId(id) {
            data.registrationId = id;
        },
        async getLocalRegistrationId() {
            return data.registrationId;
        },

        // Trust
        async isTrustedIdentity(identifier, identityKey, direction) {
            const existing = data[`identity:${identifier}`];
            if (!existing) return true;
            return buffersEqual(existing, identityKey);
        },
        async saveIdentity(identifier, identityKey) {
            const existing = data[`identity:${identifier}`];
            data[`identity:${identifier}`] = cloneBuffer(identityKey);
            if (!existing) return false;
            return !buffersEqual(existing, identityKey);
        },

        // Pre-keys
        async loadPreKey(id) {
            const kp = data[`preKey:${id}`];
            return kp ? cloneKeyPair(kp) : undefined;
        },
        async storePreKey(id, keyPair) {
            data[`preKey:${id}`] = cloneKeyPair(keyPair);
        },
        async removePreKey(id) {
            delete data[`preKey:${id}`];
        },

        // Signed pre-keys
        async loadSignedPreKey(id) {
            const kp = data[`signedPreKey:${id}`];
            return kp ? cloneKeyPair(kp) : undefined;
        },
        async storeSignedPreKey(id, keyPair) {
            data[`signedPreKey:${id}`] = cloneKeyPair(keyPair);
        },
        async removeSignedPreKey(id) {
            delete data[`signedPreKey:${id}`];
        },

        // Sessions
        async loadSession(identifier) {
            return data[`session:${identifier}`];
        },
        async storeSession(identifier, record) {
            data[`session:${identifier}`] = record;
        },
        async removeSession(identifier) {
            delete data[`session:${identifier}`];
        },
        async removeAllSessions(identifier) {
            // Remove only this identity's device sessions (exact address or
            // `identity.deviceId`), never an unrelated identity sharing a prefix.
            for (const key of Object.keys(data)) {
                if (!key.startsWith('session:')) continue;
                const addr = key.slice('session:'.length);
                const prefix = `${identifier}.`;
                if (addr === identifier || (addr.startsWith(prefix) && /^\d+$/.test(addr.slice(prefix.length)))) {
                    delete data[key];
                }
            }
        },
    };
}

// Export everything
export {
    KeyHelper,
    SessionBuilder,
    SessionCipher,
    SignalProtocolAddress,
    createMemoryStore,
};
