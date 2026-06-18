import {
    SessionRecord,
    keyPairArrayBufferToString,
    keyPairStirngToArrayBuffer,
    sessionTypeArrayBufferToString,
    sessionTypeStringToArrayBuffer,
} from '../session-record';
import { BaseKeyType, ChainType, SessionType } from '../session-types';
import * as util from '../helpers';

const toAB = (value: number[]): ArrayBuffer => util.uint8ArrayToArrayBuffer(Uint8Array.from(value));
const baseKey = toAB([...Array(32).keys()]);
const otherKey = toAB([...Array(32).keys()].reverse());

const createSession = (overrides: Partial<SessionType> = {}): SessionType => ({
    registrationId: 1,
    currentRatchet: {
        rootKey: baseKey,
        lastRemoteEphemeralKey: baseKey,
        previousCounter: 0,
    },
    indexInfo: {
        baseKey,
        baseKeyType: BaseKeyType.THEIRS,
        remoteIdentityKey: baseKey,
        closed: -1,
    },
    oldRatchetList: [],
    chains: {},
    ...overrides,
});

describe('SessionRecord', () => {
    test('serialize and deserialize round trips', () => {
        const record = new SessionRecord(99);
        const session = createSession();
        record.updateSessionState(session);
        const json = record.serialize();
        const restored = SessionRecord.deserialize(json);
        expect(restored.registrationId).toBeUndefined();
        expect(restored.haveOpenSession()).toBe(true);
    });

    test('getSessionByBaseKey ignores OURS entries', () => {
        const record = new SessionRecord();
        const theirs = createSession();
        record.updateSessionState(theirs);
        const ours = createSession({
            indexInfo: { ...theirs.indexInfo, baseKey: otherKey, baseKeyType: BaseKeyType.OURS },
        });
        record.updateSessionState(ours);
        expect(record.getSessionByBaseKey(baseKey)).toBe(theirs);
        expect(record.getSessionByBaseKey(otherKey)).toBeUndefined();
    });

    test('removeOldChains prunes archived items', () => {
        const record = new SessionRecord();
        const session = createSession();
        for (let i = 0; i < 12; i += 1) {
            const key = toAB(new Array(32).fill(i + 1));
            session.oldRatchetList.push({
                ephemeralKey: key,
                added: i,
            });
            session.chains[util.arrayBufferToString(key)] = {
                chainType: ChainType.RECEIVING,
                chainKey: { counter: 0, key },
                messageKeys: {},
            };
        }
        record.removeOldChains(session);
        expect(session.oldRatchetList).toHaveLength(10);
        expect(Object.keys(session.chains)).toHaveLength(10);
    });

    test('removeOldSessions trims oldest closed sessions', () => {
        const record = new SessionRecord();
        for (let i = 0; i < 42; i += 1) {
            const closedSession = createSession({
                indexInfo: {
                    baseKey: toAB(new Array(32).fill(i + 2)),
                    baseKeyType: BaseKeyType.THEIRS,
                    remoteIdentityKey: baseKey,
                    closed: i,
                },
                oldRatchetList: [],
            });
            record.updateSessionState(closedSession);
        }
        const open = createSession({
            indexInfo: {
                baseKey: baseKey,
                baseKeyType: BaseKeyType.THEIRS,
                remoteIdentityKey: baseKey,
                closed: -1,
            },
        });
        record.updateSessionState(open);
        expect(Object.keys(record.sessions)).toHaveLength(40);
        expect(record.getOpenSession()).toBeDefined();
    });

    test('removeOldSessions trims several sessions in a single pass without looping', () => {
        // Populate the record directly so one removeOldSessions() call must trim
        // multiple sessions at once. This is the path that previously hung: the
        // oldest-tracking vars were hoisted out of the while loop, so after the
        // first delete it kept re-targeting the already-removed key forever.
        // (updateSessionState only ever trims one at a time, so it never hit it.)
        const record = new SessionRecord();
        for (let i = 0; i < 45; i += 1) {
            record.sessions['sess-' + i] = createSession({
                indexInfo: {
                    baseKey: toAB(new Array(32).fill(7)),
                    baseKeyType: BaseKeyType.THEIRS,
                    remoteIdentityKey: baseKey,
                    closed: i,
                },
            });
        }
        record.removeOldSessions();
        const remaining = Object.values(record.sessions)
            .map((s) => s.indexInfo.closed)
            .sort((a, b) => a - b);
        expect(remaining).toHaveLength(40);
        // The five oldest (closed = 0..4) are dropped; the newest is retained.
        expect(remaining[0]).toBe(5);
        expect(remaining[remaining.length - 1]).toBe(44);
    });

    test('removeOldSessions stops when only open sessions remain', () => {
        // A corrupted store could hold more than the retention limit of *open*
        // sessions; removeOldSessions must not spin trying to trim them.
        const record = new SessionRecord();
        for (let i = 0; i < 45; i += 1) {
            record.sessions['open-' + i] = createSession({
                indexInfo: {
                    baseKey: toAB(new Array(32).fill(7)),
                    baseKeyType: BaseKeyType.THEIRS,
                    remoteIdentityKey: baseKey,
                    closed: -1,
                },
            });
        }
        record.removeOldSessions();
        // Nothing is closed, so nothing can be trimmed — but it must terminate.
        expect(Object.keys(record.sessions)).toHaveLength(45);
    });

    test('archiveCurrentState closes open session', () => {
        const record = new SessionRecord();
        const session = createSession();
        record.updateSessionState(session);
        record.archiveCurrentState();
        const sessions = record.getSessions();
        const latest = sessions[sessions.length - 1];
        expect(latest.indexInfo.closed).toBeGreaterThan(0);
    });

    test('getSessionByRemoteEphemeralKey finds matching chain', () => {
        const record = new SessionRecord();
        const session = createSession();
        const eph = toAB(new Array(32).fill(7));
        session.chains[util.arrayBufferToString(eph)] = {
            chainType: ChainType.RECEIVING,
            chainKey: { counter: 1, key: eph },
            messageKeys: {},
        };
        record.updateSessionState(session);
        expect(record.getSessionByRemoteEphemeralKey(eph)).toBe(session);
    });

    test('getSessions returns closed first then open', () => {
        const record = new SessionRecord();
        const closed = createSession({
            indexInfo: {
                baseKey: otherKey,
                baseKeyType: BaseKeyType.THEIRS,
                remoteIdentityKey: baseKey,
                closed: 5,
            },
        });
        const open = createSession();
        record.updateSessionState(closed);
        record.updateSessionState(open);
        const sessions = record.getSessions();
        expect(sessions[0].indexInfo.closed).toBe(5);
        expect(sessions[1].indexInfo.closed).toBe(-1);
    });

    test('conversion helpers round trip', () => {
        const kp = keyPairArrayBufferToString({
            pubKey: baseKey,
            privKey: otherKey,
        });
        const restored = keyPairStirngToArrayBuffer(kp);
        expect(util.arrayBufferToString(restored.pubKey)).toBe(util.arrayBufferToString(baseKey));
        expect(util.arrayBufferToString(restored.privKey)).toBe(util.arrayBufferToString(otherKey));
    });

    test('haveOpenSession returns false when registrationId missing', () => {
        const record = new SessionRecord();
        const session = createSession({ registrationId: undefined });
        record.updateSessionState(session);
        expect(record.haveOpenSession()).toBe(false);
    });

    test('getSessionByRemoteEphemeralKey returns open session when chain missing', () => {
        const record = new SessionRecord();
        const session = createSession();
        record.updateSessionState(session);
        const fallbackKey = toAB(new Array(32).fill(9));
        expect(record.getSessionByRemoteEphemeralKey(fallbackKey)).toBe(session);
    });

    test('deleteAllSessions clears existing sessions', () => {
        const record = new SessionRecord();
        record.updateSessionState(createSession());
        record.deleteAllSessions();
        expect(record.haveOpenSession()).toBe(false);
        expect(record.getSessions()).toHaveLength(0);
    });
});

