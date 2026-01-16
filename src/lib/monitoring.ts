import * as Sentry from '@sentry/node';

/**
 * Sentry monitoring configuration for backend services
 */

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

export function initSentry() {
    if (!SENTRY_DSN) {
        console.warn(' Sentry DSN not configured, monitoring disabled');
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: ENVIRONMENT,

        // Performance monitoring
        tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

        integrations: [
            Sentry.httpIntegration(),
            Sentry.expressIntegration(),
        ],

        // Error filtering
        beforeSend(event, hint) {
            // Don't send errors in development
            if (ENVIRONMENT === 'development') {
                console.error('Sentry Event:', event);
                console.error('Original Error:', hint.originalException);
                return null;
            }

            // Filter out known non-critical errors
            const error = hint.originalException;
            if (error instanceof Error) {
                if (error.message.includes('Network request failed')) {
                    return null; // Don't send network errors
                }
            }

            return event;
        },
    });

    console.log('Sentry monitoring initialized');
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, any>) {
    Sentry.captureException(error, {
        extra: context,
    });
}

/**
 * Capture message with severity
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
    Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
    Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Set user context
 */
export function setUser(user: { id: string; address?: string }) {
    Sentry.setUser({
        id: user.id,
        username: user.address,
    });
}

/**
 * Clear user context
 */
export function clearUser() {
    Sentry.setUser(null);
}

/**
 * Wrap async function with error tracking
 */
export function withSentry<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    name?: string
): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (error) {
            captureException(error as Error, {
                function: name || fn.name,
                arguments: args,
            });
            throw error;
        }
    }) as T;
}

export { Sentry };
