import { Facilitator, type PaymentRequirements, CronosNetwork } from '@crypto.com/facilitator-client';

const NETWORK = (process.env.VITE_CRONOS_NETWORK ?? 'cronos-testnet') as CronosNetwork;

/**
 * Service for handling x402 payments using the Cronos Facilitator SDK.
 */
export class FacilitatorService {
    private facilitator: Facilitator;

    constructor() {
        this.facilitator = new Facilitator({ network: NETWORK });
        console.log(`Facilitator initialized on ${NETWORK}`);
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
            console.log(`Verifying payment...`);

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

            console.log(`Payment verified`);

            // Step 2: Settle the payment on-chain
            console.log(`Settling payment on Cronos...`);
            const settleResult = await this.facilitator.settlePayment(verifyRequest);

            console.log(`Payment settled: ${settleResult.txHash}`);

            return {
                success: true,
                txHash: settleResult.txHash,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('Payment settlement error:', error);
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
