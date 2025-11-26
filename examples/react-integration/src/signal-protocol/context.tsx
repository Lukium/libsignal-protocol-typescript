import React, { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import {
    KeyHelper,
    SessionBuilder,
    SessionCipher,
    SignalProtocolAddress,
} from '@lukium/libsignal-protocol-typescript';
import type { StorageType, DeviceType } from '@lukium/libsignal-protocol-typescript';
import type {
    SignalProtocolContextValue,
    SignalProtocolState,
    MessageType,
    PreKeyType,
    SignedPreKeyType,
} from './types';
import { createMemoryStore } from './store';

const SignalProtocolContext = createContext<SignalProtocolContextValue | null>(null);

export interface SignalProtocolProviderProps {
    children: ReactNode;
    /** Custom storage adapter. Defaults to in-memory store. */
    storageAdapter?: StorageType;
}

/**
 * Provider component that initializes and manages Signal Protocol state.
 *
 * @example
 * ```tsx
 * <SignalProtocolProvider>
 *   <App />
 * </SignalProtocolProvider>
 * ```
 */
export function SignalProtocolProvider({ children, storageAdapter }: SignalProtocolProviderProps) {
    const storeRef = useRef<StorageType>(storageAdapter ?? createMemoryStore());
    const [state, setState] = useState<SignalProtocolState>({
        isInitialized: false,
        identityKey: null,
        registrationId: null,
    });

    // Initialize identity on mount
    useEffect(() => {
        const initialize = async () => {
            const store = storeRef.current;

            // Check if we already have an identity
            let identityKeyPair = await store.getIdentityKeyPair();
            let registrationId = await store.getLocalRegistrationId();

            if (!identityKeyPair) {
                // Generate new identity
                identityKeyPair = await KeyHelper.generateIdentityKeyPair();
                // Store it if the store supports it
                if ('setIdentityKeyPair' in store && typeof store.setIdentityKeyPair === 'function') {
                    (store as { setIdentityKeyPair: (kp: typeof identityKeyPair) => void }).setIdentityKeyPair(
                        identityKeyPair
                    );
                }
            }

            if (!registrationId) {
                registrationId = KeyHelper.generateRegistrationId();
                if ('setLocalRegistrationId' in store && typeof store.setLocalRegistrationId === 'function') {
                    (store as { setLocalRegistrationId: (id: number) => void }).setLocalRegistrationId(registrationId);
                }
            }

            setState({
                isInitialized: true,
                identityKey: identityKeyPair.pubKey,
                registrationId,
            });
        };

        initialize().catch(console.error);
    }, []);

    const establishSession = useCallback(async (address: string, preKeyBundle: DeviceType) => {
        const store = storeRef.current;
        const signalAddress = SignalProtocolAddress.fromString(address);
        const builder = new SessionBuilder(store, signalAddress);
        await builder.processPreKey(preKeyBundle);
    }, []);

    const hasSession = useCallback(async (address: string): Promise<boolean> => {
        const store = storeRef.current;
        const signalAddress = SignalProtocolAddress.fromString(address);
        const cipher = new SessionCipher(store, signalAddress);
        return cipher.hasOpenSession();
    }, []);

    const closeSession = useCallback(async (address: string) => {
        const store = storeRef.current;
        const signalAddress = SignalProtocolAddress.fromString(address);
        const cipher = new SessionCipher(store, signalAddress);
        await cipher.closeOpenSessionForDevice();
    }, []);

    const encrypt = useCallback(async (address: string, plaintext: string): Promise<MessageType> => {
        const store = storeRef.current;
        const signalAddress = SignalProtocolAddress.fromString(address);
        const cipher = new SessionCipher(store, signalAddress);
        const encoder = new TextEncoder();
        return cipher.encrypt(encoder.encode(plaintext).buffer);
    }, []);

    const decrypt = useCallback(async (address: string, ciphertext: MessageType): Promise<string> => {
        const store = storeRef.current;
        const signalAddress = SignalProtocolAddress.fromString(address);
        const cipher = new SessionCipher(store, signalAddress);

        let plaintext: ArrayBuffer;
        if (ciphertext.type === 3) {
            // PreKeyWhisperMessage
            plaintext = await cipher.decryptPreKeyWhisperMessage(ciphertext.body!, 'binary');
        } else {
            // WhisperMessage
            plaintext = await cipher.decryptWhisperMessage(ciphertext.body!, 'binary');
        }

        const decoder = new TextDecoder();
        return decoder.decode(new Uint8Array(plaintext));
    }, []);

    const generatePreKeys = useCallback(async (start: number, count: number): Promise<PreKeyType[]> => {
        const store = storeRef.current;
        const preKeys: PreKeyType[] = [];

        for (let i = 0; i < count; i++) {
            const preKey = await KeyHelper.generatePreKey(start + i);
            await store.storePreKey(preKey.keyId, preKey.keyPair);
            preKeys.push(preKey);
        }

        return preKeys;
    }, []);

    const generateSignedPreKey = useCallback(async (keyId: number): Promise<SignedPreKeyType> => {
        const store = storeRef.current;
        const identityKeyPair = await store.getIdentityKeyPair();

        if (!identityKeyPair) {
            throw new Error('Identity key not initialized');
        }

        const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, keyId);
        await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

        return signedPreKey;
    }, []);

    const getPreKeyBundle = useCallback(async (): Promise<DeviceType> => {
        const store = storeRef.current;
        const identityKeyPair = await store.getIdentityKeyPair();
        const registrationId = await store.getLocalRegistrationId();

        if (!identityKeyPair || !registrationId) {
            throw new Error('Identity not initialized');
        }

        // Generate a pre-key and signed pre-key for the bundle
        const preKey = await KeyHelper.generatePreKey(Math.floor(Math.random() * 0xffffff));
        const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, 1);

        await store.storePreKey(preKey.keyId, preKey.keyPair);
        await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

        return {
            identityKey: identityKeyPair.pubKey,
            registrationId,
            preKey: {
                keyId: preKey.keyId,
                publicKey: preKey.keyPair.pubKey,
            },
            signedPreKey: {
                keyId: signedPreKey.keyId,
                publicKey: signedPreKey.keyPair.pubKey,
                signature: signedPreKey.signature,
            },
        };
    }, []);

    const value: SignalProtocolContextValue = {
        ...state,
        establishSession,
        hasSession,
        closeSession,
        encrypt,
        decrypt,
        generatePreKeys,
        generateSignedPreKey,
        getPreKeyBundle,
    };

    return <SignalProtocolContext.Provider value={value}>{children}</SignalProtocolContext.Provider>;
}

/**
 * Hook to access Signal Protocol functionality.
 *
 * @example
 * ```tsx
 * function SecureChat() {
 *   const { isInitialized, encrypt, decrypt } = useSignalProtocol();
 *   // ...
 * }
 * ```
 */
export function useSignalProtocol(): SignalProtocolContextValue {
    const context = useContext(SignalProtocolContext);
    if (!context) {
        throw new Error('useSignalProtocol must be used within a SignalProtocolProvider');
    }
    return context;
}
