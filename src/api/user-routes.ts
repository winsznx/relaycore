/**
 * User Profile & Settings API Routes
 * 
 * REST endpoints for user configuration, preferences, and API keys
 * All data is secured by wallet address
 */

import { Router, type Request, type Response } from 'express';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';
import crypto from 'crypto';

const router = Router();

/**
 * Hash an API key for storage
 */
function hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Generate a secure API key
 */
function generateSecureApiKey(): string {
    const bytes = crypto.randomBytes(32);
    return `rc_${bytes.toString('base64url')}`;
}

// ============================================================================
// PROFILE ENDPOINTS
// ============================================================================

/**
 * GET /api/user/profile
 * Get user profile by wallet address
 */
router.get('/profile', async (req: Request, res: Response) => {
    try {
        const walletAddress = (req.query.wallet as string)?.toLowerCase();

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'wallet query parameter is required',
            });
        }

        // Fetch profile
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('wallet_address', walletAddress)
            .single();

        // Fetch notification settings
        const { data: notifications } = await supabase
            .from('notification_settings')
            .select('*')
            .eq('wallet_address', walletAddress)
            .single();

        // Fetch API keys (without the hash)
        const { data: apiKeys } = await supabase
            .from('api_keys')
            .select('id, name, created_at, last_used_at, is_active')
            .eq('user_id', walletAddress)
            .eq('is_active', true);

        // Fetch linked bot accounts
        const { data: linkedAccounts } = await supabase
            .from('linked_bot_accounts')
            .select('id, platform, platform_username, linked_at, is_active')
            .eq('wallet_address', walletAddress)
            .eq('is_active', true);

        res.json({
            displayName: profile?.display_name || '',
            email: profile?.email || '',
            avatarUrl: profile?.avatar_url || '',
            notifications: notifications ? {
                payments: notifications.notify_payments_received,
                services: notifications.notify_service_calls,
                reputation: notifications.notify_reputation_changes,
                health: notifications.notify_health_alerts,
                dailySummary: notifications.notify_daily_summary,
            } : {
                payments: true,
                services: true,
                reputation: true,
                health: true,
                dailySummary: false,
            },
            apiKeys: (apiKeys || []).map(k => ({
                id: k.id,
                name: k.name,
                created: k.created_at,
                lastUsed: k.last_used_at || 'Never',
            })),
            linkedAccounts: (linkedAccounts || []).map(a => ({
                id: a.id,
                platform: a.platform,
                username: a.platform_username || 'Unknown',
                linkedAt: a.linked_at,
            })),
        });
    } catch (error) {
        logger.error('Failed to fetch profile', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch profile',
        });
    }
});

/**
 * POST /api/user/profile
 * Create or update user profile
 */
router.post('/profile', async (req: Request, res: Response) => {
    try {
        const { walletAddress, displayName, email } = req.body;

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'walletAddress is required',
            });
        }

        const normalizedAddress = walletAddress.toLowerCase();

        // Upsert profile
        const { error } = await supabase
            .from('user_profiles')
            .upsert({
                wallet_address: normalizedAddress,
                display_name: displayName || null,
                email: email || null,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'wallet_address',
            });

        if (error) {
            throw error;
        }

        logger.info('Profile updated', { wallet: normalizedAddress.slice(0, 10) + '...' });

        res.json({
            success: true,
            message: 'Profile updated',
        });
    } catch (error) {
        logger.error('Failed to update profile', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile',
        });
    }
});

// ============================================================================
// NOTIFICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/user/notifications
 * Update notification preferences
 */
router.post('/notifications', async (req: Request, res: Response) => {
    try {
        const { walletAddress, payments, services, reputation, health, dailySummary } = req.body;

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'walletAddress is required',
            });
        }

        const normalizedAddress = walletAddress.toLowerCase();

        // Ensure profile exists first
        await supabase.from('user_profiles').upsert({
            wallet_address: normalizedAddress,
        }, { onConflict: 'wallet_address' });

        // Upsert notification settings
        const { error } = await supabase
            .from('notification_settings')
            .upsert({
                wallet_address: normalizedAddress,
                notify_payments_received: payments ?? true,
                notify_payments_sent: payments ?? true,
                notify_service_calls: services ?? true,
                notify_reputation_changes: reputation ?? true,
                notify_health_alerts: health ?? true,
                notify_daily_summary: dailySummary ?? false,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'wallet_address',
            });

        if (error) {
            throw error;
        }

        logger.info('Notification settings updated', { wallet: normalizedAddress.slice(0, 10) + '...' });

        res.json({
            success: true,
            message: 'Notification settings updated',
        });
    } catch (error) {
        logger.error('Failed to update notifications', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to update notifications',
        });
    }
});

// ============================================================================
// API KEY ENDPOINTS
// ============================================================================

/**
 * POST /api/user/api-keys
 * Generate a new API key
 */
router.post('/api-keys', async (req: Request, res: Response) => {
    try {
        const { walletAddress, name } = req.body;

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'walletAddress is required',
            });
        }

        const normalizedAddress = walletAddress.toLowerCase();

        // Generate secure API key
        const apiKey = generateSecureApiKey();
        const keyHash = hashApiKey(apiKey);

        // Store hashed key with restricted permissions
        const { data, error } = await supabase
            .from('api_keys')
            .insert({
                key_hash: keyHash,
                user_id: normalizedAddress,
                name: name || 'Default Key',
                permissions: {
                    read_services: true,
                    read_reputation: true,
                    read_outcomes: true,
                    read_payments: true,
                    execute_payments: false, // CRITICAL: Never allow payment execution
                },
                rate_limit: 100, // 100 requests per hour
                expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        logger.info('API key generated', { wallet: normalizedAddress.slice(0, 10) + '...' });

        // Return the key ONLY ONCE - user must copy it now
        res.json({
            success: true,
            id: data.id,
            name: data.name,
            key: apiKey, // Only returned once!
            message: 'API key generated. Copy it now - you won\'t see it again!',
        });
    } catch (error) {
        logger.error('Failed to generate API key', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate API key',
        });
    }
});

/**
 * DELETE /api/user/api-keys/:keyId
 * Revoke an API key
 */
router.delete('/api-keys/:keyId', async (req: Request, res: Response) => {
    try {
        const { keyId } = req.params;

        // Deactivate the key (don't delete for audit trail)
        const { error } = await supabase
            .from('api_keys')
            .update({ is_active: false })
            .eq('id', keyId);

        if (error) {
            throw error;
        }

        logger.info('API key revoked', { keyId });

        res.json({
            success: true,
            message: 'API key revoked',
        });
    } catch (error) {
        logger.error('Failed to revoke API key', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to revoke API key',
        });
    }
});

export default router;
