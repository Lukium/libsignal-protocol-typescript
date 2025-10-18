export type LogContext = Record<string, unknown>;

type LoggerMethod = (this: void, message: string, context?: LogContext) => void;

export interface SignalLogger {
    debug: LoggerMethod;
    info: LoggerMethod;
    warn: LoggerMethod;
    error: LoggerMethod;
}

const noop = () => {
    // Intentionally empty
};

const defaultLogger: SignalLogger = {
    debug: noop,
    info: noop,
    warn: (message: string, context?: LogContext) => {
        if (context) {
            console.warn(message, context);
        } else {
            console.warn(message);
        }
    },
    error: (message: string, context?: LogContext) => {
        if (context) {
            console.error(message, context);
        } else {
            console.error(message);
        }
    },
};

let activeLogger: SignalLogger = defaultLogger;

/**
 * Returns the active logger. Prefer using this helper so that consumers can
 * override logging behaviour via {@link setLogger}.
 */
export function getLogger(): SignalLogger {
    return activeLogger;
}

/**
 * Customise the logging implementation used by the library. Pass
 * `undefined` or omit the argument to restore the default console-backed
 * logger.
 */
export function setLogger(logger?: Partial<SignalLogger>): void {
    if (!logger) {
        activeLogger = defaultLogger;
        return;
    }

    const wrap = <K extends keyof SignalLogger>(method: K, fallback: SignalLogger[K]): SignalLogger[K] => {
        const override = logger[method];
        if (!override) {
            return fallback;
        }
        return ((message: string, context?: LogContext) => override(message, context)) as SignalLogger[K];
    };

    activeLogger = {
        debug: wrap('debug', defaultLogger.debug),
        info: wrap('info', defaultLogger.info),
        warn: wrap('warn', defaultLogger.warn),
        error: wrap('error', defaultLogger.error),
    };
}
