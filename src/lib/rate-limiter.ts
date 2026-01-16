/**
 * Rate Limiter Middleware
 * 
 * Per ARCHITECTURE.md specification for API endpoints
 */

interface RateLimitRecord {
    count: number;
    reset: number;
}

const rateLimiter = new Map<string, RateLimitRecord>();

interface RateLimitOptions {
    limit?: number;
    windowMs?: number;
}

/**
 * Check if request should be rate limited
 * @returns true if allowed, throws if rate limited
 */
export function checkRateLimit(
    identifier: string,
    options: RateLimitOptions = {}
): boolean {
    const { limit = 100, windowMs = 60000 } = options;
    const now = Date.now();
    const record = rateLimiter.get(identifier);

    // If no record or window expired, create new
    if (!record || now > record.reset) {
        rateLimiter.set(identifier, { count: 1, reset: now + windowMs });
        return true;
    }

    // Check if over limit
    if (record.count >= limit) {
        const retryAfter = Math.ceil((record.reset - now) / 1000);
        throw new RateLimitError(`Rate limit exceeded. Try again in ${retryAfter}s`, retryAfter);
    }

    // Increment count
    record.count++;
    return true;
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
    retryAfter: number;

    constructor(message: string, retryAfter: number) {
        super(message);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}

/**
 * Express/Hono-style middleware
 */
export function rateLimitMiddleware(options: RateLimitOptions = {}) {
    return (req: Request): Response | null => {
        const ip = req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            'unknown';

        try {
            checkRateLimit(ip, options);
            return null; // Continue
        } catch (error) {
            if (error instanceof RateLimitError) {
                return new Response(JSON.stringify({
                    error: 'Rate limit exceeded',
                    retryAfter: error.retryAfter
                }), {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': String(error.retryAfter),
                    },
                });
            }
            throw error;
        }
    };
}

/**
 * API Key rate limiting (different limits per tier)
 */
export function checkApiKeyRateLimit(apiKey: string, tier: 'free' | 'pro' | 'enterprise'): boolean {
    const limits: Record<string, number> = {
        free: 100,
        pro: 1000,
        enterprise: 10000,
    };

    return checkRateLimit(`api:${apiKey}`, {
        limit: limits[tier] || 100,
        windowMs: 60000,
    });
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupRateLimiter(): void {
    const now = Date.now();
    for (const [key, record] of rateLimiter.entries()) {
        if (now > record.reset) {
            rateLimiter.delete(key);
        }
    }
}

// Auto-cleanup every minute
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupRateLimiter, 60000);
}

export default { checkRateLimit, rateLimitMiddleware, checkApiKeyRateLimit };
