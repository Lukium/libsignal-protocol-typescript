import type { StorageType, DeviceType, KeyPairType } from '@lukium/libsignal-protocol-typescript';

export type { StorageType, DeviceType, KeyPairType };

export interface PreKeyType {
    keyId: number;
    keyPair: KeyPairType;
}

export interface SignedPreKeyType extends PreKeyType {
    signature: ArrayBuffer;
}

export interface MessageType {
    type: number;
    body?: string;
    registrationId?: number;
}

export interface SignalProtocolState {
    isInitialized: boolean;
    identityKey: ArrayBuffer | null;
    registrationId: number | null;
}

export interface SignalProtocolActions {
    establishSession: (address: string, preKeyBundle: DeviceType) => Promise<void>;
    hasSession: (address: string) => Promise<boolean>;
    closeSession: (address: string) => Promise<void>;
    encrypt: (address: string, plaintext: string) => Promise<MessageType>;
    decrypt: (address: string, ciphertext: MessageType) => Promise<string>;
    generatePreKeys: (start: number, count: number) => Promise<PreKeyType[]>;
    generateSignedPreKey: (keyId: number) => Promise<SignedPreKeyType>;
    getPreKeyBundle: () => Promise<DeviceType>;
}

export type SignalProtocolContextValue = SignalProtocolState & SignalProtocolActions;
