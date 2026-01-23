import type { Request, Response, NextFunction } from 'express';
import { facilitatorService } from './facilitator-service.js';
import type { PaymentRequirements } from '@crypto.com/facilitator-client';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../lib/supabase.js';
import logger from '../../lib/logger.js';

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
 * Update service reputation based on payment outcome
 */
async function updateServiceReputation(serviceId: string, success: boolean, latencyMs: number) {
    try {
        // Get current reputation
        const { data: currentRep } = await supabase
            .from('reputations')
            .select('*')
            .eq('service_id', serviceId)
            .single();

        if (!currentRep) {
            // Create initial reputation if doesn't exist
            await supabase.from('reputations').insert({
                service_id: serviceId,
                total_payments: 1,
                successful_payments: success ? 1 : 0,
                failed_payments: success ? 0 : 1,
                avg_latency_ms: latencyMs,
                reputation_score: success ? 80 : 50,
                success_rate: success ? 100 : 0
            });
            return;
        }

        // Calculate new values
        const totalPayments = currentRep.total_payments + 1;
        const successfulPayments = currentRep.successful_payments + (success ? 1 : 0);
        const failedPayments = currentRep.failed_payments + (success ? 0 : 1);
        const successRate = (successfulPayments / totalPayments) * 100;

        // Calculate rolling average latency
        const avgLatencyMs = ((currentRep.avg_latency_ms * currentRep.total_payments) + latencyMs) / totalPayments;

        // Calculate reputation score (weighted: 70% success rate, 20% latency, 10% volume)
        const latencyScore = Math.max(0, 100 - (avgLatencyMs / 10)); // Lower latency = higher score
        const volumeScore = Math.min(100, (totalPayments / 100) * 100); // More payments = higher score
        const reputationScore = (successRate * 0.7) + (latencyScore * 0.2) + (volumeScore * 0.1);

        // Update reputation
        await supabase
            .from('reputations')
            .update({
                total_payments: totalPayments,
                successful_payments: successfulPayments,
                failed_payments: failedPayments,
                avg_latency_ms: Math.round(avgLatencyMs),
                reputation_score: Math.round(reputationScore),
                success_rate: Math.round(successRate * 10) / 10
            })
            .eq('service_id', serviceId);

        logger.info('Updated service reputation', {
            serviceId,
            totalPayments,
            successRate: successRate.toFixed(1),
            reputationScore: reputationScore.toFixed(1)
        });
    } catch (error) {
        logger.error('Failed to update service reputation', error as Error);
    }
}

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
        console.log('Payment Middleware - Headers:', JSON.stringify(req.headers, null, 2));
        const paymentId = req.headers['x-payment-id'] as string;
        const sessionId = req.headers['x-session-id'] as string;

        // Check if user is already entitled (cache first)
        if (paymentId && entitlementCache.has(paymentId)) {
            const entitlement = entitlementCache.get(paymentId)!;
            if (entitlement.resourceUrl === params.resourceUrl) {
                req.isEntitled = true;
                req.paymentId = paymentId;
                req.userAddress = entitlement.userAddress;
                logger.info('Entitlement verified (cache)', { paymentId });
                return next();
            }
        }

        // Check for session-based payment
        if (sessionId) {
            console.log('Session payment requested', { sessionId });
            try {
                const { data: session, error: sessionError } = await supabase
                    .from('escrow_sessions')
                    .select('*')
                    .eq('session_id', sessionId)
                    .eq('is_active', true)
                    .single();

                console.log('Session query result', {
                    found: !!session,
                    error: sessionError?.message,
                    session_id: session?.session_id,
                    deposited: session?.deposited,
                    released: session?.released
                });

                if (session && !sessionError) {
                    const amountRequired = parseFloat(params.amount) / 1000000; // Convert from base units to USDC
                    const spent = parseFloat(session.released || '0'); // Use released as spent
                    const maxSpend = parseFloat(session.max_spend || session.deposited || '0');
                    const remaining = maxSpend - spent;

                    console.log('Session balance check', {
                        sessionId,
                        amountRequired,
                        spent,
                        maxSpend,
                        remaining,
                        hasEnough: remaining >= amountRequired
                    });

                    if (remaining >= amountRequired) {
                        // Deduct from session by updating released amount
                        const newReleased = spent + amountRequired;
                        const newPaymentCount = (session.payment_count || 0) + 1;

                        console.log('Attempting to deduct from session', {
                            sessionId,
                            currentReleased: spent,
                            newReleased,
                            newPaymentCount
                        });

                        const { error: updateError } = await supabase
                            .from('escrow_sessions')
                            .update({
                                released: newReleased.toString(),
                                payment_count: newPaymentCount,
                            })
                            .eq('session_id', sessionId);

                        if (updateError) {
                            console.error('Failed to update session', updateError);
                        } else {
                            // Record session payment with agent details
                            const sessionPaymentId = `session_pay_${uuidv4()}`;

                            // Try to get agent name from services table
                            let agentName = params.merchantAddress;
                            try {
                                const { data: agentService } = await supabase
                                    .from('services')
                                    .select('name')
                                    .ilike('owner_address', params.merchantAddress)
                                    .single();
                                if (agentService?.name) {
                                    agentName = agentService.name;
                                }
                            } catch {
                                // Use address if service lookup fails
                            }

                            await supabase.from('session_payments').insert({
                                session_id: sessionId,
                                agent_address: params.merchantAddress,
                                agent_name: agentName,
                                amount: amountRequired.toString(),
                                execution_id: sessionPaymentId,
                                tx_hash: `session_${sessionId}_${newPaymentCount}`,
                                payment_method: 'session_budget',
                                status: 'success'
                            });

                            // Grant entitlement
                            req.isEntitled = true;
                            req.paymentId = sessionPaymentId;
                            req.userAddress = session.owner_address;

                            console.log('Session payment processed successfully', {
                                sessionId,
                                paymentId: sessionPaymentId,
                                agentName
                            });

                            return next();
                        }
                    } else {
                        console.warn('Insufficient session balance', {
                            sessionId,
                            required: amountRequired,
                            remaining,
                        });
                    }
                } else {
                    console.warn('Session not found or inactive', {
                        sessionId,
                        error: sessionError?.message
                    });
                }
            } catch (error) {
                console.error('Session payment error', error);
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
                    logger.info('Entitlement verified (database)', { paymentId });
                    return next();
                }
            } catch (error) {
                logger.error('Error checking entitlement', error as Error);
            }
        }

        // Generate new payment challenge (402 Payment Required)
        const newPaymentId = `pay_${uuidv4()}`;
        const paymentRequirements = facilitatorService.generatePaymentRequirements({
            merchantAddress: params.merchantAddress,
            amount: params.amount,
            resourceUrl: params.resourceUrl,
        });

        logger.info('Issuing 402 challenge', { paymentId: newPaymentId });

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

        logger.info('Processing payment settlement', { paymentId });
        logger.debug('Payment requirements', { paymentRequirements });

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

        logger.debug('Built facilitator requirements', { facilitatorRequirements });

        // Build VerifyRequest using Facilitator SDK
        const verifyRequest = facilitatorService.getFacilitator().buildVerifyRequest(
            paymentHeader,
            facilitatorRequirements
        );

        logger.debug('VerifyRequest built, calling facilitator');

        // Settle payment via Cronos Facilitator
        const result = await facilitatorService.settlePayment({
            paymentHeader,
            paymentRequirements: facilitatorRequirements,
        });

        logger.info('Payment settled', { paymentId, txHash: result.txHash });

        // Extract user address from verification result
        // The Facilitator SDK returns the verified payment details
        let userAddress = '0x0000000000000000000000000000000000000000';
        try {
            // The payment header contains the EIP-3009 authorization
            // We need to decode it to get the 'from' address
            // For now, we'll get it from the request headers if available
            const authHeader = req.headers['x-user-address'] as string;
            if (authHeader) {
                userAddress = authHeader.toLowerCase();
            } else {
                logger.warn('Could not extract user address from request');
            }
        } catch (e) {
            logger.warn('Could not extract user address from payment header');
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
            const startTime = Date.now();

            // Extract service_id from resource URL
            // Format: /api/services/:id/call or /api/agents/:id/invoke
            let serviceId: string | null = null;
            const resourceUrl = paymentRequirements.resource || '';
            const serviceMatch = resourceUrl.match(/\/api\/services\/([^\/]+)\/call/);
            const agentMatch = resourceUrl.match(/\/api\/agents\/([^\/]+)\/invoke/);
            if (serviceMatch) {
                serviceId = serviceMatch[1];
            } else if (agentMatch) {
                serviceId = agentMatch[1];
            }

            const { error: dbError } = await supabase.from('payments').insert({
                payment_id: paymentId,
                tx_hash: result.txHash,
                from_address: userAddress.toLowerCase(),
                to_address: (paymentRequirements.payTo || '').toLowerCase(),
                amount: paymentRequirements.maxAmountRequired || '0',
                token_address: (paymentRequirements.asset || 'USDC').toLowerCase(),
                resource_url: resourceUrl,
                service_id: serviceId,
                status: 'settled',
                block_number: 0,
                timestamp: new Date().toISOString(),
            });

            if (dbError) {
                logger.error('Failed to store payment in database', dbError as Error);
            } else {
                logger.info('Payment stored in database', { paymentId, serviceId });

                // Update reputation scores if service_id was found
                if (serviceId) {
                    const latencyMs = Date.now() - startTime;
                    await updateServiceReputation(serviceId, true, latencyMs);
                }
            }
        } catch (error) {
            logger.error('Database error', error as Error);
        }

        res.json({
            success: true,
            paymentId,
            txHash: result.txHash,
            message: 'Payment settled successfully',
            timestamp: result.timestamp,
        });
    } catch (error) {
        logger.error('Payment settlement error', error instanceof Error ? error : new Error(String(error)));
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
        logger.info('Cleared expired entitlements', { count: cleared });
    }
}

// Clear expired entitlements every hour
setInterval(() => clearExpiredEntitlements(), 60 * 60 * 1000);
