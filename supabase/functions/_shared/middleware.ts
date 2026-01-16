// Middleware utilities for Supabase Edge Functions
// Following production backend standards

// ============================================
// REQUEST VALIDATION & SANITIZATION
// ============================================

export interface ValidationRule {
    field: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
}

export function validateRequest(body: any, rules: ValidationRule[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of rules) {
        const value = body[rule.field];

        // Required check
        if (rule.required && (value === undefined || value === null)) {
            errors.push(`${rule.field} is required`);
            continue;
        }

        if (value === undefined || value === null) continue;

        // Type check
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rule.type) {
            errors.push(`${rule.field} must be of type ${rule.type}`);
            continue;
        }

        // Min/Max for numbers
        if (rule.type === 'number') {
            if (rule.min !== undefined && value < rule.min) {
                errors.push(`${rule.field} must be at least ${rule.min}`);
            }
            if (rule.max !== undefined && value > rule.max) {
                errors.push(`${rule.field} must be at most ${rule.max}`);
            }
        }

        // Min/Max for strings (length)
        if (rule.type === 'string') {
            if (rule.min !== undefined && value.length < rule.min) {
                errors.push(`${rule.field} must be at least ${rule.min} characters`);
            }
            if (rule.max !== undefined && value.length > rule.max) {
                errors.push(`${rule.field} must be at most ${rule.max} characters`);
            }
            if (rule.pattern && !rule.pattern.test(value)) {
                errors.push(`${rule.field} format is invalid`);
            }
        }

        // Enum check
        if (rule.enum && !rule.enum.includes(value)) {
            errors.push(`${rule.field} must be one of: ${rule.enum.join(', ')}`);
        }
    }

    return { valid: errors.length === 0, errors };
}

// ============================================
// RATE LIMITING (In-Memory for Edge Functions)
// ============================================

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = rateLimitStore.get(identifier);

    if (!entry || now > entry.resetAt) {
        const resetAt = now + windowMs;
        rateLimitStore.set(identifier, { count: 1, resetAt });
        return { allowed: true, remaining: maxRequests - 1, resetAt };
    }

    if (entry.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// ============================================
// LOGGING & TRACING
// ============================================

export interface LogContext {
    requestId: string;
    timestamp: string;
    function: string;
    method?: string;
    path?: string;
    userId?: string;
    ip?: string;
}

export class Logger {
    private context: LogContext;

    constructor(context: LogContext) {
        this.context = context;
    }

    private log(level: string, message: string, meta?: any) {
        const logEntry = {
            level,
            message,
            ...this.context,
            ...(meta && { meta }),
            timestamp: new Date().toISOString()
        };
        console.log(JSON.stringify(logEntry));
    }

    info(message: string, meta?: any) {
        this.log('INFO', message, meta);
    }

    warn(message: string, meta?: any) {
        this.log('WARN', message, meta);
    }

    error(message: string, error?: Error, meta?: any) {
        this.log('ERROR', message, {
            ...meta,
            error: error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : undefined
        });
    }

    debug(message: string, meta?: any) {
        this.log('DEBUG', message, meta);
    }
}

// ============================================
// PERFORMANCE METRICS
// ============================================

export class PerformanceTracker {
    private startTime: number;
    private checkpoints: Map<string, number> = new Map();

    constructor() {
        this.startTime = Date.now();
    }

    checkpoint(name: string) {
        this.checkpoints.set(name, Date.now() - this.startTime);
    }

    getMetrics() {
        return {
            totalDuration: Date.now() - this.startTime,
            checkpoints: Object.fromEntries(this.checkpoints)
        };
    }
}

// ============================================
// ERROR HANDLING
// ============================================

export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public code?: string,
        public details?: any
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export function handleError(error: any, logger: Logger): Response {
    if (error instanceof AppError) {
        logger.error(error.message, error, { code: error.code, details: error.details });
        return new Response(
            JSON.stringify({
                error: error.message,
                code: error.code,
                ...(error.details && { details: error.details })
            }),
            {
                status: error.statusCode,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }

    // Unknown error
    logger.error('Unhandled error', error);
    return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }
    );
}

// ============================================
// RESPONSE HELPERS
// ============================================

export function jsonResponse(data: any, status: number = 200, headers: Record<string, string> = {}) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                'Content-Type': 'application/json',
                'X-Response-Time': Date.now().toString(),
                ...headers
            }
        }
    );
}

// ============================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelayMs?: number;
        maxDelayMs?: number;
        backoffMultiplier?: number;
        onRetry?: (attempt: number, error: Error) => void;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelayMs = 100,
        maxDelayMs = 5000,
        backoffMultiplier = 2,
        onRetry
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxRetries) {
                throw lastError;
            }

            const delay = Math.min(
                initialDelayMs * Math.pow(backoffMultiplier, attempt),
                maxDelayMs
            );

            if (onRetry) {
                onRetry(attempt + 1, lastError);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

// ============================================
// CIRCUIT BREAKER PATTERN
// ============================================

export class CircuitBreaker {
    private failures: number = 0;
    private lastFailureTime: number = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    constructor(
        private threshold: number = 5,
        private timeout: number = 60000 // 1 minute
    ) { }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new AppError('Circuit breaker is OPEN', 503, 'CIRCUIT_OPEN');
            }
        }

        try {
            const result = await fn();
            if (this.state === 'HALF_OPEN') {
                this.reset();
            }
            return result;
        } catch (error) {
            this.recordFailure();
            throw error;
        }
    }

    private recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
        }
    }

    private reset() {
        this.failures = 0;
        this.state = 'CLOSED';
    }
}

// ============================================
// REQUEST ID GENERATION
// ============================================

export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
