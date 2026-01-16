/**
 * Intent Classification System
 * SOP 1: Strict Intent Classification (non-negotiable)
 * 
 * Routes requests to appropriate handlers BEFORE touching the LLM
 */

import { executeRelayTool } from './relay-agent-tools.js';
import { logger } from '../../lib/logger.js';

export enum IntentType {
    QUERY_STATE = 'QUERY_STATE',           // Fast path - no LLM needed
    EXECUTE_ACTION = 'EXECUTE_ACTION',     // Requires confirmation
    PLAN_ACTION = 'PLAN_ACTION',           // Needs LLM reasoning
    EXPLAIN_ACTION = 'EXPLAIN_ACTION',     // Needs LLM + data
    DISCOVER = 'DISCOVER',                 // Fast path with optional LLM
}

interface ClassifiedIntent {
    type: IntentType;
    confidence: number;
    tool?: string;
    params?: Record<string, any>;
    requiresLLM: boolean;
}

/**
 * Classify user intent (< 50ms target)
 * SOP 1: Hard-coded patterns, no LLM
 */
export function classifyIntent(message: string): ClassifiedIntent {
    const msg = message.toLowerCase().trim();

    // QUERY_STATE - Price queries (FAST PATH)
    if (msg.match(/\b(price|cost|worth|value)\b.*\b(btc|bitcoin|eth|ethereum|cro|cronos)\b/i) ||
        msg.match(/\b(btc|bitcoin|eth|ethereum|cro|cronos)\b.*\b(price|cost)\b/i)) {

        const symbolMatch = msg.match(/\b(btc|bitcoin|eth|ethereum|cro|cronos|usdc)\b/i);
        const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : 'BTC';

        // Map to Pyth symbols
        const symbolMap: Record<string, string> = {
            'BTC': 'BTC/USD',
            'BITCOIN': 'BTC/USD',
            'ETH': 'ETH/USD',
            'ETHEREUM': 'ETH/USD',
            'CRO': 'CRO/USD',
            'CRONOS': 'CRO/USD',
            'USDC': 'USDC/USD',
        };

        return {
            type: IntentType.QUERY_STATE,
            confidence: 0.95,
            tool: 'get_market_price',
            params: { symbol: symbolMap[symbol] || 'BTC/USD' },
            requiresLLM: false, // FAST PATH - no LLM needed!
        };
    }

    // QUERY_STATE - Service discovery (FAST PATH)
    if (msg.match(/\b(find|search|show|list|discover)\b.*\b(service|agent)\b/i) ||
        msg.match(/\b(what|which)\b.*\b(service|agent)\b/i)) {

        return {
            type: IntentType.DISCOVER,
            confidence: 0.9,
            tool: 'discover_services',
            params: {},
            requiresLLM: false, // Can format without LLM
        };
    }

    // QUERY_STATE - Transaction history (FAST PATH)
    if (msg.match(/\b(show|get|list)\b.*\b(transaction|payment|history)\b/i) ||
        msg.match(/\b(recent|last|latest)\b.*\b(transaction|payment)\b/i)) {

        return {
            type: IntentType.QUERY_STATE,
            confidence: 0.9,
            tool: 'get_recent_transactions',
            params: { limit: 10 },
            requiresLLM: false,
        };
    }

    // QUERY_STATE - Reputation (FAST PATH)
    if (msg.match(/\b(my|check)\b.*\b(reputation|score|rating)\b/i)) {
        return {
            type: IntentType.QUERY_STATE,
            confidence: 0.85,
            tool: 'get_user_reputation',
            params: {}, // Will be filled with wallet address
            requiresLLM: false,
        };
    }

    // EXECUTE_ACTION - Trade/payment actions (needs confirmation)
    if (msg.match(/\b(buy|sell|trade|swap|execute|open|close)\b/i)) {
        return {
            type: IntentType.EXECUTE_ACTION,
            confidence: 0.8,
            requiresLLM: true, // Needs LLM for safety check
        };
    }

    // PLAN_ACTION - Strategy/planning
    if (msg.match(/\b(how|what|should|best|recommend)\b.*\b(strategy|approach|way)\b/i)) {
        return {
            type: IntentType.PLAN_ACTION,
            confidence: 0.7,
            requiresLLM: true,
        };
    }

    // EXPLAIN_ACTION - Why/explain queries
    if (msg.match(/\b(why|explain|reason|how come)\b/i)) {
        return {
            type: IntentType.EXPLAIN_ACTION,
            confidence: 0.75,
            requiresLLM: true,
        };
    }

    // Default: needs LLM
    return {
        type: IntentType.QUERY_STATE,
        confidence: 0.5,
        requiresLLM: true,
    };
}

/**
 * Fast-path execution (< 300ms target)
 * SOP 4: Response latency discipline
 */
export async function executeFastPath(
    intent: ClassifiedIntent,
    context: { walletAddress?: string }
): Promise<string> {
    const startTime = Date.now();

    try {
        if (!intent.tool) {
            throw new Error('No tool specified for fast path');
        }

        // Fill in context params
        const params = { ...intent.params };
        if (intent.tool === 'get_user_reputation' && context.walletAddress) {
            params.address = context.walletAddress;
        }

        // Execute tool directly (no LLM)
        const { result, executionTimeMs, dataSource } = await executeRelayTool(
            intent.tool,
            params
        );

        // Format response (simple, no LLM)
        const response = formatFastPathResponse(intent.tool, result);

        const totalTime = Date.now() - startTime;
        logger.info('Fast path executed', {
            tool: intent.tool,
            executionTimeMs,
            totalTimeMs: totalTime,
            dataSource,
        });

        return response;

    } catch (error) {
        logger.error('Fast path execution failed', error as Error);
        throw error;
    }
}

/**
 * Format fast-path responses (no LLM, < 10ms)
 */
function formatFastPathResponse(tool: string, result: any): string {
    switch (tool) {
        case 'get_market_price':
            return `Current ${result.symbol} price: $${result.price.toLocaleString()}

Source: ${result.source}
Confidence: ${result.confidence.toFixed(2)}
Last updated: ${result.publishTime}`;

        case 'discover_services':
            if (result.count === 0) {
                return 'No services found matching your criteria.';
            }
            return `Found ${result.count} services:

${result.services.map((s: any, i: number) =>
                `${i + 1}. ${s.name} (${s.category})
   Reputation: ${s.reputation}/100
   Price: ${s.pricePerCall} USDC per call`
            ).join('\n\n')}`;

        case 'get_recent_transactions':
            if (result.count === 0) {
                return 'No recent transactions found.';
            }
            return `Recent transactions (${result.count}):

${result.transactions.map((tx: any, i: number) =>
                `${i + 1}. ${tx.type} - ${tx.amount} USDC
   Status: ${tx.status}
   Service: ${tx.service || 'N/A'}
   Time: ${new Date(tx.timestamp).toLocaleString()}`
            ).join('\n\n')}`;

        case 'get_user_reputation':
            return `Your reputation score: ${result.reputationScore}/100

Total transactions: ${result.totalTransactions}
Successful: ${result.successfulTransactions}
Success rate: ${result.totalTransactions > 0
                    ? ((result.successfulTransactions / result.totalTransactions) * 100).toFixed(1)
                    : 0}%
Last activity: ${result.lastActivity || 'Never'}`;

        default:
            return JSON.stringify(result, null, 2);
    }
}

export default {
    classifyIntent,
    executeFastPath,
};
