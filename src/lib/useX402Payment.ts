/**
 * x402 Payment Hook
 * 
 * Uses official Cronos Facilitator SDK for proper x402 payment handling
 */

import { useState, useCallback } from 'react';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { BrowserProvider } from 'ethers';
import type { Signer, Eip1193Provider } from 'ethers';

export interface PaymentRequirements {
    x402Version: number;
    paymentRequirements: {
        scheme: 'exact';
        network: string;
        payTo: string;
        asset: string;
        maxAmountRequired: string;
        maxTimeoutSeconds: number;
        resource?: string;
        description?: string;
    };
}

export function useX402Payment() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { address } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider('eip155');

    const handlePayment = useCallback(async (requirements: PaymentRequirements): Promise<string> => {
        if (!address || !walletProvider) {
            throw new Error('Wallet not connected');
        }

        setIsProcessing(true);
        setError(null);

        try {
            console.log('Starting x402 payment with Facilitator SDK...');
            console.log('Payment requirements:', requirements);

            // Import Facilitator SDK
            const { Facilitator, CronosNetwork } = await import('@crypto.com/facilitator-client');

            // Map network string to enum
            const network = requirements.paymentRequirements.network === 'cronos-testnet'
                ? CronosNetwork.CronosTestnet
                : CronosNetwork.CronosMainnet;

            const facilitator = new Facilitator({ network });
            console.log('Facilitator initialized on', requirements.paymentRequirements.network);

            // Get signer from wallet
            const provider = new BrowserProvider(walletProvider as Eip1193Provider);
            const signer: Signer = await provider.getSigner();
            console.log('Signer obtained');

            // Generate payment header using official SDK method
            console.log('Generating payment header...');
            const paymentHeader = await facilitator.generatePaymentHeader({
                to: requirements.paymentRequirements.payTo,
                value: requirements.paymentRequirements.maxAmountRequired,
                asset: requirements.paymentRequirements.asset as any,
                signer,
            });
            console.log('Payment header generated');

            // Generate payment ID
            const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Submit to backend for settlement
            console.log('Submitting payment to /api/pay...');

            const response = await fetch('/api/pay', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-address': address, // Send user address for storage
                },
                body: JSON.stringify({
                    paymentId,
                    paymentHeader,
                    paymentRequirements: requirements.paymentRequirements,
                }),
            });

            console.log('[x402] Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Payment settlement failed:', errorData);
                throw new Error(errorData.error || errorData.details || 'Payment settlement failed');
            }

            const result = await response.json();
            console.log('Payment settled:', result);

            setIsProcessing(false);
            return paymentId;

        } catch (err: any) {
            console.error('Payment error:', err);
            console.error('Error details:', err.message, err.stack);
            const errorMessage = err.message || 'Payment failed';
            setError(errorMessage);
            setIsProcessing(false);
            throw new Error(errorMessage);
        }
    }, [address, walletProvider]);

    return {
        handlePayment,
        isProcessing,
        error,
    };
}
