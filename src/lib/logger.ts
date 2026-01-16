/**
 * Logger Utility
 * 
 * Per ARCHITECTURE.md specification for observability
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
    [key: string]: any;
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    service: string;
    meta?: LogMeta;
}

const SERVICE_NAME = 'relay-core';

/**
 * Structured logger
 */
export const logger = {
    debug: (message: string, meta?: LogMeta) => log('debug', message, meta),
    info: (message: string, meta?: LogMeta) => log('info', message, meta),
    warn: (message: string, meta?: LogMeta) => log('warn', message, meta),
    error: (message: string, error?: Error, meta?: LogMeta) => {
        const errorMeta = error ? {
            errorMessage: error.message,
            errorName: error.name,
            stack: error.stack?.split('\n').slice(0, 5).join('\n'),
            ...meta,
        } : meta;

        log('error', message, errorMeta);

        // Send to Sentry if configured
        if (typeof window === 'undefined' && process.env.SENTRY_DSN) {
            try {
                // Dynamic import to avoid bundling Sentry in frontend
                import('@sentry/node').then(Sentry => {
                    if (error) {
                        Sentry.captureException(error, { extra: meta });
                    } else {
                        Sentry.captureMessage(message, 'error');
                    }
                }).catch(() => { });
            } catch { }
        }
    },
};

/**
 * Core log function
 */
function log(level: LogLevel, message: string, meta?: LogMeta): void {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        service: SERVICE_NAME,
        ...(meta && { meta }),
    };

    const output = JSON.stringify(entry);

    switch (level) {
        case 'debug':
            console.debug(output);
            break;
        case 'info':
            console.log(output);
            break;
        case 'warn':
            console.warn(output);
            break;
        case 'error':
            console.error(output);
            break;
    }
}

/**
 * Request logger for API endpoints
 */
export function logRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    meta?: LogMeta
): void {
    logger.info(`${method} ${path} ${statusCode} ${durationMs}ms`, {
        method,
        path,
        statusCode,
        durationMs,
        ...meta,
    });
}

/**
 * Performance tracker
 */
export function createTimer(name: string): () => number {
    const start = performance.now();
    return () => {
        const duration = Math.round(performance.now() - start);
        logger.debug(`Timer ${name}: ${duration}ms`, { timer: name, durationMs: duration });
        return duration;
    };
}

export default logger;
