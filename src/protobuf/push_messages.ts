import { Root, Type, Writer } from 'protobufjs/light';
import type { INamespace } from 'protobufjs';
import pushJson from './push_messages.json';

const root = Root.fromJSON(pushJson as INamespace);
const incomingMessageType = root.lookupType('signal.proto.push.IncomingPushMessageSignal') as Type;
const pushMessageContentType = root.lookupType('signal.proto.push.PushMessageContent') as Type;
const attachmentPointerType = root.lookupType('signal.proto.push.PushMessageContent.AttachmentPointer') as Type;
const groupContextType = root.lookupType('signal.proto.push.PushMessageContent.GroupContext') as Type;

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

const toOptionalSafeInteger = (value: unknown): number | undefined => {
    const num = toOptionalNumber(value);
    if (num !== undefined && !Number.isSafeInteger(num)) {
        throw new RangeError(`Value exceeds Number.MAX_SAFE_INTEGER: ${num}`);
    }
    return num;
};

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

interface Codec<T> {
    create(base?: Partial<T>): T;
    encode(message: T): Writer;
    decode(input: Uint8Array | ArrayBuffer): T;
    fromObject(object: Record<string, unknown>): T;
    fromJSON(object: Record<string, unknown>): T;
    toJSON(message: T): Record<string, unknown>;
}

export enum IncomingPushMessageSignalType {
    UNKNOWN = 0,
    CIPHERTEXT = 1,
    KEY_EXCHANGE = 2,
    PREKEY_BUNDLE = 3,
    PLAINTEXT = 4,
    RECEIPT = 5,
    PREKEY_BUNDLE_DEVICE_CONTROL = 6,
    DEVICE_CONTROL = 7,
}

export interface IncomingPushMessageSignal {
    type?: IncomingPushMessageSignalType;
    source?: string;
    relay?: string;
    timestamp?: number;
    message?: Uint8Array;
    sourceDevice?: number;
}

const defaultIncomingPushMessageSignal = (): IncomingPushMessageSignal => ({
    type: undefined,
    source: undefined,
    relay: undefined,
    timestamp: undefined,
    message: undefined,
    sourceDevice: undefined,
});

export const IncomingPushMessageSignalCodec: Codec<IncomingPushMessageSignal> = {
    create(base?: Partial<IncomingPushMessageSignal>): IncomingPushMessageSignal {
        return { ...defaultIncomingPushMessageSignal(), ...base };
    },
    encode(message: IncomingPushMessageSignal): Writer {
        const prepared = incomingMessageType.create({
            type: message.type,
            source: message.source,
            relay: message.relay,
            timestamp: message.timestamp,
            message: message.message,
            sourceDevice: message.sourceDevice,
        });
        return incomingMessageType.encode(prepared);
    },
    decode(input: Uint8Array | ArrayBuffer): IncomingPushMessageSignal {
        const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
        const decoded = incomingMessageType.decode(buffer) as unknown as Record<string, unknown>;
        return this.fromObject(decoded);
    },
    fromObject(object: Record<string, unknown>): IncomingPushMessageSignal {
        const message = defaultIncomingPushMessageSignal();
        const { type, source, relay, timestamp, message: payload, sourceDevice } = object;

        if (typeof type === 'number') {
            message.type = type;
        }
        if (typeof source === 'string') {
            message.source = source;
        }
        if (typeof relay === 'string') {
            message.relay = relay;
        }
        const ts = toOptionalSafeInteger(timestamp);
        if (ts !== undefined) {
            message.timestamp = ts;
        }
        if (payload instanceof Uint8Array) {
            message.message = new Uint8Array(payload);
        }
        const device = toOptionalNumber(sourceDevice);
        if (device !== undefined) {
            message.sourceDevice = device;
        }
        return message;
    },
    fromJSON(object: Record<string, unknown>): IncomingPushMessageSignal {
        const message = defaultIncomingPushMessageSignal();
        if (object.type !== undefined) {
            const numeric = toOptionalNumber(object.type);
            message.type =
                numeric !== undefined
                    ? numeric
                    : IncomingPushMessageSignalType[String(object.type) as keyof typeof IncomingPushMessageSignalType];
        }
        if (typeof object.source === 'string') {
            message.source = object.source;
        }
        if (typeof object.relay === 'string') {
            message.relay = object.relay;
        }
        const ts = toOptionalSafeInteger(object.timestamp);
        if (ts !== undefined) {
            message.timestamp = ts;
        }
        if (typeof object.message === 'string') {
            message.message = bytesFromBase64(object.message);
        }
        const device = toOptionalNumber(object.sourceDevice);
        if (device !== undefined) {
            message.sourceDevice = device;
        }
        return message;
    },
    toJSON(message: IncomingPushMessageSignal): Record<string, unknown> {
        return {
            type:
                message.type !== undefined ? (IncomingPushMessageSignalType[message.type] ?? message.type) : undefined,
            source: message.source,
            relay: message.relay,
            timestamp: message.timestamp,
            message: base64FromBytes(message.message),
            sourceDevice: message.sourceDevice,
        };
    },
};

