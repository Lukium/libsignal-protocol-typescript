/* istanbul ignore file */
// CSP-safe protobuf: these two wire messages are encoded/decoded by hand with the
// minimal (codegen-free) Writer/Reader. protobufjs/light builds its encode/decode
// via `new Function`, which a strict `script-src 'self'` CSP without 'unsafe-eval'
// (e.g. the KMS enclave worker) blocks at runtime — the worker throws EvalError and
// dies. Reader/Writer from protobufjs/minimal contain no codegen. Field numbers and
// wire types below mirror wire.json exactly.
//
// protobufjs/minimal is CommonJS, so use a DEFAULT import (its module.exports) and
// destructure — `import { Reader, Writer } from '.../minimal.js'` throws under native
// ESM (e.g. vitest), where Node's CJS interop cannot statically detect those named
// exports. The Writer *type* still comes from the 'protobufjs' type package.
import protobuf from 'protobufjs/minimal.js';
import type { Writer } from 'protobufjs';
const { Reader, Writer: WriterImpl } = protobuf;

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

// --- CSP-safe wire codecs (manual protobuf, no runtime codegen) ------------------
// Field numbers / wire types mirror wire.json. proto2-optional semantics: a field
// is written only when present (!= null), matching protobufjs's generated encoders.

function encodeSignalMessage(message: SignalMessage): Writer {
    const w = WriterImpl.create();
    if (message.ratchetKey != null) w.uint32(10).bytes(message.ratchetKey); // 1: bytes
    if (message.counter != null) w.uint32(16).uint32(message.counter); // 2: uint32
    if (message.previousCounter != null) w.uint32(24).uint32(message.previousCounter); // 3: uint32
    if (message.ciphertext != null) w.uint32(34).bytes(message.ciphertext); // 4: bytes
    if (message.pqRatchet != null) w.uint32(42).bytes(message.pqRatchet); // 5: bytes
    return w;
}

function decodeSignalMessageRaw(input: Uint8Array): Record<string, unknown> {
    const r = Reader.create(input);
    const out: Record<string, unknown> = {};
    while (r.pos < r.len) {
        const tag = r.uint32();
        switch (tag >>> 3) {
            case 1:
                out.ratchetKey = r.bytes();
                break;
            case 2:
                out.counter = r.uint32();
                break;
            case 3:
                out.previousCounter = r.uint32();
                break;
            case 4:
                out.ciphertext = r.bytes();
                break;
            case 5:
                out.pqRatchet = r.bytes();
                break;
            default:
                r.skipType(tag & 7);
                break;
        }
    }
    return out;
}

function encodePreKeySignalMessage(message: PreKeySignalMessage): Writer {
    const w = WriterImpl.create();
    if (message.preKeyId != null) w.uint32(8).uint32(message.preKeyId); // 1: uint32
    if (message.baseKey != null) w.uint32(18).bytes(message.baseKey); // 2: bytes
    if (message.identityKey != null) w.uint32(26).bytes(message.identityKey); // 3: bytes
    if (message.message != null) w.uint32(34).bytes(message.message); // 4: bytes
    if (message.registrationId != null) w.uint32(40).uint32(message.registrationId); // 5: uint32
    if (message.signedPreKeyId != null) w.uint32(48).uint32(message.signedPreKeyId); // 6: uint32
    if (message.kyberPreKeyId != null) w.uint32(56).uint32(message.kyberPreKeyId); // 7: uint32
    if (message.kyberCiphertext != null) w.uint32(66).bytes(message.kyberCiphertext); // 8: bytes
    return w;
}

function decodePreKeySignalMessageRaw(input: Uint8Array): Record<string, unknown> {
    const r = Reader.create(input);
    const out: Record<string, unknown> = {};
    while (r.pos < r.len) {
        const tag = r.uint32();
        switch (tag >>> 3) {
            case 1:
                out.preKeyId = r.uint32();
                break;
            case 2:
                out.baseKey = r.bytes();
                break;
            case 3:
                out.identityKey = r.bytes();
                break;
            case 4:
                out.message = r.bytes();
                break;
            case 5:
                out.registrationId = r.uint32();
                break;
            case 6:
                out.signedPreKeyId = r.uint32();
                break;
            case 7:
                out.kyberPreKeyId = r.uint32();
                break;
            case 8:
                out.kyberCiphertext = r.bytes();
                break;
            default:
                r.skipType(tag & 7);
                break;
        }
    }
    return out;
}

export const SignalMessageCodec: Codec<SignalMessage> = {
    create(base?: Partial<SignalMessage>): SignalMessage {
        return { ...defaultSignalMessage(), ...base };
    },
    encode(message: SignalMessage): Writer {
        return encodeSignalMessage(message);
    },
    decode(input: Uint8Array | ArrayBuffer): SignalMessage {
        const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
        return SignalMessageCodec.fromObject(decodeSignalMessageRaw(buffer));
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
        return encodePreKeySignalMessage(message);
    },
    decode(input: Uint8Array | ArrayBuffer): PreKeySignalMessage {
        const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
        return PreKeySignalMessageCodec.fromObject(decodePreKeySignalMessageRaw(buffer));
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