describe('SessionRecord edge cases', () => {
    test('deserialize migrates legacy payload without version', () => {
        const legacy = JSON.stringify({ sessions: {}, registrationId: 10 });
        expect(() => SessionRecord.deserialize(legacy)).not.toThrow();
    });

    test('deserialize rejects unknown migration version', () => {
        const legacy = JSON.stringify({ version: 'legacy', sessions: {} });
        expect(() => SessionRecord.deserialize(legacy)).toThrow('Error migrating SessionRecord');
    });

    test('deserialize rejects malformed session map', () => {
        const malformed = JSON.stringify({ version: 'v1', sessions: null });
        expect(() => SessionRecord.deserialize(malformed)).toThrow();
    });

    test('getSessionByBaseKey returns undefined for empty key', () => {
        const record = new SessionRecord();
        expect(record.getSessionByBaseKey(new ArrayBuffer(0))).toBeUndefined();
    });

    test('getOpenSession throws when duplicate open sessions detected', () => {
        const record = new SessionRecord();
        record.updateSessionState(createSession());
        record.updateSessionState(
            createSession({
                indexInfo: {
                    baseKey: otherKey,
                    baseKeyType: BaseKeyType.THEIRS,
                    remoteIdentityKey: baseKey,
                    closed: -1,
                },
            })
        );
        expect(() => record.getOpenSession()).toThrow('Datastore inconsistensy: multiple open sessions');
    });

    test('removeOldChains throws when old ratchet index invalid', () => {
        const record = new SessionRecord();
        const session = createSession();
        for (let i = 0; i < 11; i += 1) {
            const keyBytes = i === 0 ? new Uint8Array(0) : new Uint8Array(32).fill(i + 1);
            const key = util.uint8ArrayToArrayBuffer(keyBytes);
            session.oldRatchetList.push({ ephemeralKey: key, added: i });
            session.chains[util.arrayBufferToString(key)] = {
                chainType: ChainType.RECEIVING,
                chainKey: { counter: 0, key },
                messageKeys: {},
            };
        }
        expect(() => record.removeOldChains(session)).toThrow('invalid index for chain');
    });

    test('migration handles missing registration id with open session', () => {
        const record = new SessionRecord();
        record.updateSessionState(createSession());
        const parsed = JSON.parse(record.serialize());
        const sessionKey = Object.keys(parsed.sessions)[0];
        parsed.sessions[sessionKey].registrationId = undefined;
        parsed.version = undefined;
        const legacy = JSON.stringify(parsed);
        expect(() => SessionRecord.deserialize(legacy)).not.toThrow();
    });

    test('updateSessionState rejects missing base key', () => {
        const record = new SessionRecord();
        const session = createSession({
            indexInfo: {
                baseKey: undefined,
                baseKeyType: BaseKeyType.THEIRS,
                remoteIdentityKey: baseKey,
                closed: -1,
            },
        });
        expect(() => record.updateSessionState(session)).toThrow('invalid index for session');
    });

    test('deserialize rejects an oversized serialized record', () => {
        const big = '{"version":"v1","sessions":{}}'.padEnd(8 * 1024 * 1024 + 10, ' ');
        expect(() => SessionRecord.deserialize(big)).toThrow('Error deserializing SessionRecord');
    });

    test('deserialize rejects records with too many sessions', () => {
        const sessions: Record<string, unknown> = {};
        for (let i = 0; i < 201; i += 1) {
            sessions[`s${i}`] = { indexInfo: { closed: i }, chains: {} };
        }
        const payload = JSON.stringify({ version: 'v1', sessions });
        expect(() => SessionRecord.deserialize(payload)).toThrow('too many sessions');
    });

    test('deserialize rejects a chain with too many message keys', () => {
        const messageKeys: Record<number, string> = {};
        for (let i = 0; i < 2201; i += 1) {
            messageKeys[i] = 'AAAA';
        }
        const sessions = { s0: { indexInfo: { closed: -1 }, chains: { c: { messageKeys } } } };
        const payload = JSON.stringify({ version: 'v1', sessions });
        expect(() => SessionRecord.deserialize(payload)).toThrow('too many message keys');
    });

    test('session type conversions round trip complex structure', () => {
        const complex = createSession({
            pendingPreKey: { baseKey, preKeyId: 7, signedKeyId: 11 },
            oldRatchetList: [{ ephemeralKey: otherKey, added: 4 }],
            chains: {
                foo: {
                    chainType: ChainType.RECEIVING,
                    chainKey: { counter: 3, key: otherKey },
                    messageKeys: { 7: baseKey },
                },
            },
        });
        const asString = sessionTypeArrayBufferToString(complex);
        const restored = sessionTypeStringToArrayBuffer(asString);
        expect(restored.pendingPreKey?.preKeyId).toBe(7);
        expect(restored.chains.foo.chainKey.counter).toBe(3);
        expect(util.arrayBufferToString(restored.chains.foo.messageKeys[7])).toBe(util.arrayBufferToString(baseKey));
    });
});
