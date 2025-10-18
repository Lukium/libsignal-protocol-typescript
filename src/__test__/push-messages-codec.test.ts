import {
    IncomingPushMessageSignalCodec,
    IncomingPushMessageSignalType,
    PushMessageContentAttachmentPointerCodec,
    PushMessageContentCodec,
    PushMessageContentFlags,
    PushMessageContentGroupContextCodec,
    PushMessageContentGroupContextType,
} from '../protobuf/push_messages';

describe('push message codecs', () => {
    test('PushMessageContentCodec round-trips body, attachments, and group context', () => {
        const attachment = PushMessageContentAttachmentPointerCodec.create({
            id: 42,
            contentType: 'image/png',
            key: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
        });
        const group = PushMessageContentGroupContextCodec.create({
            id: new Uint8Array([0x01, 0x02]),
            type: PushMessageContentGroupContextType.UPDATE,
            name: 'Bridge Crew',
            members: ['alice', 'bob'],
            avatar: attachment,
        });
        const content = PushMessageContentCodec.create({
            body: 'All clear',
            attachments: [attachment],
            group,
            flags: PushMessageContentFlags.END_SESSION,
        });

        const encoded = PushMessageContentCodec.encode(content).finish();
        const decoded = PushMessageContentCodec.decode(encoded);

        expect(decoded.body).toBe('All clear');
        expect(decoded.flags).toBe(PushMessageContentFlags.END_SESSION);
        expect(decoded.attachments).toHaveLength(1);
        expect(decoded.attachments[0].id).toBe(42);
        expect(decoded.attachments[0].contentType).toBe('image/png');
        expect(decoded.attachments[0].key).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
        expect(decoded.group?.name).toBe('Bridge Crew');
        expect(decoded.group?.type).toBe(PushMessageContentGroupContextType.UPDATE);
        expect(decoded.group?.members).toEqual(['alice', 'bob']);
        expect(decoded.group?.avatar?.id).toBe(42);

        const json = PushMessageContentCodec.toJSON(content);
        json.flags = 'END_SESSION';
        const fromJson = PushMessageContentCodec.fromJSON(json);
        expect(fromJson.flags).toBe(PushMessageContentFlags.END_SESSION);
        expect(fromJson.attachments[0].key).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    test('IncomingPushMessageSignalCodec handles JSON round-trip', () => {
        const signal = IncomingPushMessageSignalCodec.create({
            type: IncomingPushMessageSignalType.CIPHERTEXT,
            source: '+14155551212',
            relay: 'relay.signal.org',
            timestamp: 1_725_000_000,
            message: new Uint8Array([0x01, 0x02, 0x03]),
            sourceDevice: 2,
        });

        const encoded = IncomingPushMessageSignalCodec.encode(signal).finish();
        const decoded = IncomingPushMessageSignalCodec.decode(encoded);

        expect(decoded.source).toBe('+14155551212');
        expect(decoded.relay).toBe('relay.signal.org');
        expect(decoded.timestamp).toBe(1_725_000_000);
        expect(decoded.message).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
        expect(decoded.sourceDevice).toBe(2);
        expect(decoded.type).toBe(IncomingPushMessageSignalType.CIPHERTEXT);

        const json = IncomingPushMessageSignalCodec.toJSON(signal);
        json.type = 'CIPHERTEXT';
        const fromJson = IncomingPushMessageSignalCodec.fromJSON(json);
        expect(fromJson.type).toBe(IncomingPushMessageSignalType.CIPHERTEXT);
        expect(fromJson.message).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
    });
});
