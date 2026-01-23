/**
 * Bot Linking Service
 * 
 * Secure flow for linking Telegram/Discord accounts to wallet addresses
 * with READ-ONLY API keys (no payment execution)
 */

import crypto from 'crypto';
import { supabase } from '../../lib/supabase.js';
import logger from '../../lib/logger.js';

export interface LinkRequest {
    code: string;
    walletAddress: string;
    expiresAt: Date;
}

export interface LinkedAccount {
    id: string;
    walletAddress: string;
    platform: 'telegram' | 'discord';
    platformUserId: string;
    platformUsername?: string;
    apiKeyId?: string;
    linkedAt: Date;
    lastActiveAt: Date;
    isActive: boolean;
}

export interface ApiKeyPermissions {
    read_services: boolean;
    read_reputation: boolean;
    read_outcomes: boolean;
    read_payments: boolean;
    execute_payments: boolean; // ALWAYS false for bots
}


/**
 * Generate a secure random code for bot linking
 */
function generateSecureCode(): string {
    const bytes = crypto.randomBytes(4);
    const code = bytes.toString('hex').toUpperCase();
    return `RELAY-${code}`;
}

/**
 * Generate a secure API key
 */
function generateSecureApiKey(): string {
    const bytes = crypto.randomBytes(32);
    return `rc_${bytes.toString('base64url')}`;
}

/**
 * Hash an API key for storage
 */
function hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Initiate bot linking by generating a one-time code
 * This code is displayed in the dashboard for the user to enter in the bot
 */
export async function initiateBotLink(walletAddress: string): Promise<LinkRequest> {
    const code = generateSecureCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const { error } = await supabase
        .from('bot_link_requests')
        .insert({
            code,
            wallet_address: walletAddress.toLowerCase(),
            expires_at: expiresAt.toISOString(),
        });

    if (error) {
        logger.error('Failed to create bot link request', error);
        throw new Error('Failed to generate link code');
    }

    logger.info('Bot link request created', {
        code,
        walletAddress: walletAddress.slice(0, 10) + '...',
    });

    return {
        code,
        walletAddress,
        expiresAt,
    };
}

/**
 * Complete bot linking when user enters code in the bot
 * Creates a READ-ONLY API key and links the accounts
 */
