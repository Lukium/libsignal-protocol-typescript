/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * jobQueue manages multiple queues indexed by device to serialize
 * session io ops on the database.
 */

const jobQueue: { [k: string]: Promise<any> } = {};

export type JobType<T> = () => Promise<T>;

// Keep only the most recent errors so a long-lived app cannot accumulate them
// without bound.
const MAX_RETAINED_ERRORS = 100;

export class SessionLock {
    static errors: any[] = [];
    static _promises: Promise<any>[] = [];
    static queueJobForNumber<T>(id: string, runJob: JobType<T>): Promise<T> {
        const runPrevious = jobQueue[id] || Promise.resolve();
        const runCurrent = (jobQueue[id] = runPrevious.then(runJob, runJob));
        const tracking: Promise<void> = runCurrent
            .then(function () {
                if (jobQueue[id] === runCurrent) {
                    delete jobQueue[id];
                }
            })
            .catch((e) => {
                // SessionLock callers should already have seen these errors on their own
                // Promise chains, but we need to handle them here too so we just save them
                // so callers can review them.
                SessionLock.errors.push(e);
                if (SessionLock.errors.length > MAX_RETAINED_ERRORS) {
                    SessionLock.errors.splice(0, SessionLock.errors.length - MAX_RETAINED_ERRORS);
                }
            })
            .finally(() => {
                // Drop the settled job so the tracking list does not grow without
                // bound over the lifetime of a long-running app.
                const index = SessionLock._promises.indexOf(tracking);
                if (index !== -1) {
                    // splice returns the removed promises; we don't use them.
                    void SessionLock._promises.splice(index, 1);
                }
            });
        SessionLock._promises.push(tracking);
        return runCurrent;
    }

    static async clearQueue(): Promise<void> {
        await Promise.all([...SessionLock._promises]);
    }
}
