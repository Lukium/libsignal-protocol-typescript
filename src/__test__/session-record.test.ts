import { SessionRecord, keyPairArrayBufferToString, keyPairStirngToArrayBuffer } from '../session-record'
import { BaseKeyType, ChainType, SessionType } from '../session-types'
import * as util from '../helpers'

const toAB = (value: number[]): ArrayBuffer => util.uint8ArrayToArrayBuffer(Uint8Array.from(value))
const baseKey = toAB([...Array(32).keys()])
const otherKey = toAB([...Array(32).keys()].reverse())

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
})

describe('SessionRecord', () => {
    test('serialize and deserialize round trips', () => {
        const record = new SessionRecord(99)
        const session = createSession()
        record.updateSessionState(session)
        const json = record.serialize()
        const restored = SessionRecord.deserialize(json)
        expect(restored.registrationId).toBeUndefined()
        expect(restored.haveOpenSession()).toBe(true)
    })

    test('getSessionByBaseKey ignores OURS entries', () => {
        const record = new SessionRecord()
        const theirs = createSession()
        record.updateSessionState(theirs)
        const ours = createSession({
            indexInfo: { ...theirs.indexInfo, baseKey: otherKey, baseKeyType: BaseKeyType.OURS },
        })
        record.updateSessionState(ours)
        expect(record.getSessionByBaseKey(baseKey)).toBe(theirs)
        expect(record.getSessionByBaseKey(otherKey)).toBeUndefined()
    })

    test('removeOldChains prunes archived items', () => {
        const record = new SessionRecord()
        const session = createSession()
        for (let i = 0; i < 12; i += 1) {
            const key = toAB(new Array(32).fill(i + 1))
            session.oldRatchetList.push({
                ephemeralKey: key,
                added: i,
            })
            session.chains[util.arrayBufferToString(key)] = {
                chainType: ChainType.RECEIVING,
                chainKey: { counter: 0, key },
                messageKeys: {},
            }
        }
        record.removeOldChains(session)
        expect(session.oldRatchetList).toHaveLength(10)
        expect(Object.keys(session.chains)).toHaveLength(10)
    })

    test('removeOldSessions trims oldest closed sessions', () => {
        const record = new SessionRecord()
        for (let i = 0; i < 42; i += 1) {
            const closedSession = createSession({
                indexInfo: {
                    baseKey: toAB(new Array(32).fill(i + 2)),
                    baseKeyType: BaseKeyType.THEIRS,
                    remoteIdentityKey: baseKey,
                    closed: i,
                },
                oldRatchetList: [],
            })
            record.updateSessionState(closedSession)
        }
        const open = createSession({
            indexInfo: {
                baseKey: baseKey,
                baseKeyType: BaseKeyType.THEIRS,
                remoteIdentityKey: baseKey,
                closed: -1,
            },
        })
        record.updateSessionState(open)
        expect(Object.keys(record.sessions)).toHaveLength(40)
        expect(record.getOpenSession()).toBeDefined()
    })

    test('archiveCurrentState closes open session', () => {
        const record = new SessionRecord()
        const session = createSession()
        record.updateSessionState(session)
        record.archiveCurrentState()
        const sessions = record.getSessions()
        const latest = sessions[sessions.length - 1]
        expect(latest.indexInfo.closed).toBeGreaterThan(0)
    })

    test('getSessionByRemoteEphemeralKey finds matching chain', () => {
        const record = new SessionRecord()
        const session = createSession()
        const eph = toAB(new Array(32).fill(7))
        session.chains[util.arrayBufferToString(eph)] = {
            chainType: ChainType.RECEIVING,
            chainKey: { counter: 1, key: eph },
            messageKeys: {},
        }
        record.updateSessionState(session)
        expect(record.getSessionByRemoteEphemeralKey(eph)).toBe(session)
    })

    test('getSessions returns closed first then open', () => {
        const record = new SessionRecord()
        const closed = createSession({
            indexInfo: {
                baseKey: otherKey,
                baseKeyType: BaseKeyType.THEIRS,
                remoteIdentityKey: baseKey,
                closed: 5,
            },
        })
        const open = createSession()
        record.updateSessionState(closed)
        record.updateSessionState(open)
        const sessions = record.getSessions()
        expect(sessions[0].indexInfo.closed).toBe(5)
        expect(sessions[1].indexInfo.closed).toBe(-1)
    })

    test('conversion helpers round trip', () => {
        const kp = keyPairArrayBufferToString({
            pubKey: baseKey,
            privKey: otherKey,
        })
        const restored = keyPairStirngToArrayBuffer(kp)
        expect(util.arrayBufferToString(restored.pubKey)).toBe(util.arrayBufferToString(baseKey))
        expect(util.arrayBufferToString(restored.privKey)).toBe(util.arrayBufferToString(otherKey))
    })
})

describe('SessionRecord edge cases', () => {
    test('deserialize migrates legacy payload without version', () => {
        const legacy = JSON.stringify({ sessions: {}, registrationId: 10 })
        expect(() => SessionRecord.deserialize(legacy)).not.toThrow()
    })

    test('deserialize rejects unknown migration version', () => {
        const legacy = JSON.stringify({ version: 'legacy', sessions: {} })
        expect(() => SessionRecord.deserialize(legacy)).toThrow('Error migrating SessionRecord')
    })

    test('deserialize rejects malformed session map', () => {
        const malformed = JSON.stringify({ version: 'v1', sessions: null })
        expect(() => SessionRecord.deserialize(malformed)).toThrow()
    })

    test('getSessionByBaseKey returns undefined for empty key', () => {
        const record = new SessionRecord()
        expect(record.getSessionByBaseKey(new ArrayBuffer(0))).toBeUndefined()
    })
})
