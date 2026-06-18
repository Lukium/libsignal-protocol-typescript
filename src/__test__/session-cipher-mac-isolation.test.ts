/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SessionCipher } from '../session-cipher';
import { SessionBuilder } from '../session-builder';
import { SignalProtocolAddress } from '../signal-protocol-address';
import { sessionTypeArrayBufferToString } from '../session-record';
import { SignalProtocolStore } from './storage-type';
import { generateIdentity, generatePreKeyBundle, assertEqualArrayBuffers } from '../__test-utils__/utils';
import * as utils from '../helpers';

// Regression test for the clone-verify-commit fix in doDecryptWhisperMessage.
// A message whose MAC does not verify must not mutate the live session object,
// because decryptWithSessionList() tries candidate sessions by reference and
// persists the record after a *different* session decrypts successfully — a
// forged message must not be able to damage a sibling session's ratchet state.
describe('doDecryptWhisperMessage does not mutate the session when the MAC fails', () => {
    const ALICE = new SignalProtocolAddress('+14151111111', 1);
    const BOB = new SignalProtocolAddress('+14152222222', 1);

    const aliceStore = new SignalProtocolStore();
    const bobStore = new SignalProtocolStore();

    let aliceCipher: SessionCipher;
    let bobCipher: SessionCipher;

    const payload2 = utils.binaryStringToArrayBuffer('second message') as ArrayBuffer;

    let validBytes2: ArrayBuffer;

    beforeAll(async () => {
        await Promise.all([aliceStore, bobStore].map(generateIdentity));
        const preKeyBundle = await generatePreKeyBundle(bobStore, 1337, 1);

        await new SessionBuilder(aliceStore, BOB).processPreKey(preKeyBundle);
        aliceCipher = new SessionCipher(aliceStore, BOB);
        bobCipher = new SessionCipher(bobStore, ALICE);

        // 1. Alice -> Bob (pre-key message) establishes Bob's inbound session.
        const hello = await aliceCipher.encrypt(utils.binaryStringToArrayBuffer('hello') as ArrayBuffer);
        await bobCipher.decryptPreKeyWhisperMessage(hello.body!, 'binary');

        // 2. Bob -> Alice so Alice clears her pending pre-key and both sides hold
        //    a fully established (type 1) session.
        const hi = await bobCipher.encrypt(utils.binaryStringToArrayBuffer('hi') as ArrayBuffer);
        await aliceCipher.decryptWhisperMessage(hi.body!, 'binary');

        // 3. Alice sends two more messages on the same sending ratchet.
        const first = await aliceCipher.encrypt(utils.binaryStringToArrayBuffer('first message') as ArrayBuffer);
        const second = await aliceCipher.encrypt(payload2);
        expect(first.type).toBe(1);
        expect(second.type).toBe(1);
        validBytes2 = utils.binaryStringToArrayBuffer(second.body!) as ArrayBuffer;

        // Bob decrypts the first one, which creates the receiving chain for
        // Alice's current ratchet key (so the forged-message path below exercises
        // only message-key advancement, not a ratchet step).
        await bobCipher.decryptWhisperMessage(first.body!, 'binary');
    });

    test('a forged message leaves the session untouched and the valid message still decrypts', async () => {
        const record = (await bobCipher.getRecord(ALICE.toString()))!;
        const session = record.getOpenSession()!;
        const before = JSON.stringify(sessionTypeArrayBufferToString(session));

        // Forge the second message by flipping a MAC byte; the protobuf still
        // parses, so the ratchet/message-key advancement runs before verifyMAC.
        const forged = validBytes2.slice(0);
        const forgedView = new Uint8Array(forged);
        forgedView[forgedView.length - 1] ^= 0xff;

        await expect(bobCipher.doDecryptWhisperMessage(forged, session)).rejects.toThrow();

        // The live session must be byte-for-byte unchanged after the failed decrypt.
        expect(JSON.stringify(sessionTypeArrayBufferToString(session))).toBe(before);

        // The genuine message must still decrypt on that same session object —
        // proving its message key was never consumed by the forged attempt.
        const plaintext = await bobCipher.doDecryptWhisperMessage(validBytes2, session);
        assertEqualArrayBuffers(plaintext, payload2);

        // After a successful decrypt the advanced state is committed.
        expect(JSON.stringify(sessionTypeArrayBufferToString(session))).not.toBe(before);
    });
});
