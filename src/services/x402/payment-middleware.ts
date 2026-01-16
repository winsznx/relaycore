import type { Request, Response, NextFunction } from 'express';
import { facilitatorService } from './facilitator-service.js';
import type { PaymentRequirements } from '@crypto.com/facilitator-client';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../lib/supabase.js';

/**
 * Extended Request interface with payment metadata
 */
export interface X402ProtectedRequest extends Request {
    paymentId?: string;
    isEntitled?: boolean;
    userAddress?: string;
}

/**
 * In-memory entitlement cache (for fast lookups)
 * In production, this is backed by Supabase
 */
const entitlementCache = new Map<string, {
    paymentId: string;
    resourceUrl: string;
    userAddress: string;
    timestamp: number;
}>();

/**
 * Middleware to protect routes with x402 payment requirement
 * 
 * Usage:
 * ```typescript
 * router.get('/api/data', 
 *   requirePayment({
 *     merchantAddress: '0x...',
 *     amount: '1000000', // 1 USDC
 *     resourceUrl: 'https://relaycore.xyz/api/data'
 *   }),
 *   (req, res) => {
 *     res.json({ data: 'protected content' });
 *   }
 * );
 * ```
 */
export function requirePayment(params: {
    merchantAddress: string;
    amount: string;
    resourceUrl: string;
}) {
    return async (req: X402ProtectedRequest, res: Response, next: NextFunction) => {
        const paymentId = req.headers['x-payment-id'] as string;

        // Check if user is already entitled (cache first)
        if (paymentId && entitlementCache.has(paymentId)) {
            const entitlement = entitlementCache.get(paymentId)!;
            if (entitlement.resourceUrl === params.resourceUrl) {
                req.isEntitled = true;
                req.paymentId = paymentId;
                req.userAddress = entitlement.userAddress;
                console.log(`Entitlement verified (cache): ${paymentId}`);
                return next();
            }
        }

        // Check Supabase for entitlement
        if (paymentId) {
            try {
                const { data, error } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('payment_id', paymentId)
                    .eq('resource_url', params.resourceUrl)
                    .eq('status', 'settled')
                    .single();

                if (data && !error) {
                    // Cache the entitlement
                    entitlementCache.set(paymentId, {
                        paymentId,
                        resourceUrl: params.resourceUrl,
                        userAddress: data.from_address,
                        timestamp: Date.now(),
                    });

                    req.isEntitled = true;
                    req.paymentId = paymentId;
                    req.userAddress = data.from_address;
                    console.log(`Entitlement verified (database): ${paymentId}`);
                    return next();
                }
            } catch (error) {
                console.error('Error checking entitlement:', error);
            }
        }

        // Generate new payment challenge (402 Payment Required)
        const newPaymentId = `pay_${uuidv4()}`;
        const paymentRequirements = facilitatorService.generatePaymentRequirements({
            merchantAddress: params.merchantAddress,
            amount: params.amount,
            resourceUrl: params.resourceUrl,
        });

        console.log(`Issuing 402 challenge: ${newPaymentId}`);

        // Return 402 Payment Required with x402 challenge
        res.status(402).json({
            error: 'Payment Required',
            paymentId: newPaymentId,
            paymentRequirements,
            message: `Payment of ${params.amount} base units required to access this resource`,
            network: facilitatorService.getNetwork(),
        });
    };
}

/**
 * Handle payment settlement endpoint
 * 
 * POST /api/pay
 * Body: { paymentId, paymentHeader, paymentRequirements }
 */
