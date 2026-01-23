import { Facilitator, type PaymentRequirements, CronosNetwork } from '@crypto.com/facilitator-client';

export class FacilitatorClient {
    private facilitator: Facilitator;

    constructor(network: CronosNetwork = 'cronos-testnet', privateKey?: string) {
        // If privateKey is provided, set it in process.env for the Facilitator SDK to pick up
        // Note: The Facilitator SDK currently relies on process.env.WALLET_PRIVATE_KEY
        if (privateKey) {
            process.env.WALLET_PRIVATE_KEY = privateKey;
        }

        this.facilitator = new Facilitator({ network });
    }

    async settlePayment(params: {
        paymentHeader: string;
        paymentRequirements: PaymentRequirements;
    }) {
        try {
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

            // Step 2: Settle the payment on-chain
            const settleResult = await this.facilitator.settlePayment(verifyRequest);

            return {
                success: true,
                txHash: settleResult.txHash,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('Payment settlement error', error);
            throw error;
        }
    }

    generatePaymentRequirements(params: {
        merchantAddress: string;
        amount: string;
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

    getFacilitator(): Facilitator {
        return this.facilitator;
    }
}
