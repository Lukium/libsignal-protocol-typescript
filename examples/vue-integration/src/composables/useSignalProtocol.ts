import { ref, provide, inject, onMounted, type Ref, type InjectionKey } from 'vue';
import { KeyHelper, SessionBuilder, SessionCipher, SignalProtocolAddress } from '@lukium/libsignal-protocol-typescript';
import type { StorageType, DeviceType, KeyPairType, Direction } from '@lukium/libsignal-protocol-typescript';

// Types
export interface MessageType {
    type: number;
    body?: string;
    registrationId?: number;
}

export interface PreKeyType {
    keyId: number;
    keyPair: KeyPairType;
}

export interface SignedPreKeyType extends PreKeyType {
    signature: ArrayBuffer;
}

export interface SignalProtocolState {
    isInitialized: Ref<boolean>;
    identityKey: Ref<ArrayBuffer | null>;
    registrationId: Ref<number | null>;
    establishSession: (address: string, preKeyBundle: DeviceType) => Promise<void>;
    hasSession: (address: string) => Promise<boolean>;
    closeSession: (address: string) => Promise<void>;
    encrypt: (address: string, plaintext: string) => Promise<MessageType>;
    decrypt: (address: string, ciphertext: MessageType) => Promise<string>;
    generatePreKeys: (start: number, count: number) => Promise<PreKeyType[]>;
    generateSignedPreKey: (keyId: number) => Promise<SignedPreKeyType>;
    getPreKeyBundle: () => Promise<DeviceType>;
}

// Injection key
const SignalProtocolKey: InjectionKey<SignalProtocolState> = Symbol('SignalProtocol');

/**
 * Creates an in-memory Signal Protocol store.
 */
function createMemoryStore(): StorageType & {
    setIdentityKeyPair: (kp: KeyPairType) => void;
    setLocalRegistrationId: (id: number) => void;
} {
    const data: Record<string, unknown> = {};

    return {
        getIdentityKeyPair: () => Promise.resolve(data.identityKeyPair as KeyPairType | undefined),
        getLocalRegistrationId: () => Promise.resolve(data.registrationId as number | undefined),
        isTrustedIdentity: (_id: string, _key: ArrayBuffer, _dir: Direction) => Promise.resolve(true),
        saveIdentity: () => Promise.resolve(false),
        loadPreKey: (id: number) => Promise.resolve(data[`preKey:${id}`] as KeyPairType | undefined),
        storePreKey: (id: number, kp: KeyPairType) => {
            data[`preKey:${id}`] = kp;
            return Promise.resolve();
        },
        removePreKey: (id: number) => {
            delete data[`preKey:${id}`];
            return Promise.resolve();
        },
        loadSignedPreKey: (id: number) => Promise.resolve(data[`signedPreKey:${id}`] as KeyPairType | undefined),
        storeSignedPreKey: (id: number, kp: KeyPairType) => {
            data[`signedPreKey:${id}`] = kp;
            return Promise.resolve();
        },
        removeSignedPreKey: (id: number) => {
            delete data[`signedPreKey:${id}`];
            return Promise.resolve();
        },
        loadSession: (addr: string) => Promise.resolve(data[`session:${addr}`] as string | undefined),
        storeSession: (addr: string, record: string) => {
            data[`session:${addr}`] = record;
            return Promise.resolve();
        },
        removeSession: (addr: string) => {
            delete data[`session:${addr}`];
            return Promise.resolve();
        },
        removeAllSessions: () => Promise.resolve(),
        setIdentityKeyPair: (kp: KeyPairType) => {
            data.identityKeyPair = kp;
        },
        setLocalRegistrationId: (id: number) => {
            data.registrationId = id;
        },
    };
}

export interface ProvideSignalProtocolOptions {
    storageAdapter?: StorageType;
}

/**
 * Provides Signal Protocol state to child components.
 * Call this in your root component's setup function.
 *
 * @example
 * ```vue
 * <script setup>
 * import { provideSignalProtocol } from './composables/useSignalProtocol';
 * provideSignalProtocol();
 * </script>
 * ```
 */
