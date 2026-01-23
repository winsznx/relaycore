import { Facilitator, type PaymentRequirements, CronosNetwork } from '@crypto.com/facilitator-client';
import logger from '../../lib/logger.js';

// Ensure WALLET_PRIVATE_KEY is set for Facilitator SDK (uses RELAY_PRIVATE_KEY if available)
if (!process.env.WALLET_PRIVATE_KEY && process.env.RELAY_PRIVATE_KEY) {
    process.env.WALLET_PRIVATE_KEY = process.env.RELAY_PRIVATE_KEY;
}

const NETWORK = (process.env.VITE_CRONOS_NETWORK ?? 'cronos-testnet') as CronosNetwork;

/**
 * Service for handling x402 payments using the Cronos Facilitator SDK.
 */
export class FacilitatorService {
    private facilitator: Facilitator;

    constructor() {
        this.facilitator = new Facilitator({ network: NETWORK });
        logger.info('Facilitator initialized', { network: NETWORK });
    }

    /**
     * Verify and settle an x402 payment
     * 
     * @param params Payment parameters
     * @returns Settlement result with transaction hash
     */
    async settlePayment(params: {
        paymentHeader: string;
        paymentRequirements: PaymentRequirements;
    }) {
        try {
            logger.debug('Verifying payment');

            // Build the verify request
            const verifyRequest = this.facilitator.buildVerifyRequest(
                params.paymentHeader,
                params.paymentRequirements
            );

            // Step 1: Verify the EIP-3009 authorization
            const verifyResult = await this.facilitator.verifyPayment(verifyRequest);

            if (!verifyResult.isValid) {
                throw new Error('Payment verification failed: Invalid signature or parameters');
            }

            logger.debug('Payment verified');

            // Step 2: Settle the payment on-chain
            logger.debug('Settling payment on Cronos');
            const settleResult = await this.facilitator.settlePayment(verifyRequest);

            logger.info('Payment settled', { txHash: settleResult.txHash });

            return {
                success: true,
                txHash: settleResult.txHash,
                timestamp: Date.now(),
            };
        } catch (error) {
            logger.error('Payment settlement error', error as Error);
            throw error;
        }
    }

    /**
     * Generate payment requirements for a protected resource
     * 
     * @param params Resource parameters
     * @returns Payment requirements object
     */
    generatePaymentRequirements(params: {
        merchantAddress: string;
        amount: string; // in base units (e.g., "1000000" for 1 USDC with 6 decimals)
        resourceUrl: string;
        description?: string;
    }): PaymentRequirements {
        return this.facilitator.generatePaymentRequirements({
            payTo: params.merchantAddress,
            maxAmountRequired: params.amount,
            resource: params.resourceUrl,
            description: params.description || 'Protected resource access',
        });
    }

    /**
     * Get the current network configuration
     */
    getNetwork(): CronosNetwork {
        return NETWORK;
    }

    /**
     * Get the Facilitator instance (for advanced usage)
     */
    getFacilitator(): Facilitator {
        return this.facilitator;
    }
}

// Singleton instance
export const facilitatorService = new FacilitatorService();
