/**
 * RWA API - Phase 9 Implementation
 * 
 * REST endpoints for RWA asset management:
 * - Asset minting and lifecycle
 * - Settlement tracking
 * - Stats and portfolio views
 */

import { Router } from 'express';
import { rwaAgentService } from '../services/rwa/rwa-agent-service.js';
import logger from '../lib/logger.js';

const router = Router();

// ============================================
// ASSET ENDPOINTS
// ============================================

/**
 * POST /api/rwa/assets/mint
 * Initiate RWA asset minting with handoff
 */
router.post('/assets/mint', async (req, res) => {
    try {
        const { type, name, description, owner, value, currency, metadata, sessionId } = req.body;

        if (!type || !name || !owner || !value) {
            return res.status(400).json({
                error: 'Missing required fields: type, name, owner, value'
            });
        }

        const result = await rwaAgentService.mintAsset({
            type,
            name,
            description: description || '',
            owner,
            value,
            currency: currency || 'USDC',
            metadata,
            sessionId
        });

        res.json(result);
    } catch (error) {
        logger.error('RWA mint failed', error as Error);
        res.status(500).json({ error: 'Failed to initiate minting' });
    }
});

/**
 * POST /api/rwa/assets/:assetId/confirm
 * Confirm asset mint after handoff signature (EIP-712)
 */
