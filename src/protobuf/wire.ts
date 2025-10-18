/* istanbul ignore file */
import { Root, Type, Writer } from 'protobufjs/light';
import type { INamespace } from 'protobufjs';
import wireJson from './wire.json';

const root = Root.fromJSON(wireJson as INamespace);
const signalMessageType = root.lookupType('signal.proto.wire.SignalMessage') as Type;
const preKeySignalMessageType = root.lookupType('signal.proto.wire.PreKeySignalMessage') as Type;

const hasToNumber = (value: unknown): value is { toNumber: () => number } =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toNumber?: () => number }).toNumber === 'function';

const toOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    if (hasToNumber(value)) {
        return value.toNumber();
    }
    return undefined;
};

interface Codec<T> {
    create(base?: Partial<T>): T;
    encode(message: T): Writer;
    decode(input: Uint8Array | ArrayBuffer): T;
    fromObject(object: Record<string, unknown>): T;
    fromJSON?(object: Record<string, unknown>): T;
    toJSON?(message: T): Record<string, unknown>;
}

export interface SignalMessage {
    ratchetKey?: Uint8Array;
    counter?: number;
    previousCounter?: number;
    ciphertext?: Uint8Array;
    pqRatchet?: Uint8Array;
}

export interface PreKeySignalMessage {
    registrationId?: number;
    preKeyId?: number;
    signedPreKeyId?: number;
    kyberPreKeyId?: number;
    kyberCiphertext?: Uint8Array;
    baseKey?: Uint8Array;
    identityKey?: Uint8Array;
    message?: Uint8Array;
}

type SignalMessageJSON = {
    ratchetKey?: string;
    counter?: number;
    previousCounter?: number;
    ciphertext?: string;
    pqRatchet?: string;
};

type PreKeySignalMessageJSON = {
    registrationId?: number;
    preKeyId?: number;
    signedPreKeyId?: number;
    kyberPreKeyId?: number;
    kyberCiphertext?: string;
    baseKey?: string;
    identityKey?: string;
    message?: string;
};

const defaultSignalMessage = (): SignalMessage => ({
    ratchetKey: undefined,
    counter: undefined,
    previousCounter: undefined,
    ciphertext: undefined,
    pqRatchet: undefined,
});

const defaultPreKeySignalMessage = (): PreKeySignalMessage => ({
    registrationId: undefined,
    preKeyId: undefined,
    signedPreKeyId: undefined,
    kyberPreKeyId: undefined,
    kyberCiphertext: undefined,
    baseKey: undefined,
    identityKey: undefined,
    message: undefined,
});

