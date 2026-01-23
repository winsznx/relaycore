/**
 * Session API
 *
 * REST endpoints for creating and managing escrow sessions.
 * Supports both direct transfers and x402/EIP-3009 gasless payments.
 */

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { X402SessionService } from '../services/session/x402-session-service.js';
import { Facilitator, CronosNetwork } from '@crypto.com/facilitator-client';
import logger from '../lib/logger.js';

const router = Router();

const RELAY_WALLET_ADDRESS = process.env.RELAY_WALLET_ADDRESS || process.env.WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';

const sessionService = new X402SessionService(supabase, RELAY_WALLET_ADDRESS);

/**
 * POST /api/sessions/create
 * 
 * Create a new escrow session with x402 payment requirement
 */
router.post('/create', async (req, res) => {
    try {
        const { ownerAddress, maxSpend, durationHours, authorizedAgents } = req.body;

        if (!ownerAddress || !maxSpend || !durationHours) {
            return res.status(400).json({
                error: 'Missing required fields: ownerAddress, maxSpend, durationHours'
            });
        }

        const result = await sessionService.createSessionWithPayment({
            ownerAddress,
            maxSpend: String(maxSpend),
            durationHours: Number(durationHours),
            authorizedAgents: authorizedAgents || []
        });

        logger.info('Session created via API', {
            sessionId: result.session.session_id,
            owner: ownerAddress,
            maxSpend
        });

        res.json({
            session: {
                session_id: result.session.session_id,
                owner: result.session.owner_address,
                maxSpend: result.session.max_spend,
                isActive: result.session.is_active,
                expiresAt: result.session.expiry
            },
            paymentRequest: result.paymentRequest,
            requiresPayment: result.requiresPayment
        });
    } catch (error) {
        logger.error('Session creation error', error as Error);
        res.status(500).json({
            error: 'Failed to create session',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * POST /api/sessions/:sessionId/activate
 * 
 * Activate session after payment verification
 */
router.post('/:sessionId/activate', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { txHash, amount } = req.body;

        if (!txHash || !amount) {
            return res.status(400).json({
                error: 'Missing required fields: txHash, amount'
            });
        }

        const session = await sessionService.activateSession(
            sessionId,
            txHash,
            String(amount)
        );

        logger.info('Session activated via API', {
            sessionId,
            txHash
        });

        res.json({
            session: {
                session_id: session.session_id,
                owner: session.owner_address,
                deposited: session.deposited,
                isActive: session.is_active,
                txHash: session.created_tx_hash
            }
        });
    } catch (error) {
        logger.error('Session activation error', error as Error);
        res.status(500).json({
            error: 'Failed to activate session',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/sessions/:sessionId
 * 
 * Get session details
 */
router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await sessionService.getSession(sessionId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json({
            session: {
                session_id: session.session_id,
                owner: session.owner_address,
                deposited: session.deposited,
                released: session.released,
                maxSpend: session.max_spend,
                isActive: session.is_active,
                expiresAt: session.expiry,
                createdAt: session.created_at
            }
        });
    } catch (error) {
        logger.error('Session fetch error', error as Error);
        res.status(500).json({
            error: 'Failed to fetch session',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * POST /api/sessions/:sessionId/refund
 *
 * Refund remaining balance via x402
 */
router.post('/:sessionId/refund', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await sessionService.refundSession(sessionId);

        logger.info('Session refunded via API', {
            sessionId,
            refundAmount: result.refundAmount
        });

        res.json(result);
    } catch (error) {
        logger.error('Session refund error', error as Error);
        res.status(500).json({
            error: 'Failed to refund session',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * POST /api/sessions/:sessionId/settle-x402
 *
 * Settle x402/EIP-3009 payment via Facilitator
 * User signs TransferWithAuthorization off-chain, Facilitator settles on-chain
 */
router.post('/:sessionId/settle-x402', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { from, to, value, validAfter, validBefore, nonce, signature, amount } = req.body;

        if (!from || !to || !value || !signature || !amount) {
            return res.status(400).json({
                error: 'Missing required fields: from, to, value, signature, amount'
            });
        }

        logger.info('Processing x402 settlement', {
            sessionId,
            from,
            to,
            amount
        });

        // Verify session exists and is pending payment
        const session = await sessionService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.is_active) {
            return res.status(400).json({ error: 'Session already active' });
        }

        // Verify the 'to' address matches Relay wallet
        if (to.toLowerCase() !== RELAY_WALLET_ADDRESS.toLowerCase()) {
            return res.status(400).json({
                error: 'Invalid recipient address',
                expected: RELAY_WALLET_ADDRESS
            });
        }

        // Initialize Facilitator
        const network = (process.env.CRONOS_NETWORK || 'cronos-testnet') as CronosNetwork;
        const facilitator = new Facilitator({ network });

        try {
            // Build the payment header from user's signed authorization
            const paymentHeader = JSON.stringify({
                from,
                to,
                value,
                validAfter: validAfter || 0,
                validBefore: validBefore || Math.floor(Date.now() / 1000) + 3600,
                nonce,
                signature
            });

            // Build payment requirements
            const paymentRequirements = facilitator.generatePaymentRequirements({
                payTo: to,
                maxAmountRequired: value,
                resource: `/api/sessions/${sessionId}/activate`,
                description: `Session deposit: ${amount} USDC`
            });

            // Build verify request
            const verifyRequest = facilitator.buildVerifyRequest(paymentHeader, paymentRequirements);

            // Verify the EIP-3009 authorization
            const verifyResult = await facilitator.verifyPayment(verifyRequest);
            if (!verifyResult.isValid) {
                logger.warn('x402 payment verification failed', { sessionId, from });
                return res.status(400).json({
                    error: 'Payment verification failed',
                    details: (verifyResult as { error?: string }).error || 'Invalid signature or parameters'
                });
            }

            // Settle on-chain via Facilitator (GASLESS!)
            logger.info('Settling x402 payment via Facilitator', { sessionId, from, amount });
            const settleResult = await facilitator.settlePayment(verifyRequest);

            logger.info('x402 payment settled successfully', {
                sessionId,
                txHash: settleResult.txHash,
                from,
                amount
            });

            // Record the settlement in x402_audit_log
            await supabase.from('x402_audit_log').insert({
                action: 'session_deposit_settled',
                session_id: sessionId,
                agent_address: from,
                amount: amount,
                facilitator_tx_hash: settleResult.txHash,
                status: 'success',
                metadata: {
                    network,
                    validBefore,
                    nonce
                }
            });

            res.json({
                success: true,
                txHash: settleResult.txHash,
                message: 'Payment settled via x402 Facilitator',
                sessionId
            });

        } catch (facilitatorError) {
            logger.error('Facilitator settlement failed', facilitatorError as Error);

            // Record failed attempt
            await supabase.from('x402_audit_log').insert({
                action: 'session_deposit_failed',
                session_id: sessionId,
                agent_address: from,
                amount: amount,
                status: 'failed',
                error_message: facilitatorError instanceof Error ? facilitatorError.message : 'Unknown error',
                metadata: { from, to, value }
            });

            return res.status(500).json({
                error: 'Facilitator settlement failed',
                message: facilitatorError instanceof Error ? facilitatorError.message : 'Unknown error'
            });
        }

    } catch (error) {
        logger.error('x402 settlement error', error as Error);
        res.status(500).json({
            error: 'Failed to settle x402 payment',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