router.post('/assets/:assetId/confirm', async (req, res) => {
    try {
        const { assetId } = req.params;
        const { txHash, signedData } = req.body;

        if (!txHash) {
            return res.status(400).json({ error: 'txHash (signature) required' });
        }

        // In production: Verify EIP-712 signature
        // For now, we trust the signature from the frontend
        // TODO: Add ethers.js signature verification here

        const asset = await rwaAgentService.confirmMint(assetId, txHash);

        logger.info('RWA asset confirmed', {
            assetId,
            signature: txHash.slice(0, 10) + '...',
            hasSignedData: !!signedData
        });

        res.json({ asset });
    } catch (error) {
        logger.error('RWA confirm failed', error as Error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/rwa/assets
 * List RWA assets with optional filters
 */
router.get('/assets', async (req, res) => {
    try {
        const { owner, type } = req.query;
        const assets = await rwaAgentService.listAssets(
            owner as string | undefined,
            type as string | undefined
        );
        res.json({ assets });
    } catch (error) {
        logger.error('RWA list failed', error as Error);
        res.status(500).json({ error: 'Failed to list assets' });
    }
});

/**
 * GET /api/rwa/assets/:assetId
 * Get single asset details
 */
router.get('/assets/:assetId', async (req, res) => {
    try {
        const { assetId } = req.params;
        const asset = await rwaAgentService.getAsset(assetId);

        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        const events = await rwaAgentService.getLifecycleEvents(assetId);
        res.json({ asset, events });
    } catch (error) {
        logger.error('RWA get failed', error as Error);
        res.status(500).json({ error: 'Failed to get asset' });
    }
});

/**
 * POST /api/rwa/assets/:assetId/state
 * Update asset lifecycle state
 */
router.post('/assets/:assetId/state', async (req, res) => {
    try {
        const { assetId } = req.params;
        const { status, actor, reason } = req.body;

        if (!status || !actor) {
            return res.status(400).json({ error: 'status and actor required' });
        }

        const asset = await rwaAgentService.updateAssetState(assetId, status, actor, reason);
        res.json({ asset });
    } catch (error) {
        logger.error('RWA state update failed', error as Error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/rwa/assets/:assetId/events
 * Get lifecycle events for an asset
 */
router.get('/assets/:assetId/events', async (req, res) => {
    try {
        const { assetId } = req.params;
        const events = await rwaAgentService.getLifecycleEvents(assetId);
        res.json({ events });
    } catch (error) {
        logger.error('RWA events failed', error as Error);
        res.status(500).json({ error: 'Failed to get events' });
    }
});

// ============================================
// SETTLEMENT ENDPOINTS
// ============================================

/**
 * POST /api/rwa/execute
 * Execute RWA service with escrow payment
 */
router.post('/execute', async (req, res) => {
    try {
        const { serviceId, sessionId, agentAddress, input } = req.body;

        if (!serviceId || !sessionId || !agentAddress) {
            return res.status(400).json({
                error: 'serviceId, sessionId, and agentAddress required'
            });
        }

        const settlement = await rwaAgentService.executeService(
            serviceId,
            sessionId,
            agentAddress,
            input || {}
        );

        res.json({ settlement });
    } catch (error) {
        logger.error('RWA execute failed', error as Error);
        res.status(500).json({ error: 'Failed to execute service' });
    }
});

/**
 * POST /api/rwa/settle
 * Settle RWA execution with proof
 */
router.post('/settle', async (req, res) => {
    try {
        const { requestId, proof } = req.body;

        if (!requestId || !proof?.timestamp || !proof?.result) {
            return res.status(400).json({
                error: 'requestId and proof (with timestamp, result) required'
            });
        }

        const settlement = await rwaAgentService.settleExecution(requestId, proof);
        res.json({ settlement });
    } catch (error) {
        logger.error('RWA settle failed', error as Error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================
// STATE MACHINE ENDPOINTS
// ============================================

/**
 * GET /api/rwa/state-machine/:rwaId/state
 * Get current state of an RWA asset
 */
router.get('/state-machine/:rwaId/state', async (req, res) => {
    try {
        const { rwaId } = req.params;

        const asset = await rwaAgentService.getAsset(rwaId);
        if (!asset) {
            return res.status(404).json({ error: 'RWA not found' });
        }

        res.json({
            rwaId: asset.assetId,
            currentState: asset.status,
            previousState: asset.metadata?.previousState || null,
            metadata: asset.metadata,
            updatedAt: asset.updatedAt.toISOString()
        });
    } catch (error) {
        logger.error('State fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch state' });
    }
});

/**
 * GET /api/rwa/state-machine/:rwaId/history
 * Get transition history for an RWA asset
 */
router.get('/state-machine/:rwaId/history', async (req, res) => {
    try {
        const { rwaId } = req.params;

        const events = await rwaAgentService.getLifecycleEvents(rwaId);

        const transitions = events
            .filter(e => ['mint', 'update', 'freeze', 'unfreeze', 'redeem'].includes(e.eventType))
            .map(e => ({
                id: e.eventId,
                fromState: e.data?.previousStatus || 'pending',
                toState: e.data?.newStatus || e.eventType,
                agentAddress: e.actor,
                agentRole: e.data?.role || 'owner',
                paymentHash: e.txHash || 'N/A',
                transitionedAt: e.timestamp.toISOString()
            }));

        res.json({ transitions });
    } catch (error) {
        logger.error('History fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/**
 * GET /api/rwa/state-machine/:rwaId/next-states
 * Get available next states for an RWA asset
 */
router.get('/state-machine/:rwaId/next-states', async (req, res) => {
    try {
        const { rwaId } = req.params;

        const asset = await rwaAgentService.getAsset(rwaId);
        if (!asset) {
            return res.status(404).json({ error: 'RWA not found' });
        }

        const stateTransitions: Record<string, Array<{ state: string; cost: string; requiredRole: string | null }>> = {
            pending: [
                { state: 'minted', cost: '0.00', requiredRole: null }
            ],
            minted: [
                { state: 'active', cost: '0.05', requiredRole: 'verifier' },
                { state: 'frozen', cost: '0.00', requiredRole: 'admin' }
            ],
            active: [
                { state: 'frozen', cost: '0.00', requiredRole: 'admin' },
                { state: 'redeemed', cost: '0.10', requiredRole: 'redeemer' }
            ],
            frozen: [
                { state: 'active', cost: '0.05', requiredRole: 'admin' },
                { state: 'redeemed', cost: '0.10', requiredRole: 'admin' }
            ],
            redeemed: []
        };

        const nextStates = stateTransitions[asset.status] || [];
        res.json({ nextStates });
    } catch (error) {
        logger.error('Next states fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch next states' });
    }
});

// ============================================
// STATS ENDPOINTS
// ============================================

/**
 * GET /api/rwa/stats
 * Get RWA dashboard stats
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await rwaAgentService.getStats();
        res.json(stats);
    } catch (error) {
        logger.error('RWA stats failed', error as Error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

export default router;