export async function completeBotLink(
    linkCode: string,
    platform: 'telegram' | 'discord',
    platformUserId: string,
    platformUsername?: string
): Promise<{ apiKey: string; walletAddress: string }> {
    // Find the link request
    const { data: request, error: findError } = await supabase
        .from('bot_link_requests')
        .select('*')
        .eq('code', linkCode.toUpperCase())
        .eq('is_used', false)
        .single();

    if (findError || !request) {
        throw new Error('Invalid or expired link code');
    }

    // Check expiration
    if (new Date(request.expires_at) < new Date()) {
        throw new Error('Link code has expired');
    }

    // Generate READ-ONLY API key
    const apiKey = generateSecureApiKey();
    const keyHash = hashApiKey(apiKey);

    // Use RPC function to bypass schema cache issues
    const { data: apiKeyRecords, error: keyError } = await supabase.rpc('create_bot_api_key', {
        p_key_hash: keyHash,
        p_user_id: request.wallet_address,
        p_permissions: {
            read_services: true,
            read_reputation: true,
            read_outcomes: true,
            read_payments: true,
            execute_payments: false
        },
        p_rate_limit: 100,
        p_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (keyError || !apiKeyRecords || apiKeyRecords.length === 0) {
        const error = keyError ? new Error(keyError.message) : new Error('No records returned');
        logger.error('Failed to create API key', error);
        throw new Error('Failed to create API key');
    }

    const apiKeyRecord = apiKeyRecords[0];

    // Mark link request as used
    await supabase
        .from('bot_link_requests')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('id', request.id);

    // Create linked account
    const { error: linkError } = await supabase
        .from('linked_bot_accounts')
        .upsert({
            wallet_address: request.wallet_address,
            platform,
            platform_user_id: platformUserId,
            platform_username: platformUsername,
            api_key_id: apiKeyRecord.id,
            linked_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
            is_active: true,
        }, {
            onConflict: 'platform,platform_user_id',
        });

    if (linkError) {
        logger.error('Failed to create linked account', linkError);
        throw new Error('Failed to link account');
    }

    logger.info('Bot account linked successfully', {
        platform,
        platformUserId,
        walletAddress: request.wallet_address.slice(0, 10) + '...',
    });

    return {
        apiKey,
        walletAddress: request.wallet_address,
    };
}

/**
 * Get linked account by platform user ID
 */
export async function getLinkedAccount(
    platform: 'telegram' | 'discord',
    platformUserId: string
): Promise<LinkedAccount | null> {
    const { data, error } = await supabase
        .from('linked_bot_accounts')
        .select('*')
        .eq('platform', platform)
        .eq('platform_user_id', platformUserId)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        return null;
    }

    return {
        id: data.id,
        walletAddress: data.wallet_address,
        platform: data.platform,
        platformUserId: data.platform_user_id,
        platformUsername: data.platform_username,
        apiKeyId: data.api_key_id,
        linkedAt: new Date(data.linked_at),
        lastActiveAt: new Date(data.last_active_at),
        isActive: data.is_active,
    };
}

/**
 * Get all linked accounts for a wallet
 */
export async function getLinkedAccountsForWallet(walletAddress: string): Promise<LinkedAccount[]> {
    const { data, error } = await supabase
        .from('linked_bot_accounts')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .eq('is_active', true);

    if (error) {
        logger.error('Failed to fetch linked accounts', error);
        return [];
    }

    return (data || []).map(acc => ({
        id: acc.id,
        walletAddress: acc.wallet_address,
        platform: acc.platform,
        platformUserId: acc.platform_user_id,
        platformUsername: acc.platform_username,
        apiKeyId: acc.api_key_id,
        linkedAt: new Date(acc.linked_at),
        lastActiveAt: new Date(acc.last_active_at),
        isActive: acc.is_active,
    }));
}

/**
 * Unlink a bot account
 */
export async function unlinkBotAccount(
    platform: 'telegram' | 'discord',
    platformUserId: string
): Promise<boolean> {
    const account = await getLinkedAccount(platform, platformUserId);
    if (!account) {
        return false;
    }

    // Deactivate the API key
    if (account.apiKeyId) {
        await supabase
            .from('api_keys')
            .update({ is_active: false })
            .eq('id', account.apiKeyId);
    }

    // Mark account as inactive
    const { error } = await supabase
        .from('linked_bot_accounts')
        .update({ is_active: false })
        .eq('id', account.id);

    if (error) {
        logger.error('Failed to unlink account', error);
        return false;
    }

    logger.info('Bot account unlinked', { platform, platformUserId });
    return true;
}

/**
 * Verify an API key and return associated wallet address
 */
export async function verifyApiKey(apiKey: string): Promise<{
    valid: boolean;
    walletAddress?: string;
    permissions?: ApiKeyPermissions;
}> {
    const keyHash = hashApiKey(apiKey);

    const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        return { valid: false };
    }

    // Check expiration
    if (new Date(data.expires_at) < new Date()) {
        return { valid: false };
    }

    // Check rate limit
    if (data.queries_used >= data.rate_limit) {
        return { valid: false };
    }

    // Increment usage counter
    await supabase
        .from('api_keys')
        .update({ queries_used: data.queries_used + 1 })
        .eq('id', data.id);

    return {
        valid: true,
        walletAddress: data.user_id,
        permissions: data.permissions as ApiKeyPermissions,
    };
}

/**
 * Reset API key usage counters (run hourly via cron)
 */
export async function resetApiKeyUsageCounters(): Promise<void> {
    const { error } = await supabase
        .from('api_keys')
        .update({ queries_used: 0 })
        .eq('is_active', true);

    if (error) {
        logger.error('Failed to reset API key usage counters', error);
    } else {
        logger.info('API key usage counters reset');
    }
}

export default {
    initiateBotLink,
    completeBotLink,
    getLinkedAccount,
    getLinkedAccountsForWallet,
    unlinkBotAccount,
    verifyApiKey,
    resetApiKeyUsageCounters,
};
