/**
 * RWA x402 Payment Service
 * 
 * Production-grade x402 payment enforcement for RWA state transitions.
 * Integrates Facilitator SDK for gasless, verifiable payments.
 */

import { facilitatorService } from '../x402/facilitator-service.js';
import { supabase } from '../../lib/supabase.js';
import logger, { PerformanceTracker } from '../../lib/logger.js';
import type { PaymentRequirements } from '@crypto.com/facilitator-client';

export interface RWAPaymentRequest {
    rwaId: string;
    fromState: string;
    toState: string;
    agentAddress: string;
    agentRole: string;
    cost: string;
    resourceUrl: string;
}

export interface RWAPaymentChallenge {
    statusCode: 402;
    paymentRequirements: PaymentRequirements;
    wwwAuthenticate: string;
    message: string;
}

export interface RWAPaymentVerification {
    success: boolean;
    txHash: string;
    paymentId: string;
    timestamp: number;
}

export class RWAPaymentService {
    private static instance: RWAPaymentService;

    private constructor() { }

    static getInstance(): RWAPaymentService {
        if (!RWAPaymentService.instance) {
            RWAPaymentService.instance = new RWAPaymentService();
        }
        return RWAPaymentService.instance;
    }

    /**
     * Generate 402 payment challenge for RWA transition
     */
    generatePaymentChallenge(request: RWAPaymentRequest): RWAPaymentChallenge {
        const perf = new PerformanceTracker();
        perf.start('generate_payment_challenge');

        const contextLogger = logger.withContext({
            rwaId: request.rwaId,
            transition: `${request.fromState}->${request.toState}`,
            cost: request.cost
        });

        contextLogger.info('Generating x402 payment challenge');

        const amountInBaseUnits = (parseFloat(request.cost) * 1e6).toString();

        const paymentRequirements = facilitatorService.generatePaymentRequirements({
            merchantAddress: request.agentAddress,
            amount: amountInBaseUnits,
            resourceUrl: request.resourceUrl,
            description: `RWA ${request.agentRole} service: ${request.fromState} -> ${request.toState}`
        });

        const wwwAuthenticate = `Bearer realm="${request.resourceUrl}", ` +
            `accept-payment="x402-facilitator", ` +
            `amount="${request.cost}", ` +
            `currency="USDC", ` +
            `payto="${request.agentAddress}"`;

        perf.end('generate_payment_challenge');

        contextLogger.info('Payment challenge generated', {
            amount: request.cost,
            payTo: request.agentAddress
        });

        return {
            statusCode: 402,
            paymentRequirements,
            wwwAuthenticate,
            message: `Payment required: ${request.cost} USDC to ${request.agentAddress}`
        };
    }

    /**
     * Verify and settle x402 payment for RWA transition
     */
    async verifyAndSettlePayment(params: {
        paymentHeader: string;
        paymentRequirements: PaymentRequirements;
        rwaId: string;
        fromState: string;
        toState: string;
        agentAddress: string;
        agentRole: string;
    }): Promise<RWAPaymentVerification> {
        const perf = new PerformanceTracker();
        perf.start('verify_settle_payment');

        const contextLogger = logger.withContext({
            rwaId: params.rwaId,
            transition: `${params.fromState}->${params.toState}`,
            agentAddress: params.agentAddress
        });

        contextLogger.info('Verifying and settling x402 payment');

        try {
            perf.start('facilitator_settlement');
            const settlementResult = await facilitatorService.settlePayment({
                paymentHeader: params.paymentHeader,
                paymentRequirements: params.paymentRequirements
            });
            perf.end('facilitator_settlement');

            if (!settlementResult.success || !settlementResult.txHash) {
                throw new Error('Payment settlement failed');
            }

            const paymentId = `rwa_x402_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            perf.start('record_payment');
            await supabase
                .from('payments')
                .insert({
                    payment_id: paymentId,
                    tx_hash: settlementResult.txHash,
                    from_address: 'facilitator',
                    to_address: params.agentAddress,
                    amount: params.paymentRequirements.maxAmountRequired,
                    token_address: process.env.VITE_USDC_ADDRESS || '',
                    resource_url: params.paymentRequirements.resource,
                    status: 'settled',
                    timestamp: new Date(settlementResult.timestamp).toISOString(),
                    metadata: {
                        rwaId: params.rwaId,
                        transition: `${params.fromState}->${params.toState}`,
                        agentRole: params.agentRole,
                        type: 'rwa_x402_transition'
                    }
                });
            perf.end('record_payment');

            const totalDuration = perf.end('verify_settle_payment');

            contextLogger.info('Payment verified and settled', {
                txHash: settlementResult.txHash,
                paymentId,
                durationMs: totalDuration
            });

            return {
                success: true,
                txHash: settlementResult.txHash,
                paymentId,
                timestamp: settlementResult.timestamp
            };
        } catch (error) {
            perf.end('verify_settle_payment');
            contextLogger.error('Payment verification failed', error as Error);
            throw error;
        }
    }

    /**
     * Verify payment exists and is valid for RWA transition
     */
    async verifyExistingPayment(txHash: string, expectedAmount: string, expectedRecipient: string): Promise<boolean> {
        const contextLogger = logger.withContext({
            txHash,
            expectedAmount,
            expectedRecipient
        });

        contextLogger.info('Verifying existing payment');

        try {
            const { data: payment } = await supabase
                .from('payments')
                .select('*')
                .eq('tx_hash', txHash)
                .eq('status', 'settled')
                .single();

            if (!payment) {
                contextLogger.warn('Payment not found');
                return false;
            }

            const expectedAmountInBaseUnits = (parseFloat(expectedAmount) * 1e6).toString();
            const amountMatch = payment.amount === expectedAmountInBaseUnits;
            const recipientMatch = payment.to_address.toLowerCase() === expectedRecipient.toLowerCase();

            const isValid = amountMatch && recipientMatch;

            contextLogger.info('Payment verification result', {
                isValid,
                amountMatch,
                recipientMatch
            });

            return isValid;
        } catch (error) {
            contextLogger.error('Payment verification error', error as Error);
            return false;
        }
    }
}

export const rwaPaymentService = RWAPaymentService.getInstance();