const bytesFromBase64 = (b64: string): Uint8Array => {
    if (typeof atob === 'function') {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    const buffer = Buffer.from(b64, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
};

const base64FromBytes = (bytes: Uint8Array | undefined): string | undefined => {
    if (!bytes) {
        return undefined;
    }
    if (typeof btoa === 'function') {
        let binary = '';
        bytes.forEach((b) => {
            binary += String.fromCharCode(b);
        });
        return btoa(binary);
    }
    return Buffer.from(bytes).toString('base64');
};

export const SignalMessageCodec: Codec<SignalMessage> = {
    create(base?: Partial<SignalMessage>): SignalMessage {
        return { ...defaultSignalMessage(), ...base };
    },
    encode(message: SignalMessage): Writer {
        return signalMessageType.encode(signalMessageType.create(message));
    },
    decode(input: Uint8Array | ArrayBuffer): SignalMessage {
        const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
        const decoded = signalMessageType.decode(buffer) as unknown as SignalMessage;
        return SignalMessageCodec.fromObject(decoded as Record<string, unknown>);
    },
    fromObject(object: Record<string, unknown>): SignalMessage {
        const message = defaultSignalMessage();
        if (object.ratchetKey instanceof Uint8Array) {
            message.ratchetKey = object.ratchetKey;
        }
        const counter = toOptionalNumber(object.counter);
        if (counter !== undefined) {
            message.counter = counter;
        }
        const previousCounter = toOptionalNumber(object.previousCounter);
        if (previousCounter !== undefined) {
            message.previousCounter = previousCounter;
        }
        if (object.ciphertext instanceof Uint8Array) {
            message.ciphertext = object.ciphertext;
        }
        if (object.pqRatchet instanceof Uint8Array) {
            message.pqRatchet = object.pqRatchet;
        }
        return message;
    },
    fromJSON(object: SignalMessageJSON): SignalMessage {
        const message = defaultSignalMessage();
        if (object.ratchetKey) {
            message.ratchetKey = bytesFromBase64(object.ratchetKey);
        }
        if (object.counter !== undefined) {
            message.counter = Number(object.counter);
        }
        if (object.previousCounter !== undefined) {
            message.previousCounter = Number(object.previousCounter);
        }
        if (object.ciphertext) {
            message.ciphertext = bytesFromBase64(object.ciphertext);
        }
        if (object.pqRatchet) {
            message.pqRatchet = bytesFromBase64(object.pqRatchet);
        }
        return message;
    },
    toJSON(message: SignalMessage): SignalMessageJSON {
        return {
            ratchetKey: base64FromBytes(message.ratchetKey),
            counter: message.counter,
            previousCounter: message.previousCounter,
            ciphertext: base64FromBytes(message.ciphertext),
            pqRatchet: base64FromBytes(message.pqRatchet),
        };
    },
};

export const PreKeySignalMessageCodec: Codec<PreKeySignalMessage> = {
    create(base?: Partial<PreKeySignalMessage>): PreKeySignalMessage {
        return { ...defaultPreKeySignalMessage(), ...base };
    },
    encode(message: PreKeySignalMessage): Writer {
        return preKeySignalMessageType.encode(preKeySignalMessageType.create(message));
    },
    decode(input: Uint8Array | ArrayBuffer): PreKeySignalMessage {
        const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
        const decoded = preKeySignalMessageType.decode(buffer) as unknown as PreKeySignalMessage;
        return PreKeySignalMessageCodec.fromObject(decoded as Record<string, unknown>);
    },
    fromObject(object: Record<string, unknown>): PreKeySignalMessage {
        const message = defaultPreKeySignalMessage();
        const registrationId = toOptionalNumber(object.registrationId);
        if (registrationId !== undefined) {
            message.registrationId = registrationId;
        }
        const preKeyId = toOptionalNumber(object.preKeyId);
        if (preKeyId !== undefined) {
            message.preKeyId = preKeyId;
        }
        const signedPreKeyId = toOptionalNumber(object.signedPreKeyId);
        if (signedPreKeyId !== undefined) {
            message.signedPreKeyId = signedPreKeyId;
        }
        const kyberPreKeyId = toOptionalNumber(object.kyberPreKeyId);
        if (kyberPreKeyId !== undefined) {
            message.kyberPreKeyId = kyberPreKeyId;
        }
        if (object.kyberCiphertext instanceof Uint8Array) {
            message.kyberCiphertext = object.kyberCiphertext;
        }
        if (object.baseKey instanceof Uint8Array) {
            message.baseKey = object.baseKey;
        }
        if (object.identityKey instanceof Uint8Array) {
            message.identityKey = object.identityKey;
        }
        if (object.message instanceof Uint8Array) {
            message.message = object.message;
        }
        return message;
    },
    fromJSON(object: PreKeySignalMessageJSON): PreKeySignalMessage {
        const message = defaultPreKeySignalMessage();
        if (object.registrationId !== undefined) {
            message.registrationId = Number(object.registrationId);
        }
        if (object.preKeyId !== undefined) {
            message.preKeyId = Number(object.preKeyId);
        }
        if (object.signedPreKeyId !== undefined) {
            message.signedPreKeyId = Number(object.signedPreKeyId);
        }
        if (object.kyberPreKeyId !== undefined) {
            message.kyberPreKeyId = Number(object.kyberPreKeyId);
        }
        if (object.kyberCiphertext) {
            message.kyberCiphertext = bytesFromBase64(object.kyberCiphertext);
        }
        if (object.baseKey) {
            message.baseKey = bytesFromBase64(object.baseKey);
        }
        if (object.identityKey) {
            message.identityKey = bytesFromBase64(object.identityKey);
        }
        if (object.message) {
            message.message = bytesFromBase64(object.message);
        }
        return message;
    },
    toJSON(message: PreKeySignalMessage): PreKeySignalMessageJSON {
        return {
            registrationId: message.registrationId,
            preKeyId: message.preKeyId,
            signedPreKeyId: message.signedPreKeyId,
            kyberPreKeyId: message.kyberPreKeyId,
            kyberCiphertext: base64FromBytes(message.kyberCiphertext),
            baseKey: base64FromBytes(message.baseKey),
            identityKey: base64FromBytes(message.identityKey),
            message: base64FromBytes(message.message),
        };
    },
};

// Backwards-compatible aliases
export const WhisperMessage = {
    ...SignalMessageCodec,
};

export type WhisperMessage = SignalMessage;

export const PreKeyWhisperMessage = {
    ...PreKeySignalMessageCodec,
};

export type PreKeyWhisperMessage = PreKeySignalMessage;
