/**
 * X402 Client for Frontend Payment Handling
 * 
 * Uses official @crypto.com/facilitator-client SDK
 * Handles 402 Payment Required responses automatically
 */

import React from 'react';
import { ethers, type Signer } from 'ethers';
import { Facilitator, CronosNetwork, type PaymentRequirements } from '@crypto.com/facilitator-client';

export class X402Client {
    private signer: Signer;
    private facilitator: Facilitator;
    private network: 'testnet' | 'mainnet';

    constructor(signer: Signer, options?: { network?: 'testnet' | 'mainnet' }) {
        this.signer = signer;
        this.network = options?.network ?? 'testnet';

        // Initialize facilitator with correct network
        this.facilitator = new Facilitator({
            network: this.network === 'testnet'
                ? CronosNetwork.CronosTestnet
                : CronosNetwork.CronosMainnet
        });
    }

    /**
     * Fetch with automatic x402 payment handling
     * 
     * @param url - API endpoint
     * @param options - Fetch options
     * @returns Response (after payment if required)
     */
    async fetch(url: string, options: RequestInit = {}): Promise<Response> {
        console.log(`Fetching: ${url}`);

        let response = await fetch(url, options);

        // Handle 402 Payment Required
        if (response.status === 402) {
            console.log('� Payment required - processing...');

            const data = await response.json();
            const paymentRequirements = data.paymentRequirements;

            if (!paymentRequirements) {
                throw new Error('Invalid 402 response: missing paymentRequirements');
            }

            // Execute payment
            const paymentHeader = await this.executePayment(paymentRequirements);

            console.log('Payment completed - retrying request...');

            // Retry with payment header
            response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'X-Payment': paymentHeader,
                },
            });
        }

        return response;
    }

    /**
     * Execute gasless payment using official SDK
     * 
     * @param requirements - Payment requirements from 402 response
     * @returns Payment header for retry
     */
    private async executePayment(requirements: PaymentRequirements): Promise<string> {
        console.log('Generating payment header...');

        // Generate payment header (SDK handles everything!)
        const header = await this.facilitator.generatePaymentHeader({
            to: requirements.payTo,
            value: requirements.maxAmountRequired,
            signer: this.signer,
            validBefore: Math.floor(Date.now() / 1000) + 300, // 5 min
        });

        console.log('Payment header generated');

        // Build verify request
        const body = this.facilitator.buildVerifyRequest(header, requirements);

        console.log('[x402] Verifying payment...');

        // Verify
        const verifyResponse = await this.facilitator.verifyPayment(body);

        if (!verifyResponse.isValid) {
            throw new Error('Payment verification failed');
        }

        console.log('Payment verified');
        console.log('Settling on-chain...');

        // Settle
        const settleResponse = await this.facilitator.settlePayment(body);

        console.log('Payment settled!');
        console.log('Transaction:', settleResponse.txHash);

        return header;
    }

    /**
     * Get facilitator capabilities
     */
    async getCapabilities() {
        return await this.facilitator.getSupported();
    }
}

/**
 * React hook for x402 payments
 */
export function useX402Client(signer?: Signer, network: 'testnet' | 'mainnet' = 'testnet') {
    const [client, setClient] = React.useState<X402Client | null>(null);

    React.useEffect(() => {
        if (signer) {
            setClient(new X402Client(signer, { network }));
        } else {
            setClient(null);
        }
    }, [signer, network]);

    return client;
}
