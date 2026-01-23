/**
 * X402 Payment Middleware - Cronos Standard Implementation
 * 
 * Based on x402-examples reference from Cronos Labs.
 * Provides middleware for protecting routes with x402 payment requirements.
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Facilitator, VerifyRequest } from '@crypto.com/facilitator-client';
import type {
    X402Accepts,
    X402Response,
    X402PaidRecord,
    X402PayResult,
    X402ProtectionOptions,
} from '../types/x402.types';

/**
 * In-memory entitlement store keyed by payment ID.
 * 
 * @remarks
 * For production, replace with persistent storage (Redis, Supabase, etc.)
 */
const paidEntitlements = new Map<string, X402PaidRecord>();

/**
 * Generates a unique payment identifier per Cronos standard.
 * @returns Payment ID in format `pay_<uuid>`
 */
export const generatePaymentId = (): string => `pay_${crypto.randomUUID()}`;

/**
 * Check if a payment ID has been settled.
 */
export function isEntitled(paymentId: string): boolean {
    return paidEntitlements.get(paymentId)?.settled === true;
}

/**
 * Get entitlement record for a payment ID.
 */
export function getEntitlement(paymentId: string): X402PaidRecord | undefined {
    return paidEntitlements.get(paymentId);
}

/**
 * Store an entitlement record after successful payment.
 */
export function recordEntitlement(paymentId: string, record: X402PaidRecord): void {
    paidEntitlements.set(paymentId, record);
}

/**
 * Creates Express middleware that enforces x402 payment.
 * 
 * If the request is already entitled (has valid x-payment-id), calls next().
 * Otherwise, responds with HTTP 402 and x402 challenge.
 * 
 * @example
 * ```ts
 * router.get('/protected', requireX402({
 *   network: 'cronos-testnet',
 *   payTo: '0x...',
 *   asset: '0x...',
 *   maxAmountRequired: '1000000',
 *   description: 'Access to premium data',
 *   resource: '/api/protected',
 * }), handler);
 * ```
 */
export function requireX402(options: X402ProtectionOptions) {
    const {
        network,
        payTo,
        asset,
        maxAmountRequired,
        maxTimeoutSeconds = 300,
        description,
        mimeType = 'application/json',
        resource,
        outputSchema,
        getEntitlementKey,
    } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
        // Check for existing entitlement
        const entitlementKey = (
            getEntitlementKey?.(req) ??
            req.header('x-payment-id') ??
            ''
        ).trim();

        if (entitlementKey && isEntitled(entitlementKey)) {
            next();
            return;
        }

        // Generate new payment ID for challenge
        const paymentId = generatePaymentId();

        const accepts: X402Accepts = {
            scheme: 'exact',
            network,
            asset,
            payTo,
            maxAmountRequired,
            maxTimeoutSeconds,
            description,
            mimeType,
            resource,
            outputSchema,
            extra: { paymentId },
        };

        const response: X402Response = {
            x402Version: 1,
            error: 'payment_required',
            accepts: [accepts],
        };

        res.status(402).json(response);
    };
}

/**
 * Verifies and settles an x402 payment using the Facilitator SDK.
 * Records entitlement on success.
 * 
 * @example
 * ```ts
 * const result = await handleX402Settlement({
 *   facilitator,
 *   paymentId: 'pay_...',
 *   paymentHeader: '...',
 *   paymentRequirements: {...},
 * });
 * ```
 */
export async function handleX402Settlement(params: {
    facilitator: Facilitator;
    paymentId: string;
    paymentHeader: string;
    paymentRequirements: VerifyRequest['paymentRequirements'];
}): Promise<X402PayResult> {
    const { facilitator, paymentId, paymentHeader, paymentRequirements } = params;

    const body: VerifyRequest = {
        x402Version: 1,
        paymentHeader,
        paymentRequirements,
    };

    // Step 1: Verify
    const verify = await facilitator.verifyPayment(body);
    if (!verify.isValid) {
        return {
            ok: false,
            error: 'verify_failed',
            details: verify,
        };
    }

    // Step 2: Settle
    const settle = await facilitator.settlePayment(body);
    if (settle.event !== 'payment.settled') {
        return {
            ok: false,
            error: 'settle_failed',
            details: settle,
        };
    }

    // Step 3: Record entitlement
    recordEntitlement(paymentId, {
        settled: true,
        txHash: settle.txHash,
        at: Date.now(),
    });

    return {
        ok: true,
        txHash: settle.txHash,
    };
}

/**
 * Helper to create payment requirements for a resource.
 */
export function createPaymentRequirements(options: {
    network: string;
    payTo: string;
    asset: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
}): X402Accepts {
    return {
        scheme: 'exact',
        network: options.network as X402Accepts['network'],
        payTo: options.payTo,
        asset: options.asset,
        maxAmountRequired: options.maxAmountRequired,
        maxTimeoutSeconds: 300,
        description: options.description,
        mimeType: 'application/json',
        resource: options.resource,
        extra: { paymentId: generatePaymentId() },
    };
}

export default {
    requireX402,
    handleX402Settlement,
    generatePaymentId,
    isEntitled,
    getEntitlement,
    recordEntitlement,
    createPaymentRequirements,
};
