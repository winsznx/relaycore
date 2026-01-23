/**
 * Production-Grade Logger
 * 
 * Features:
 * - Structured JSON logging
 * - Request ID tracing
 * - Performance metrics
 * - Error stack traces
 * - Contextual logging
 */

function generateUUID(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
    [key: string]: any;
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    service: string;
    requestId?: string;
    userId?: string;
    meta?: LogMeta;
}

const SERVICE_NAME = 'relay-core';

class Logger {
    private context: LogMeta = {};

    withContext(context: LogMeta): Logger {
        const newLogger = new Logger();
        newLogger.context = { ...this.context, ...context };
        return newLogger;
    }

    debug(message: string, meta?: LogMeta): void {
        this.log('debug', message, meta);
    }

    info(message: string, meta?: LogMeta): void {
        this.log('info', message, meta);
    }

    warn(message: string, meta?: LogMeta): void {
        this.log('warn', message, meta);
    }

    error(message: string, error?: Error, meta?: LogMeta): void {
        const errorMeta = error ? {
            errorMessage: error.message,
            errorName: error.name,
            stack: error.stack,
            ...meta,
        } : meta;

        this.log('error', message, errorMeta);

        if (typeof window === 'undefined' && process.env.SENTRY_DSN) {
            try {
                import('@sentry/node').then(Sentry => {
                    if (error) {
                        Sentry.captureException(error, { extra: meta });
                    } else {
                        Sentry.captureMessage(message, 'error');
                    }
                }).catch(() => { });
            } catch { }
        }
    }

    perf(operation: string, durationMs: number, meta?: LogMeta): void {
        const level: LogLevel = durationMs > 1000 ? 'warn' : 'info';
        const slow = durationMs > 1000;

        this.log(level, `Performance: ${operation}`, {
            operation,
            durationMs,
            slow,
            ...meta
        });
    }

    private log(level: LogLevel, message: string, meta?: LogMeta): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            service: SERVICE_NAME,
            ...this.context,
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
}

export const logger = new Logger();

export function generateRequestId(): string {
    return generateUUID();
}

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

export function createTimer(name: string): () => number {
    const start = performance.now();
    return () => {
        const duration = Math.round(performance.now() - start);
        logger.perf(name, duration);
        return duration;
    };
}

export class PerformanceTracker {
    private timers: Map<string, number> = new Map();

    start(operation: string): void {
        this.timers.set(operation, performance.now());
    }

    end(operation: string, meta?: LogMeta): number {
        const start = this.timers.get(operation);
        if (!start) {
            logger.warn(`Timer not found for operation: ${operation}`);
            return 0;
        }

        const duration = Math.round(performance.now() - start);
        this.timers.delete(operation);

        logger.perf(operation, duration, meta);
        return duration;
    }
}

export default logger;
