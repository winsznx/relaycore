/**
 * X402 Types - Based on Cronos x402-examples reference implementation
 * 
 * These types match the official Cronos x402 protocol specification.
 */

import type { CronosNetwork, PaymentRequirements, X402OutputSchema } from '@crypto.com/facilitator-client';

/**
 * Accepted payment scheme for x402 challenges.
 * Base-compatible format for x402scan and Base-schema consumers.
 */
export interface X402Accepts {
    /** Payment scheme type - always 'exact' for Cronos x402 */
    scheme: 'exact';
    /** Target Cronos network for settlement */
    network: CronosNetwork;
    /** Maximum amount required in base units (e.g., 1000000 = 1 USDC) */
    maxAmountRequired: string;
    /** Canonical resource identifier being protected */
    resource: string;
    /** Human-readable description of the protected resource */
    description: string;
    /** MIME type of the protected resource response */
    mimeType: string;
    /** Destination address that receives the payment */
    payTo: string;
    /** Maximum time in seconds to fulfill payment */
    maxTimeoutSeconds: number;
    /** Asset contract address for payment */
    asset: string;
    /** Optional schema describing successful output */
    outputSchema?: X402OutputSchema;
    /** Extra implementation-specific metadata */
    extra?: {
        paymentId?: string;
        [key: string]: unknown;
    };
}

/**
 * Standard x402 402-response body.
 * Returned when a client must complete an x402 payment challenge.
 */
export interface X402Response {
    /** X402 protocol version */
    x402Version: number;
    /** Optional error message */
    error?: string;
    /** List of accepted payment options */
    accepts?: X402Accepts[];
    /** Optional payer identifier */
    payer?: string;
}

/**
 * Parameters required to settle an x402 payment.
 */
export interface X402PayParams {
    /** Unique identifier for the payment attempt */
    paymentId: string;
    /** Encoded payment header from client */
    paymentHeader: string;
    /** Payment requirements from prior 402 challenge */
    paymentRequirements: PaymentRequirements;
}

/**
 * Stored record for settled payments.
 */
export interface X402PaidRecord {
    /** Whether settlement succeeded */
    settled: boolean;
    /** Settlement transaction hash */
    txHash?: string;
    /** Unix timestamp when recorded */
    at: number;
    /** Payer address */
    payer?: string;
}

/**
 * Result of a payment settlement attempt.
 */
export type X402PayResult =
    | { ok: true; txHash?: string }
    | { ok: false; error: 'verify_failed'; details: unknown }
    | { ok: false; error: 'settle_failed'; details: unknown };

/**
 * Options for configuring x402 protection middleware.
 */
export interface X402ProtectionOptions {
    /** Cronos network for verification */
    network: CronosNetwork;
    /** Destination address for payment */
    payTo: string;
    /** Asset contract address */
    asset: string;
    /** Maximum amount required in base units */
    maxAmountRequired: string;
    /** Maximum timeout in seconds */
    maxTimeoutSeconds?: number;
    /** Description of protected resource */
    description: string;
    /** MIME type of response */
    mimeType?: string;
    /** Resource identifier */
    resource: string;
    /** Output schema */
    outputSchema?: X402OutputSchema;
    /** Custom entitlement key extractor */
    getEntitlementKey?: (req: unknown) => string | undefined;
}
