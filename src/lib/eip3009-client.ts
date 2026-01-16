/**
 * EIP-3009 Payment Client (Official SDK)
 * 
 * Uses @crypto.com/facilitator-client for gasless USDC.e payments
 * Integrates with Cronos x402 Facilitator
 * 
 * Official SDK handles:
 * - Correct EIP-712 domain versions (mainnet vs testnet)
 * - Payment header generation
 * - Verification and settlement
 */

import { Facilitator, CronosNetwork } from '@crypto.com/facilitator-client';
import { ethers } from 'ethers';

// Network configuration
const NETWORK_CONFIG = {
    testnet: {
        network: CronosNetwork.CronosTestnet,
        chainId: 338,
        usdcContract: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0', // devUSDC.e
        rpcUrl: 'https://evm-t3.cronos.org',
    },
    mainnet: {
        network: CronosNetwork.CronosMainnet,
        chainId: 25,
        usdcContract: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C', // USDC.e
        rpcUrl: 'https://evm.cronos.org',
    },
};

export interface PaymentRequirements {
    scheme: 'exact';
    network: string;
    payTo: string;
    asset: string;
    maxAmountRequired: string;
    maxTimeoutSeconds: number;
}

export interface PaymentResult {
    success: boolean;
    txHash?: string;
    paymentHeader?: string;
    error?: string;
}

/**
 * Execute gasless payment via official Crypto.com Facilitator SDK
 * 
 * @param paymentRequirements - Payment requirements from 402 response
 * @param signer - Ethers signer (from wallet)
 * @param network - Network to use (testnet or mainnet)
 * @returns Payment result with transaction hash and payment header
 */
export async function executeGaslessPayment(
    paymentRequirements: PaymentRequirements,
    signer: ethers.Signer,
    network: 'testnet' | 'mainnet' = 'testnet'
): Promise<PaymentResult> {
    try {
        const config = NETWORK_CONFIG[network];

        // Initialize facilitator client
        const facilitator = new Facilitator({
            network: config.network,
        });

        console.log('Generating payment header with official SDK...');

        // Generate payment header (SDK handles domain version automatically!)
        const header = await facilitator.generatePaymentHeader({
            to: paymentRequirements.payTo,
            value: paymentRequirements.maxAmountRequired,
            signer,
            validBefore: Math.floor(Date.now() / 1000) + 300, // 5 min expiry
        });

        console.log('Payment header generated');

        // Build verify request
        const body = facilitator.buildVerifyRequest(header, paymentRequirements);

        console.log('[EIP-3009] Verifying payment...');

        // Verify payment
        const verifyResponse = await facilitator.verifyPayment(body);

        if (!verifyResponse.isValid) {
            return {
                success: false,
                error: 'Payment verification failed',
            };
        }

        console.log('Payment verified');
        console.log('Settling payment on-chain...');

        // Settle payment
        const settleResponse = await facilitator.settlePayment(body);

        console.log('Payment settled!');
        console.log('Transaction hash:', settleResponse.txHash);

        return {
            success: true,
            txHash: settleResponse.txHash,
            paymentHeader: header,
        };
    } catch (error: any) {
        console.error('Payment execution error:', error);
        return {
            success: false,
            error: error.message || 'Payment execution failed',
        };
    }
}

/**
 * Fetch with automatic x402 payment handling
 * 
 * Automatically detects 402 responses and executes gasless payment
 * 
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @param signer - Ethers signer (from wallet)
 * @param network - Network to use
 * @returns Response after payment (if required)
 */
export async function fetchWithPayment(
    url: string,
    options: RequestInit = {},
    signer: ethers.Signer,
    network: 'testnet' | 'mainnet' = 'testnet'
): Promise<Response> {
    let response = await fetch(url, options);

    // Check for 402 Payment Required
    if (response.status === 402) {
        const data = await response.json();
        const paymentRequirements = data.paymentRequirements;

        if (!paymentRequirements) {
            throw new Error('Invalid 402 response: missing paymentRequirements');
        }

        console.log('Payment required - executing gasless payment...');

        // Execute gasless payment via facilitator
        const paymentResult = await executeGaslessPayment(
            paymentRequirements,
            signer,
            network
        );

        if (!paymentResult.success) {
            throw new Error(`Payment failed: ${paymentResult.error}`);
        }

        console.log('Payment successful - retrying request...');

        // Retry with payment proof
        response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'X-Payment': paymentResult.paymentHeader!,
            },
        });
    }

    return response;
}

/**
 * Check USDC.e balance
 * 
 * @param address - Wallet address
 * @param network - Network to check
 * @returns Balance in USDC (6 decimals)
 */
export async function getUSDCBalance(
    address: string,
    network: 'testnet' | 'mainnet' = 'testnet'
): Promise<string> {
    const config = NETWORK_CONFIG[network];
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    const usdcAbi = [
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)',
    ];

    const usdcContract = new ethers.Contract(config.usdcContract, usdcAbi, provider);

    const balance = await usdcContract.balanceOf(address);
    const decimals = await usdcContract.decimals();

    return ethers.formatUnits(balance, decimals);
}

/**
 * Get facilitator capabilities
 * 
 * @param network - Network to query
 * @returns Supported networks and schemes
 */
export async function getFacilitatorCapabilities(
    network: 'testnet' | 'mainnet' = 'testnet'
) {
    const config = NETWORK_CONFIG[network];
    const facilitator = new Facilitator({
        network: config.network,
    });

    return await facilitator.getSupported();
}
