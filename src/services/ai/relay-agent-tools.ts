/**
 * Relay Core Agent Tools
 * 
 * Purpose-built tools for the Agent Control Console
 * NOT generic crypto chat - these are execution-oriented tools
 * 
 * Tool Categories:
 * 1. QUERY_STATE - Query indexed blockchain/service state
 * 2. EXECUTE_ACTION - Trigger x402 flows and agent actions
 * 3. DISCOVER - Find services/agents in the marketplace
 * 4. EXPLAIN - Explain agent decisions with evidence
 */

import { pythPriceService, type PriceFeedSymbol } from '../prices/pyth-price-service.js';
import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

// Tool definitions for Claude
export const RELAY_AGENT_TOOLS = [
    {
        name: 'get_market_price',
        description: 'Get real-time cryptocurrency price from Pyth Oracle on Cronos. Use this for trade execution context, NOT general price queries.',
        input_schema: {
            type: 'object' as const,
            properties: {
                symbol: {
                    type: 'string' as const,
                    enum: ['BTC/USD', 'ETH/USD', 'CRO/USD', 'USDC/USD'] as const,
                    description: 'Price feed symbol from Pyth Oracle',
                },
            },
            required: ['symbol'] as const,
        },
    },
    {
        name: 'discover_services',
        description: 'Search for AI services in the Relay Core marketplace. Returns services with reputation, pricing, and capabilities.',
        input_schema: {
            type: 'object' as const,
            properties: {
                category: {
                    type: 'string' as const,
                    description: 'Service category (e.g., "trading", "data", "analysis")',
                },
                minReputation: {
                    type: 'number' as const,
                    description: 'Minimum reputation score (0-100)',
                },
            },
        },
    },
    {
        name: 'get_service_status',
        description: 'Get current status and metrics for a specific service. Returns uptime, latency, success rate.',
        input_schema: {
            type: 'object' as const,
            properties: {
                serviceId: {
                    type: 'string' as const,
                    description: 'Service ID or address',
                },
            },
            required: ['serviceId'] as const,
        },
    },
    {
        name: 'get_user_reputation',
        description: 'Get reputation score and history for a wallet address.',
        input_schema: {
            type: 'object' as const,
            properties: {
                address: {
                    type: 'string' as const,
                    description: 'Wallet address',
                },
            },
            required: ['address'] as const,
        },
    },
    {
        name: 'get_recent_transactions',
        description: 'Get recent x402 payment transactions for the connected wallet.',
        input_schema: {
            type: 'object' as const,
            properties: {
                limit: {
                    type: 'number' as const,
                    description: 'Number of transactions to return (max 50)',
                },
            },
        },
    },
] as const;

interface ToolResult {
    result: any;
    executionTimeMs: number;
    dataSource: string;
}

/**
 * Execute Relay Core agent tools
 * SOP 2: Tool-first, LLM-second - Always fetch indexed data first
 */
export async function executeRelayTool(toolName: string, input: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    let result: any;
    let dataSource: string;

    try {
        switch (toolName) {
            case 'get_market_price': {
                // Use Pyth Oracle (already integrated in your system)
                const symbol = input.symbol as PriceFeedSymbol;
                const priceData = await pythPriceService.getPriceWithConfidence(symbol);

                result = {
                    symbol,
                    price: priceData.price,
                    confidence: priceData.confidence,
                    publishTime: new Date(priceData.publishTime * 1000).toISOString(),
                    source: 'Pyth Oracle on Cronos',
                };
                dataSource = 'pyth_oracle';
                break;
            }

            case 'discover_services': {
                // Query Supabase services table (your indexed data)
                let query = supabase
                    .from('services')
                    .select('*')
                    .eq('status', 'active');

                if (input.category) {
                    query = query.ilike('category', `%${input.category}%`);
                }

                if (input.minReputation) {
                    query = query.gte('reputation_score', input.minReputation);
                }

                const { data, error } = await query.limit(10);

                if (error) throw error;

                result = {
                    services: data?.map(s => ({
                        id: s.id,
                        name: s.name,
                        category: s.category,
                        reputation: s.reputation_score,
                        pricePerCall: s.price_per_call,
                        endpoint: s.endpoint_url,
                    })) || [],
                    count: data?.length || 0,
                };
                dataSource = 'supabase_services';
                break;
            }

            case 'get_service_status': {
                // Query service metrics from your indexer
                const { data, error } = await supabase
                    .from('services')
                    .select('*, service_metrics(*)')
                    .eq('id', input.serviceId)
                    .single();

                if (error) throw error;

                result = {
                    serviceId: data.id,
                    name: data.name,
                    status: data.status,
                    reputation: data.reputation_score,
                    totalCalls: data.service_metrics?.[0]?.total_calls || 0,
                    successRate: data.service_metrics?.[0]?.success_rate || 0,
                    avgLatency: data.service_metrics?.[0]?.avg_latency_ms || 0,
                };
                dataSource = 'supabase_metrics';
                break;
            }

            case 'get_user_reputation': {
                // Query reputation from your system
                const { data, error } = await supabase
                    .from('user_reputation')
                    .select('*')
                    .eq('wallet_address', input.address.toLowerCase())
                    .single();

                if (error && error.code !== 'PGRST116') throw error;

                result = {
                    address: input.address,
                    reputationScore: data?.reputation_score || 0,
                    totalTransactions: data?.total_transactions || 0,
                    successfulTransactions: data?.successful_transactions || 0,
                    lastActivity: data?.last_activity || null,
                };
                dataSource = 'supabase_reputation';
                break;
            }

            case 'get_recent_transactions': {
                // Query x402 transactions from indexer
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(input.limit || 10);

                if (error) throw error;

                result = {
                    transactions: data?.map(tx => ({
                        id: tx.id,
                        type: tx.transaction_type,
                        amount: tx.amount,
                        status: tx.status,
                        timestamp: tx.created_at,
                        service: tx.service_name,
                    })) || [],
                    count: data?.length || 0,
                };
                dataSource = 'supabase_transactions';
                break;
            }

            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }

        const executionTimeMs = Date.now() - startTime;

        logger.info(`Tool executed: ${toolName}`, {
            executionTimeMs,
            dataSource,
            success: true,
        });

        return { result, executionTimeMs, dataSource };

    } catch (error) {
        logger.error(`Tool execution failed: ${toolName}`, error as Error);
        throw error;
    }
}

export default {
    RELAY_AGENT_TOOLS,
    executeRelayTool,
};
