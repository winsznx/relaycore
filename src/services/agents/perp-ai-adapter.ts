/**
 * PerpAI Agent Adapter
 * 
 * Registers the internal PerpAI trading system as a first-class agent
 * in the Relay Core agent registry. This enables:
 * 
 * - API invocation via /api/agents/relaycore.perp-ai/invoke
 * - Workflow composition with other agents
 * - Marketplace discovery
 * - Metrics tracking and reputation scoring
 * 
 * The adapter is a thin wrapper - it uses the existing TradeRouter
 * for all trading logic, ensuring no code duplication.
 */

import { agentRegistry } from './registry';
import { tradeRouter } from '../perpai/trade-router';
import type { TradeQuoteRequest, TradeExecuteRequest } from '../../types/api';
import logger from '../../lib/logger';

// ============================================
// PERP AI QUOTE AGENT
// ============================================

/**
 * Agent for getting trade quotes
 * This is a read-only operation but requires x402 payment
 */
export const perpAIQuoteAgent = agentRegistry.register(
    {
        id: 'relaycore.perp-ai-quote',
        owner: process.env.PAYMENT_RECIPIENT_ADDRESS || '0x0000000000000000000000000000000000000000',
        name: 'PerpAI Quote',
        description: 'Get AI-optimized perpetual trading quotes with multi-venue aggregation. Analyzes price sources, venue reputation, and liquidity to find the best execution.',

        agent_type: 'research',
        interaction_modes: ['api', 'workflow', 'chat'],

        input_schema: {
            type: 'object',
            properties: {
                pair: {
                    type: 'string',
                    description: 'Trading pair',
                    enum: ['BTC-USD', 'ETH-USD', 'CRO-USD'],
                },
                side: {
                    type: 'string',
                    description: 'Trade direction',
                    enum: ['long', 'short'],
                },
                leverage: {
                    type: 'number',
                    description: 'Leverage multiplier',
                    minimum: 1,
                    maximum: 50,
                },
                sizeUsd: {
                    type: 'number',
                    description: 'Position size in USD',
                    minimum: 100,
                },
            },
            required: ['pair', 'side', 'leverage', 'sizeUsd'],
        },

        output_schema: {
            type: 'object',
            properties: {
                bestVenue: { type: 'object' },
                expectedPrice: { type: 'number' },
                expectedSlippage: { type: 'number' },
                liquidationPrice: { type: 'number' },
                totalFees: { type: 'number' },
            },
        },

        permissions: {
            can_execute: false,
            requires_payment: true,
            payment_amount: '10000', // 0.01 USDC
        },

        metadata: {
            version: '1.0.0',
            latency_class: 'low',
            categories: ['trading', 'defi', 'perpetuals'],
            tags: ['quote', 'price', 'leverage', 'perps'],
            docs_url: 'https://docs.relaycore.xyz/agents/perp-ai-quote',
        },
    },
    async (input) => {
        const request: TradeQuoteRequest = {
            pair: input.pair as string,
            side: input.side as 'long' | 'short',
            leverage: input.leverage as number,
            sizeUsd: input.sizeUsd as number,
        };

        logger.info('PerpAI Quote Agent invoked', {
            pair: request.pair,
            side: request.side,
            leverage: request.leverage,
            sizeUsd: request.sizeUsd,
        });

        const quote = await tradeRouter.getQuote(request);

        return {
            bestVenue: quote.bestVenue,
            expectedPrice: quote.expectedPrice,
            expectedSlippage: quote.expectedSlippage,
            priceImpact: quote.priceImpact,
            liquidationPrice: quote.liquidationPrice,
            totalFees: quote.totalFees,
            estimatedExecutionTime: quote.estimatedExecutionTime,
            priceSource: quote.priceSource,
            priceSources: quote.priceSources,
        };
    }
);

// ============================================
// PERP AI TRADE AGENT
// ============================================

/**
 * Agent for executing trades
 * This is a write operation that executes real trades
 */