export enum PushMessageContentFlags {
    END_SESSION = 1,
}

export interface PushMessageContentAttachmentPointer {
    id?: number;
    contentType?: string;
    key?: Uint8Array;
}

const defaultAttachmentPointer = (): PushMessageContentAttachmentPointer => ({
    id: undefined,
    contentType: undefined,
    key: undefined,
});

export const PushMessageContentAttachmentPointerCodec: Codec<PushMessageContentAttachmentPointer> = {
    create(base?: Partial<PushMessageContentAttachmentPointer>): PushMessageContentAttachmentPointer {
        return { ...defaultAttachmentPointer(), ...base };
    },
    encode(message: PushMessageContentAttachmentPointer): Writer {
        const prepared = attachmentPointerType.create({
            id: message.id,
            contentType: message.contentType,
            key: message.key,
        });
        return attachmentPointerType.encode(prepared);
    },
    decode(input: Uint8Array | ArrayBuffer): PushMessageContentAttachmentPointer {
        const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
        const decoded = attachmentPointerType.decode(buffer) as unknown as Record<string, unknown>;
        return this.fromObject(decoded);
    },
    fromObject(object: Record<string, unknown>): PushMessageContentAttachmentPointer {
        const message = defaultAttachmentPointer();
        const { id, contentType, key } = object;
        const pointerId = toOptionalSafeInteger(id);
        if (pointerId !== undefined) {
            message.id = pointerId;
        }
        if (typeof contentType === 'string') {
            message.contentType = contentType;
        }
        if (key instanceof Uint8Array) {
            message.key = new Uint8Array(key);
        }
        return message;
    },
    fromJSON(object: Record<string, unknown>): PushMessageContentAttachmentPointer {
        const message = defaultAttachmentPointer();
        const pointerId = toOptionalSafeInteger(object.id);
        if (pointerId !== undefined) {
            message.id = pointerId;
        }
        if (typeof object.contentType === 'string') {
            message.contentType = object.contentType;
        }
        if (typeof object.key === 'string') {
            message.key = bytesFromBase64(object.key);
        }
        return message;
    },
    toJSON(message: PushMessageContentAttachmentPointer): Record<string, unknown> {
        return {
            id: message.id,
            contentType: message.contentType,
            key: base64FromBytes(message.key),
        };
    },
};

export enum PushMessageContentGroupContextType {
    UNKNOWN = 0,
    UPDATE = 1,
    DELIVER = 2,
    QUIT = 3,
}

export interface PushMessageContentGroupContext {
    id?: Uint8Array;
    type?: PushMessageContentGroupContextType;
    name?: string;
    members: string[];
    avatar?: PushMessageContentAttachmentPointer;
}

const defaultGroupContext = (): PushMessageContentGroupContext => ({
    id: undefined,
    type: undefined,
    name: undefined,
    members: [],
    avatar: undefined,
});

export const PushMessageContentGroupContextCodec: Codec<PushMessageContentGroupContext> = {
    create(base?: Partial<PushMessageContentGroupContext>): PushMessageContentGroupContext {
        return { ...defaultGroupContext(), ...base, members: base?.members ? [...base.members] : [] };
    },
    encode(message: PushMessageContentGroupContext): Writer {
        const prepared = groupContextType.create({
            id: message.id,
            type: message.type,
            name: message.name,
            members: message.members,
            avatar: message.avatar
                ? attachmentPointerType.create(PushMessageContentAttachmentPointerCodec.create(message.avatar))
                : undefined,
        });
        return groupContextType.encode(prepared);
    },
    decode(input: Uint8Array | ArrayBuffer): PushMessageContentGroupContext {
        const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
        const decoded = groupContextType.decode(buffer) as unknown as Record<string, unknown>;
        return this.fromObject(decoded);
    },
    fromObject(object: Record<string, unknown>): PushMessageContentGroupContext {
        const message = defaultGroupContext();
        const { id, type, name, members, avatar } = object;
        if (id instanceof Uint8Array) {
            message.id = new Uint8Array(id);
        }
        if (typeof type === 'number') {
            message.type = type;
        }
        if (typeof name === 'string') {
            message.name = name;
        }
        if (Array.isArray(members)) {
            message.members = members.filter((m): m is string => typeof m === 'string');
        }
        if (avatar && typeof avatar === 'object') {
            message.avatar = PushMessageContentAttachmentPointerCodec.fromObject(avatar as Record<string, unknown>);
        }
        return message;
    },
    fromJSON(object: Record<string, unknown>): PushMessageContentGroupContext {
        const message = defaultGroupContext();
        if (typeof object.id === 'string') {
            message.id = bytesFromBase64(object.id);
        }
        const numericType = toOptionalNumber(object.type);
        if (numericType !== undefined) {
            message.type = numericType;
        } else if (typeof object.type === 'string' && object.type in PushMessageContentGroupContextType) {
            message.type =
                PushMessageContentGroupContextType[object.type as keyof typeof PushMessageContentGroupContextType];
        }
        if (typeof object.name === 'string') {
            message.name = object.name;
        }
        if (Array.isArray(object.members)) {
            message.members = object.members.filter((m: unknown): m is string => typeof m === 'string');
        }
        if (object.avatar && typeof object.avatar === 'object') {
            message.avatar = PushMessageContentAttachmentPointerCodec.fromJSON(
                object.avatar as Record<string, unknown>
            );
        }
        return message;
    },
    toJSON(message: PushMessageContentGroupContext): Record<string, unknown> {
        return {
            id: base64FromBytes(message.id),
            type:
                message.type !== undefined
                    ? (PushMessageContentGroupContextType[message.type] ?? message.type)
                    : undefined,
            name: message.name,
            members: message.members,
            avatar: message.avatar ? PushMessageContentAttachmentPointerCodec.toJSON(message.avatar) : undefined,
        };
    },
};

