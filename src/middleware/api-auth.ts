/**
 * API Key Authentication Middleware
 * 
 * Validates API keys for SDK and programmatic access to Relay Core.
 * 
 * Usage:
 *   - Include `Authorization: Bearer rc_xxxxx` header
 *   - Or include `x-api-key: rc_xxxxx` header
 * 
 * The middleware validates against the api_keys table in Supabase,
 * checks permissions, rate limits, and expiration.
 */

import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';
import crypto from 'crypto';
import logger from '../lib/logger.js';

export interface AuthenticatedRequest extends Request {
    apiKey?: {
        id: string;
        userId: string;
        permissions: {
            read_services: boolean;
            read_reputation: boolean;
            read_outcomes: boolean;
            read_payments: boolean;
            execute_payments: boolean;
            register_agents: boolean;
        };
        rateLimit: number;
    };
    walletAddress?: string;
}

/**
 * Hash an API key for comparison
 */
function hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Rate limit tracking (in-memory for now, use Redis in production)
 */
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit for an API key
 */
function checkRateLimit(keyId: string, limit: number): boolean {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;

    let record = rateLimitCache.get(keyId);

    if (!record || now > record.resetAt) {
        record = { count: 1, resetAt: now + hourMs };
        rateLimitCache.set(keyId, record);
        return true;
    }

    if (record.count >= limit) {
        return false;
    }

    record.count++;
    return true;
}

/**
 * API Key Authentication Middleware
 * 
 * Validates the API key and attaches user info to the request.
 * For public endpoints, returns early without error if no key is provided.
 */
export function authenticateApiKey(options: { required?: boolean } = {}) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            // Extract API key from headers
            const authHeader = req.headers.authorization;
            const apiKeyHeader = req.headers['x-api-key'] as string;

            let apiKey: string | undefined;

            if (authHeader?.startsWith('Bearer ')) {
                apiKey = authHeader.slice(7);
            } else if (apiKeyHeader) {
                apiKey = apiKeyHeader;
            }

            // If no API key and not required, continue
            if (!apiKey) {
                if (options.required) {
                    return res.status(401).json({
                        success: false,
                        error: 'API key required',
                        hint: 'Include Authorization: Bearer rc_xxx or x-api-key: rc_xxx header',
                    });
                }
                return next();
            }

            // Validate API key format
            if (!apiKey.startsWith('rc_')) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid API key format',
                    hint: 'API keys start with "rc_"',
                });
            }

            // Hash the key for lookup
            const keyHash = hashApiKey(apiKey);

            // Lookup in database
            const { data: keyRecord, error } = await supabase
                .from('api_keys')
                .select('*')
                .eq('key_hash', keyHash)
                .eq('is_active', true)
                .single();

            if (error || !keyRecord) {
                logger.warn('Invalid API key attempt', { keyPrefix: apiKey.slice(0, 10) });
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired API key',
                });
            }

            // Check expiration
            if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
                return res.status(401).json({
                    success: false,
                    error: 'API key expired',
                    hint: 'Generate a new API key from the dashboard',
                });
            }

            // Check rate limit
            if (!checkRateLimit(keyRecord.id, keyRecord.rate_limit || 100)) {
                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    limit: keyRecord.rate_limit,
                    retryAfter: '1 hour',
                });
            }

            // Update last used timestamp (fire and forget)
            supabase
                .from('api_keys')
                .update({ last_used_at: new Date().toISOString() })
                .eq('id', keyRecord.id)
                .then(() => { });

            // Attach API key info to request
            req.apiKey = {
                id: keyRecord.id,
                userId: keyRecord.user_id,
                permissions: keyRecord.permissions || {
                    read_services: true,
                    read_reputation: true,
                    read_outcomes: true,
                    read_payments: true,
                    execute_payments: false,
                    register_agents: true,
                },
                rateLimit: keyRecord.rate_limit || 100,
            };
            req.walletAddress = keyRecord.user_id;

            next();
        } catch (error) {
            logger.error('API key authentication error', error as Error);
            res.status(500).json({
                success: false,
                error: 'Authentication failed',
            });
        }
    };
}

// Permission keys type
type PermissionKey = 'read_services' | 'read_reputation' | 'read_outcomes' | 'read_payments' | 'execute_payments' | 'register_agents';

/**
 * Permission check middleware
 * Use after authenticateApiKey
 */
export function requirePermission(permission: PermissionKey) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.apiKey) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }

        if (!req.apiKey.permissions[permission]) {
            return res.status(403).json({
                success: false,
                error: `Permission denied: ${String(permission)}`,
                availablePermissions: (Object.keys(req.apiKey.permissions) as PermissionKey[])
                    .filter((k) => req.apiKey!.permissions[k])
            });
        }

        next();
    };
}

/**
 * Validate API key without middleware (for SDK use)
 */
export async function validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    userId?: string;
    permissions?: Record<string, boolean>;
    error?: string;
}> {
    if (!apiKey.startsWith('rc_')) {
        return { valid: false, error: 'Invalid API key format' };
    }

    const keyHash = hashApiKey(apiKey);

    const { data: keyRecord, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single();

    if (error || !keyRecord) {
        return { valid: false, error: 'Invalid or expired API key' };
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
        return { valid: false, error: 'API key expired' };
    }

    return {
        valid: true,
        userId: keyRecord.user_id,
        permissions: keyRecord.permissions,
    };
}
