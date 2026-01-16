/**
 * x402 Payment Middleware (DEPRECATED)
 * 
 * @deprecated This middleware is deprecated. Use `requirePayment` from 
 * `services/x402/payment-middleware.ts` instead.
 * 
 * This implementation does not support entitlement caching and will not
 * remember payments after they are made. The new `requirePayment` middleware
 * properly integrates with the Facilitator SDK and includes entitlement caching.
 * 
 * Implements HTTP 402 Payment Required for paid API endpoints
 * Integrates with Cronos x402 Facilitator for payment verification
 */

import type { Request, Response, NextFunction } from 'express';

const FACILITATOR_URL = 'https://facilitator.cronoslabs.org/v2/x402';

// Network configuration from official Cronos docs
const NETWORK_CONFIG = {
    testnet: {
        network: 'cronos-testnet',
        chainId: 338,
        usdcContract: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0', // devUSDC.e
    },
    mainnet: {
        network: 'cronos-mainnet',
        chainId: 25,
        usdcContract: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C', // USDC.e
    },
};

export interface PaymentRequirements {
    x402Version: number;
    paymentRequirements: {
        scheme: 'exact';
        network: string;
        payTo: string;
        asset: string;
        maxAmountRequired: string;
        maxTimeoutSeconds: number;
    };
}

/**
 * x402 Payment Middleware
 * 
 * Returns 402 Payment Required if no valid payment header is present
 * Verifies payment via Cronos x402 Facilitator if payment header exists
 */
export function x402PaymentMiddleware(
    priceInUsdc: string,
    network: 'testnet' | 'mainnet' = 'testnet'
) {
    console.warn(' DEPRECATED: x402PaymentMiddleware is deprecated. Use requirePayment from services/x402/payment-middleware.ts instead.');
    const config = NETWORK_CONFIG[network];

    return async (req: Request, res: Response, next: NextFunction) => {
        const paymentHeader = req.headers['x-payment'] as string | undefined;

        if (!paymentHeader) {
            // No payment provided - return 402 with requirements
            const paymentRequirements: PaymentRequirements = {
                x402Version: 1,
                paymentRequirements: {
                    scheme: 'exact',
                    network: config.network,
                    payTo: process.env.PAYMENT_RECIPIENT_ADDRESS || '',
                    asset: config.usdcContract,
                    maxAmountRequired: (parseFloat(priceInUsdc) * 1_000_000).toString(), // 6 decimals
                    maxTimeoutSeconds: 300,
                },
            };

            return res.status(402).json(paymentRequirements);
        }

        // Verify payment via facilitator
        try {
            const verifyResponse = await fetch(`${FACILITATOR_URL}/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X402-Version': '1',
                },
                body: JSON.stringify({
                    x402Version: 1,
                    paymentHeader,
                    paymentRequirements: {
                        scheme: 'exact',
                        network: config.network,
                        payTo: process.env.PAYMENT_RECIPIENT_ADDRESS,
                        asset: config.usdcContract,
                        maxAmountRequired: (parseFloat(priceInUsdc) * 1_000_000).toString(),
                        maxTimeoutSeconds: 300,
                    },
                }),
            });

            const verification = await verifyResponse.json();

            if (!verification.isValid) {
                return res.status(402).json({
                    error: 'Payment verification failed',
                    reason: verification.invalidReason,
                    paymentRequirements: {
                        scheme: 'exact',
                        network: config.network,
                        payTo: process.env.PAYMENT_RECIPIENT_ADDRESS,
                        asset: config.usdcContract,
                        maxAmountRequired: (parseFloat(priceInUsdc) * 1_000_000).toString(),
                        maxTimeoutSeconds: 300,
                    },
                });
            }

            // Payment verified - attach to request and proceed
            (req as any).paymentVerified = true;
            (req as any).paymentAmount = priceInUsdc;
            next();
        } catch (error: any) {
            console.error('Payment verification error:', error);
            return res.status(402).json({
                error: 'Payment verification error',
                message: error.message || 'Failed to verify payment',
            });
        }
    };
}

/**
 * Helper to check if request has verified payment
 */
export function hasVerifiedPayment(req: Request): boolean {
    return (req as any).paymentVerified === true;
}

/**
 * Get payment amount from verified request
 */
export function getPaymentAmount(req: Request): string | null {
    return (req as any).paymentAmount || null;
}