export interface PushMessageContent {
    body?: string;
    attachments: PushMessageContentAttachmentPointer[];
    group?: PushMessageContentGroupContext;
    flags?: number;
}

const defaultPushMessageContent = (): PushMessageContent => ({
    body: undefined,
    attachments: [],
    group: undefined,
    flags: undefined,
});

export const PushMessageContentCodec: Codec<PushMessageContent> = {
    create(base?: Partial<PushMessageContent>): PushMessageContent {
        return {
            ...defaultPushMessageContent(),
            ...base,
            attachments: base?.attachments ? [...base.attachments] : [],
        };
    },
    encode(message: PushMessageContent): Writer {
        const prepared = pushMessageContentType.create({
            body: message.body,
            attachments: message.attachments.map((attachment) =>
                attachmentPointerType.create(PushMessageContentAttachmentPointerCodec.create(attachment))
            ),
            group: message.group
                ? groupContextType.create(PushMessageContentGroupContextCodec.create(message.group))
                : undefined,
            flags: message.flags,
        });
        return pushMessageContentType.encode(prepared);
    },
    decode(input: Uint8Array | ArrayBuffer): PushMessageContent {
        const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
        const decoded = pushMessageContentType.decode(buffer) as unknown as Record<string, unknown>;
        return this.fromObject(decoded);
    },
    fromObject(object: Record<string, unknown>): PushMessageContent {
        const message = defaultPushMessageContent();
        const { body, attachments, group, flags } = object;
        if (typeof body === 'string') {
            message.body = body;
        }
        if (Array.isArray(attachments)) {
            message.attachments = attachments.map((attachment) =>
                PushMessageContentAttachmentPointerCodec.fromObject(attachment as Record<string, unknown>)
            );
        }
        if (group && typeof group === 'object') {
            message.group = PushMessageContentGroupContextCodec.fromObject(group as Record<string, unknown>);
        }
        const numericFlags = toOptionalNumber(flags);
        if (numericFlags !== undefined) {
            message.flags = numericFlags;
        }
        return message;
    },
    fromJSON(object: Record<string, unknown>): PushMessageContent {
        const message = defaultPushMessageContent();
        if (typeof object.body === 'string') {
            message.body = object.body;
        }
        if (Array.isArray(object.attachments)) {
            message.attachments = object.attachments.map((attachment) =>
                PushMessageContentAttachmentPointerCodec.fromJSON(attachment as Record<string, unknown>)
            );
        }
        if (object.group && typeof object.group === 'object') {
            message.group = PushMessageContentGroupContextCodec.fromJSON(object.group as Record<string, unknown>);
        }
        const numericFlags = toOptionalNumber(object.flags);
        if (numericFlags !== undefined) {
            message.flags = numericFlags;
        } else if (typeof object.flags === 'string' && object.flags in PushMessageContentFlags) {
            message.flags = PushMessageContentFlags[object.flags as keyof typeof PushMessageContentFlags];
        }
        return message;
    },
    toJSON(message: PushMessageContent): Record<string, unknown> {
        return {
            body: message.body,
            attachments: message.attachments.map((attachment) =>
                PushMessageContentAttachmentPointerCodec.toJSON(attachment)
            ),
            group: message.group ? PushMessageContentGroupContextCodec.toJSON(message.group) : undefined,
            flags: message.flags !== undefined ? message.flags : undefined,
        };
    },
};