export const perpAITradeAgent = agentRegistry.register(
    {
        id: 'relaycore.perp-ai-trade',
        owner: process.env.PAYMENT_RECIPIENT_ADDRESS || '0x0000000000000000000000000000000000000000',
        name: 'PerpAI Trade',
        description: 'Execute AI-optimized perpetual trades with best venue routing. Automatically selects the optimal venue based on price, reputation, and liquidity.',

        agent_type: 'execution',
        interaction_modes: ['api', 'workflow', 'ui'],

        input_schema: {
            type: 'object',
            properties: {
                pair: {
                    type: 'string',
                    description: 'Trading pair',
                    enum: ['BTC-USD', 'ETH-USD', 'CRO-USD'],
                },
                side: {
                    type: 'string',
                    description: 'Trade direction',
                    enum: ['long', 'short'],
                },
                leverage: {
                    type: 'number',
                    description: 'Leverage multiplier',
                    minimum: 1,
                    maximum: 50,
                },
                sizeUsd: {
                    type: 'number',
                    description: 'Position size in USD',
                    minimum: 100,
                },
                userAddress: {
                    type: 'string',
                    description: 'User wallet address for the trade',
                },
                maxSlippage: {
                    type: 'number',
                    description: 'Maximum acceptable slippage percentage',
                    minimum: 0,
                    maximum: 5,
                },
                stopLoss: {
                    type: 'number',
                    description: 'Stop loss price',
                },
                takeProfit: {
                    type: 'number',
                    description: 'Take profit price',
                },
            },
            required: ['pair', 'side', 'leverage', 'sizeUsd', 'userAddress'],
        },

        output_schema: {
            type: 'object',
            properties: {
                tradeId: { type: 'string' },
                txHash: { type: 'string' },
                venue: { type: 'string' },
                entryPrice: { type: 'number' },
                liquidationPrice: { type: 'number' },
                actualSlippage: { type: 'number' },
                executionTime: { type: 'number' },
                status: { type: 'string' },
            },
        },

        permissions: {
            can_execute: true,
            requires_payment: true,
            payment_amount: '50000', // 0.05 USDC for execution
            auth_level: 'wallet',
        },

        metadata: {
            version: '1.0.0',
            latency_class: 'medium',
            categories: ['trading', 'defi', 'perpetuals', 'execution'],
            tags: ['trade', 'execute', 'leverage', 'perps', 'dex'],
            docs_url: 'https://docs.relaycore.xyz/agents/perp-ai-trade',
        },
    },
    async (input) => {
        const request: TradeExecuteRequest = {
            pair: input.pair as string,
            side: input.side as 'long' | 'short',
            leverage: input.leverage as number,
            sizeUsd: input.sizeUsd as number,
            userAddress: input.userAddress as string,
            maxSlippage: input.maxSlippage as number | undefined,
            stopLoss: input.stopLoss as number | undefined,
            takeProfit: input.takeProfit as number | undefined,
        };

        logger.info('PerpAI Trade Agent invoked', {
            pair: request.pair,
            side: request.side,
            leverage: request.leverage,
            sizeUsd: request.sizeUsd,
            userAddress: request.userAddress,
        });

        const result = await tradeRouter.executeTrade(request);

        return {
            tradeId: result.tradeId,
            txHash: result.txHash,
            venue: result.venue,
            entryPrice: result.entryPrice,
            liquidationPrice: result.liquidationPrice,
            actualSlippage: result.actualSlippage,
            executionTime: result.executionTime,
            status: result.status,
        };
    }
);

// ============================================
// PERP AI VENUES AGENT
// ============================================

/**
 * Agent for getting venue rankings
 * Read-only, no payment required
 */
export const perpAIVenuesAgent = agentRegistry.register(
    {
        id: 'relaycore.perp-ai-venues',
        owner: process.env.PAYMENT_RECIPIENT_ADDRESS || '0x0000000000000000000000000000000000000000',
        name: 'PerpAI Venues',
        description: 'Get ranked list of perpetual trading venues with reputation scores, success rates, and liquidity metrics.',

        agent_type: 'research',
        interaction_modes: ['api', 'workflow', 'chat'],

        input_schema: {
            type: 'object',
            properties: {
                sortBy: {
                    type: 'string',
                    description: 'Sort criteria',
                    enum: ['reputation', 'volume', 'latency', 'fees'],
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of venues to return',
                    minimum: 1,
                    maximum: 50,
                },
            },
        },

        output_schema: {
            type: 'object',
            properties: {
                venues: { type: 'array' },
                timestamp: { type: 'string' },
            },
        },

        permissions: {
            can_execute: false,
            requires_payment: false,
        },

        metadata: {
            version: '1.0.0',
            latency_class: 'low',
            categories: ['trading', 'defi', 'research'],
            tags: ['venues', 'dex', 'rankings', 'reputation'],
            docs_url: 'https://docs.relaycore.xyz/agents/perp-ai-venues',
        },
    },
    async (input) => {
        const { sortBy = 'reputation', limit = 10 } = input as {
            sortBy?: string;
            limit?: number;
        };

        logger.info('PerpAI Venues Agent invoked', { sortBy, limit });

        const venues = await tradeRouter.getVenues(sortBy, limit);

        return {
            venues,
            timestamp: new Date().toISOString(),
        };
    }
);

// ============================================
// INITIALIZATION LOG
// ============================================

logger.info('PerpAI agents registered', {
    agents: [
        'relaycore.perp-ai-quote',
        'relaycore.perp-ai-trade',
        'relaycore.perp-ai-venues',
    ],
});

export const PERP_AI_AGENTS = {
    quote: perpAIQuoteAgent,
    trade: perpAITradeAgent,
    venues: perpAIVenuesAgent,
};
