/**
 * Example: Using Official Crypto.com Facilitator SDK
 * 
 * This example shows how to use the refactored payment clients
 * that now use the official @crypto.com/facilitator-client SDK
 */

import { ethers } from 'ethers';
import { X402Client } from '@/lib/x402-client';
import { executeGaslessPayment, fetchWithPayment } from '@/lib/eip3009-client';

// ============================================
// Example 1: Using X402Client (Recommended)
// ============================================

async function example1_X402Client() {
    // Connect wallet
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Create x402 client
    const client = new X402Client(signer, { network: 'testnet' });

    // Make request - payment handled automatically!
    const response = await client.fetch(`${import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz'}/api/trade/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pair: 'BTC-USD',
            side: 'long',
            leverage: 5,
            sizeUsd: 1000
        })
    });

    const quote = await response.json();
    console.log('Quote:', quote);
}

// ============================================
// Example 2: Using fetchWithPayment Helper
// ============================================

async function example2_FetchWithPayment() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Fetch with automatic payment handling
    const response = await fetchWithPayment(
        `${import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz'}/api/trade/quote`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pair: 'BTC-USD',
                side: 'long',
                leverage: 5,
                sizeUsd: 1000
            })
        },
        signer,
        'testnet'
    );

    const quote = await response.json();
    console.log('Quote:', quote);
}

// ============================================
// Example 3: Manual Payment Execution
// ============================================

async function example3_ManualPayment() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Make initial request
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz'}/api/trade/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pair: 'BTC-USD',
            side: 'long',
            leverage: 5,
            sizeUsd: 1000
        })
    });

    // Check for 402
    if (response.status === 402) {
        const data = await response.json();

        // Execute payment manually
        const paymentResult = await executeGaslessPayment(
            data.paymentRequirements,
            signer,
            'testnet'
        );

        if (paymentResult.success) {
            // Retry with payment header
            const retryResponse = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz'}/api/trade/quote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Payment': paymentResult.paymentHeader!
                },
                body: JSON.stringify({
                    pair: 'BTC-USD',
                    side: 'long',
                    leverage: 5,
                    sizeUsd: 1000
                })
            });

            const quote = await retryResponse.json();
            console.log('Quote:', quote);
        }
    }
}

// ============================================
// Example 4: React Component
// ============================================

import { useX402Client } from '@/lib/x402-client';
import { useAccount, useSigner } from 'wagmi';

function TradingComponent() {
    const { address } = useAccount();
    const { data: signer } = useSigner();
    const x402Client = useX402Client(signer, 'testnet');

    const getQuote = async () => {
        if (!x402Client) {
            alert('Please connect wallet');
            return;
        }

        try {
            const response = await x402Client.fetch(`${import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz'}/api/trade/quote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pair: 'BTC-USD',
                    side: 'long',
                    leverage: 5,
                    sizeUsd: 1000
                })
            });

            const quote = await response.json();
            console.log('Quote:', quote);
        } catch (error) {
            console.error('Failed to get quote:', error);
        }
    };

    return (
        <div>
            <button onClick={getQuote}>
                Get Trade Quote (Auto-pays 0.01 USDC)
            </button>
        </div>
    );
}

export {
    example1_X402Client,
    example2_FetchWithPayment,
    example3_ManualPayment,
    TradingComponent
};
