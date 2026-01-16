/**
 * Bot Linking API Routes
 * 
 * REST endpoints for bot integration
 */

import { Router, type Request, type Response } from 'express';
import {
    initiateBotLink,
    completeBotLink,
    getLinkedAccountsForWallet,
    unlinkBotAccount,
    verifyApiKey,
} from '../services/bot-linking/telegram-link.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * POST /api/bot/link
 * Generate a one-time link code for bot connection
 */
router.post('/link', async (req: Request, res: Response) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'walletAddress is required',
            });
        }

        const result = await initiateBotLink(walletAddress);

        res.json({
            success: true,
            code: result.code,
            expiresAt: result.expiresAt.toISOString(),
        });
    } catch (error) {
        logger.error('Failed to generate link code', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate link code',
        });
    }
});

/**
 * POST /api/bot/complete
 * Complete bot linking (called by bot after user enters code)
 */
router.post('/complete', async (req: Request, res: Response) => {
    try {
        const { code, platform, platformUserId, platformUsername } = req.body;

        if (!code || !platform || !platformUserId) {
            return res.status(400).json({
                success: false,
                error: 'code, platform, and platformUserId are required',
            });
        }

        if (!['telegram', 'discord'].includes(platform)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid platform. Must be telegram or discord',
            });
        }

        const result = await completeBotLink(code, platform, platformUserId, platformUsername);

        res.json({
            success: true,
            walletAddress: result.walletAddress,
            apiKey: result.apiKey, // Return to bot for storage
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to complete linking';
        res.status(400).json({
            success: false,
            error: message,
        });
    }
});

/**
 * GET /api/bot/accounts
 * Get all linked accounts for a wallet
 */
router.get('/accounts', async (req: Request, res: Response) => {
    try {
        const { wallet } = req.query;

        if (!wallet || typeof wallet !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'wallet query parameter is required',
            });
        }

        const accounts = await getLinkedAccountsForWallet(wallet);

        res.json({
            success: true,
            accounts: accounts.map(acc => ({
                id: acc.id,
                platform: acc.platform,
                platformUsername: acc.platformUsername,
                linkedAt: acc.linkedAt.toISOString(),
                lastActiveAt: acc.lastActiveAt.toISOString(),
                isActive: acc.isActive,
            })),
        });
    } catch (error) {
        logger.error('Failed to fetch linked accounts', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch linked accounts',
        });
    }
});

/**
 * DELETE /api/bot/accounts/:id
 * Unlink a bot account
 */
router.delete('/accounts/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { platform, platformUserId } = req.body;

        if (!platform || !platformUserId) {
            return res.status(400).json({
                success: false,
                error: 'platform and platformUserId are required in body',
            });
        }

        const success = await unlinkBotAccount(platform, platformUserId);

        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({
                success: false,
                error: 'Account not found or already unlinked',
            });
        }
    } catch (error) {
        logger.error('Failed to unlink account', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to unlink account',
        });
    }
});

/**
 * POST /api/bot/verify
 * Verify an API key (used by bot to validate requests)
 */
router.post('/verify', async (req: Request, res: Response) => {
    try {
        const { apiKey } = req.body;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'apiKey is required',
            });
        }

        const result = await verifyApiKey(apiKey);

        if (result.valid) {
            res.json({
                success: true,
                walletAddress: result.walletAddress,
                permissions: result.permissions,
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Invalid or expired API key',
            });
        }
    } catch (error) {
        logger.error('Failed to verify API key', error as Error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify API key',
        });
    }
});

/**
 * Middleware for API key authentication (for bot requests)
 */
export async function botApiKeyAuth(req: Request, res: Response, next: () => void) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Missing or invalid Authorization header',
        });
    }

    const apiKey = authHeader.slice(7);
    const result = await verifyApiKey(apiKey);

    if (!result.valid) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired API key',
        });
    }

    // Attach wallet to request for downstream handlers
    (req as Request & { walletAddress: string }).walletAddress = result.walletAddress!;
    (req as Request & { permissions: object }).permissions = result.permissions!;

    next();
}

export { router as botRoutes };
export default router;