export function provideSignalProtocol(options?: ProvideSignalProtocolOptions): SignalProtocolState {
    const store = options?.storageAdapter ?? createMemoryStore();

    // Reactive state
    const isInitialized = ref(false);
    const identityKey = ref<ArrayBuffer | null>(null);
    const registrationId = ref<number | null>(null);

    // Initialize on mount
    onMounted(async () => {
        let idKeyPair = await store.getIdentityKeyPair();
        let regId = await store.getLocalRegistrationId();

        if (!idKeyPair) {
            idKeyPair = await KeyHelper.generateIdentityKeyPair();
            if ('setIdentityKeyPair' in store && typeof store.setIdentityKeyPair === 'function') {
                (store as { setIdentityKeyPair: (kp: KeyPairType) => void }).setIdentityKeyPair(idKeyPair);
            }
        }

        if (!regId) {
            regId = KeyHelper.generateRegistrationId();
            if ('setLocalRegistrationId' in store && typeof store.setLocalRegistrationId === 'function') {
                (store as { setLocalRegistrationId: (id: number) => void }).setLocalRegistrationId(regId);
            }
        }

        identityKey.value = idKeyPair.pubKey;
        registrationId.value = regId;
        isInitialized.value = true;
    });

    // Methods
    async function establishSession(address: string, preKeyBundle: DeviceType): Promise<void> {
        const signalAddress = SignalProtocolAddress.fromString(address);
        const builder = new SessionBuilder(store, signalAddress);
        await builder.processPreKey(preKeyBundle);
    }

    async function hasSession(address: string): Promise<boolean> {
        const signalAddress = SignalProtocolAddress.fromString(address);
        const cipher = new SessionCipher(store, signalAddress);
        return cipher.hasOpenSession();
    }

    async function closeSession(address: string): Promise<void> {
        const signalAddress = SignalProtocolAddress.fromString(address);
        const cipher = new SessionCipher(store, signalAddress);
        await cipher.closeOpenSessionForDevice();
    }

    async function encrypt(address: string, plaintext: string): Promise<MessageType> {
        const signalAddress = SignalProtocolAddress.fromString(address);
        const cipher = new SessionCipher(store, signalAddress);
        const encoder = new TextEncoder();
        return cipher.encrypt(encoder.encode(plaintext).buffer);
    }

    async function decrypt(address: string, ciphertext: MessageType): Promise<string> {
        const signalAddress = SignalProtocolAddress.fromString(address);
        const cipher = new SessionCipher(store, signalAddress);

        let plaintext: ArrayBuffer;
        if (ciphertext.type === 3) {
            plaintext = await cipher.decryptPreKeyWhisperMessage(ciphertext.body!, 'binary');
        } else {
            plaintext = await cipher.decryptWhisperMessage(ciphertext.body!, 'binary');
        }

        return new TextDecoder().decode(new Uint8Array(plaintext));
    }

    async function generatePreKeys(start: number, count: number): Promise<PreKeyType[]> {
        const preKeys: PreKeyType[] = [];
        for (let i = 0; i < count; i++) {
            const preKey = await KeyHelper.generatePreKey(start + i);
            await store.storePreKey(preKey.keyId, preKey.keyPair);
            preKeys.push(preKey);
        }
        return preKeys;
    }

    async function generateSignedPreKey(keyId: number): Promise<SignedPreKeyType> {
        const idKeyPair = await store.getIdentityKeyPair();
        if (!idKeyPair) throw new Error('Identity key not initialized');

        const signedPreKey = await KeyHelper.generateSignedPreKey(idKeyPair, keyId);
        await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);
        return signedPreKey;
    }

    async function getPreKeyBundle(): Promise<DeviceType> {
        const idKeyPair = await store.getIdentityKeyPair();
        const regId = await store.getLocalRegistrationId();
        if (!idKeyPair || !regId) throw new Error('Identity not initialized');

        const preKey = await KeyHelper.generatePreKey(Math.floor(Math.random() * 0xffffff));
        const signedPreKey = await KeyHelper.generateSignedPreKey(idKeyPair, 1);

        await store.storePreKey(preKey.keyId, preKey.keyPair);
        await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

        return {
            identityKey: idKeyPair.pubKey,
            registrationId: regId,
            preKey: { keyId: preKey.keyId, publicKey: preKey.keyPair.pubKey },
            signedPreKey: {
                keyId: signedPreKey.keyId,
                publicKey: signedPreKey.keyPair.pubKey,
                signature: signedPreKey.signature,
            },
        };
    }

    const state: SignalProtocolState = {
        isInitialized,
        identityKey,
        registrationId,
        establishSession,
        hasSession,
        closeSession,
        encrypt,
        decrypt,
        generatePreKeys,
        generateSignedPreKey,
        getPreKeyBundle,
    };

    provide(SignalProtocolKey, state);
    return state;
}

/**
 * Injects Signal Protocol state from a parent provider.
 *
 * @example
 * ```vue
 * <script setup>
 * import { injectSignalProtocol } from './composables/useSignalProtocol';
 * const { isInitialized, encrypt, decrypt } = injectSignalProtocol();
 * </script>
 * ```
 */
export function injectSignalProtocol(): SignalProtocolState {
    const state = inject(SignalProtocolKey);
    if (!state) {
        throw new Error('Signal Protocol not provided. Call provideSignalProtocol() in a parent component.');
    }
    return state;
}

/**
 * Standalone composable for simpler use cases.
 * Creates its own store and doesn't use provide/inject.
 */
export function useSignalProtocol(options?: ProvideSignalProtocolOptions) {
    return provideSignalProtocol(options);
}
