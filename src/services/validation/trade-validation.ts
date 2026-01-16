/**
 * Validation Service for High-Value Trades
 * 
 * Automatically requests independent validation for trades above threshold
 * Integrates with ERC-8004 Validation Registry
 */

import { requestTradeValidation } from '../../lib/erc8004-client';
import { ethers } from 'ethers';
import logger from '../../lib/logger';

const HIGH_VALUE_THRESHOLD = 10000; // $10,000 USD
const VALIDATOR_ADDRESS = process.env.VALIDATOR_ADDRESS || '0x0000000000000000000000000000000000000000';

export interface TradeValidationRequest {
    tradeId: string;
    pair: string;
    side: string;
    sizeUsd: number;
    leverage: number;
    venue: string;
    expectedPrice: number;
    actualPrice: number;
    slippage: number;
    executionTime: number;
}

/**
 * Check if trade requires validation
 */
export function requiresValidation(sizeUsd: number): boolean {
    return sizeUsd >= HIGH_VALUE_THRESHOLD;
}

/**
 * Request validation for high-value trade
 */
export async function requestValidationForTrade(
    trade: TradeValidationRequest,
    signer?: ethers.Signer
): Promise<{ requested: boolean; requestHash?: string; error?: string }> {
    try {
        // Check if validation is required
        if (!requiresValidation(trade.sizeUsd)) {
            return { requested: false };
        }

        // Check if validation registry is configured
        if (!process.env.VALIDATION_REGISTRY_ADDRESS || !process.env.RELAY_CORE_AGENT_ID) {
            logger.warn('Validation registry not configured, skipping validation request');
            return { requested: false };
        }

        // Check if validator is configured
        if (!VALIDATOR_ADDRESS || VALIDATOR_ADDRESS === '0x0000000000000000000000000000000000000000') {
            logger.warn('Validator address not configured, skipping validation request');
            return { requested: false };
        }

        // If no signer provided, log and skip on-chain request
        if (!signer) {
            logger.info('High-value trade detected, validation recommended', {
                tradeId: trade.tradeId,
                sizeUsd: trade.sizeUsd,
                threshold: HIGH_VALUE_THRESHOLD,
            });
            return { requested: false };
        }

        // Prepare validation request data
        const requestData = {
            tradeId: trade.tradeId,
            pair: trade.pair,
            side: trade.side,
            sizeUsd: trade.sizeUsd,
            leverage: trade.leverage,
            venue: trade.venue,
            expectedPrice: trade.expectedPrice,
            actualPrice: trade.actualPrice,
            slippage: trade.slippage,
            executionTime: trade.executionTime,
            timestamp: Date.now(),
        };

        // Submit validation request to ValidationRegistry
        const requestHash = await requestTradeValidation(
            {
                validatorAddress: VALIDATOR_ADDRESS,
                agentId: parseInt(process.env.RELAY_CORE_AGENT_ID!),
                requestData,
            },
            signer
        );

        logger.info('Validation requested for high-value trade', {
            tradeId: trade.tradeId,
            sizeUsd: trade.sizeUsd,
            requestHash,
            validator: VALIDATOR_ADDRESS,
        });

        return { requested: true, requestHash };
    } catch (error: any) {
        logger.error('Failed to request validation', error, {
            tradeId: trade.tradeId,
            sizeUsd: trade.sizeUsd,
        });
        return { requested: false, error: error.message };
    }
}

/**
 * Get validation status for a trade
 */
export async function getValidationStatus(
    requestHash: string
): Promise<{
    completed: boolean;
    response?: number;
    validator?: string;
    error?: string;
}> {
    try {
        if (!process.env.VALIDATION_REGISTRY_ADDRESS) {
            return { completed: false, error: 'Validation registry not configured' };
        }

        const provider = new ethers.JsonRpcProvider(
            process.env.CRONOS_ZKEVM_RPC || 'https://testnet-zkevm.cronos.org'
        );

        const validationRegistry = new ethers.Contract(
            process.env.VALIDATION_REGISTRY_ADDRESS,
            [
                'function getValidation(bytes32 requestHash) view returns (address, uint256, uint8, string, string, bytes32, uint256, bool)',
            ],
            provider
        );

        const validation = await validationRegistry.getValidation(requestHash);
        const [validator, , response, , , , , completed] = validation;

        return {
            completed,
            response: completed ? Number(response) : undefined,
            validator,
        };
    } catch (error: any) {
        logger.error('Failed to get validation status', error, { requestHash });
        return { completed: false, error: error.message };
    }
}