export async function handlePaymentSettlement(req: Request, res: Response) {
    try {
        const { paymentId, paymentHeader, paymentRequirements } = req.body as {
            paymentId: string;
            paymentHeader: string;
            paymentRequirements: any; // Frontend sends simplified structure
        };

        // Validate required parameters
        if (!paymentId || !paymentHeader || !paymentRequirements) {
            return res.status(400).json({
                error: 'Missing required payment parameters',
                required: ['paymentId', 'paymentHeader', 'paymentRequirements']
            });
        }

        console.log(`Processing payment settlement: ${paymentId}`);
        console.log(`Payment requirements:`, paymentRequirements);

        // Build proper PaymentRequirements for Facilitator SDK
        const facilitatorRequirements = {
            scheme: 'exact',
            network: paymentRequirements.network || 'cronos-testnet',
            payTo: paymentRequirements.payTo,
            asset: paymentRequirements.asset, // Should be contract address string
            description: paymentRequirements.description || 'Protected resource access',
            mimeType: paymentRequirements.mimeType || 'application/json',
            maxAmountRequired: paymentRequirements.maxAmountRequired,
            maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds || 300,
            resource: paymentRequirements.resource,
        } as PaymentRequirements;

        console.log(`Built facilitator requirements:`, facilitatorRequirements);

        // Build VerifyRequest using Facilitator SDK
        const verifyRequest = facilitatorService.getFacilitator().buildVerifyRequest(
            paymentHeader,
            facilitatorRequirements
        );

        console.log(`VerifyRequest built, calling facilitator...`);

        // Settle payment via Cronos Facilitator
        const result = await facilitatorService.settlePayment({
            paymentHeader,
            paymentRequirements: facilitatorRequirements,
        });

        console.log(`Payment settled: ${result.txHash}`);

        // Decode payment header to extract user address
        // Payment header is base64-encoded EIP-3009 payload
        let userAddress = '0x0000000000000000000000000000000000000000';
        try {
            const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
            const payload = JSON.parse(decoded);
            userAddress = payload.from || userAddress;
        } catch (e) {
            console.warn('Could not extract user address from payment header');
        }

        // Store entitlement in cache
        entitlementCache.set(paymentId, {
            paymentId,
            resourceUrl: paymentRequirements.resource || '',
            userAddress,
            timestamp: Date.now(),
        });

        // Store payment in Supabase for persistence and indexing
        try {
            const { error: dbError } = await supabase.from('payments').insert({
                payment_id: paymentId,
                tx_hash: result.txHash,
                from_address: userAddress,
                to_address: paymentRequirements.payTo || '',
                amount: paymentRequirements.maxAmountRequired || '0',
                token_address: paymentRequirements.asset || 'USDC',
                resource_url: paymentRequirements.resource || '',
                status: 'settled',
                block_number: 0,
                timestamp: new Date().toISOString(),
            });

            if (dbError) {
                console.error('Failed to store payment in database:', dbError);
                // Don't fail the request, payment is already settled
            } else {
                console.log(`Payment stored in database: ${paymentId}`);
            }
        } catch (dbError) {
            console.error('Database error:', dbError);
        }

        res.json({
            success: true,
            paymentId,
            txHash: result.txHash,
            message: 'Payment settled successfully',
            timestamp: result.timestamp,
        });
    } catch (error) {
        console.error('Payment settlement error:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
        res.status(500).json({
            error: 'Payment settlement failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Extract user address from EIP-3009 payment header
 */
function extractUserAddress(paymentHeader: string): string {
    try {
        // Payment header is ABI-encoded: (from, to, value, validAfter, validBefore, nonce, signature)
        // The first 32 bytes after the initial offset contain the 'from' address
        const decoded = paymentHeader.slice(2); // Remove 0x
        const fromAddress = '0x' + decoded.slice(24, 64); // Extract address (20 bytes, padded to 32)
        return fromAddress;
    } catch (error) {
        console.error('Failed to extract user address:', error);
        return '0x0000000000000000000000000000000000000000';
    }
}

/**
 * Clear expired entitlements from cache (run periodically)
 */
export function clearExpiredEntitlements(maxAgeMs: number = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleared = 0;

    for (const [paymentId, entitlement] of entitlementCache.entries()) {
        if (now - entitlement.timestamp > maxAgeMs) {
            entitlementCache.delete(paymentId);
            cleared++;
        }
    }

    if (cleared > 0) {
        console.log(`[CACHE] Cleared ${cleared} expired entitlements from cache`);
    }
}

// Clear expired entitlements every hour
setInterval(() => clearExpiredEntitlements(), 60 * 60 * 1000);
