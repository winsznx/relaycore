/**
 * Claude AI Agent Service - Production Implementation
 * 
 * Real integrations with:
 * - Anthropic Claude API for AI reasoning
 * - Price aggregator for real-time crypto prices
 * - Trade router for venue recommendations and quotes
 * - Service discovery for agent capabilities
 * - x402 payment system for trade execution
 */

import Anthropic from '@anthropic-ai/sdk';
import { tradeRouter as tradeRouterInstance } from '../perpai/trade-router.js';
import { multiDexAggregator } from '../prices/price-aggregator.js';
import { supabase } from '../../lib/supabase.js';
import logger from '../../lib/logger.js';
import type { PriceFeedSymbol } from '../prices/pyth-price-service.js';

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Types
export interface AgentContext {
    walletAddress?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    sessionId?: string;
}

export interface ToolCall {
    name: string;
    input: Record<string, unknown>;
    result?: unknown;
    executionTimeMs?: number;
}

export interface ChatResponse {
    message: string;
    toolCalls?: ToolCall[];
    sessionId: string;
    processingTimeMs: number;
}

// Tool definitions for Claude
const TOOLS: Anthropic.Tool[] = [
    {
        name: 'get_crypto_price',
        description: 'Get real-time cryptocurrency price from multiple DEX sources including Pyth Oracle, VVS Finance, Moonlander, and MM Finance. Returns the best price across all sources.',
        input_schema: {
            type: 'object' as const,
            properties: {
                symbol: {
                    type: 'string',
                    description: 'Cryptocurrency symbol in format like "BTC/USD", "ETH/USD", "CRO/USD"',
                },
            },
            required: ['symbol'],
        },
    },
    {
        name: 'get_trade_quote',
        description: 'Get a quote for a perpetual trade. Queries all venues (Moonlander, GMX, Fulcrom) and returns the best execution based on fees, liquidity, and reputation.',
        input_schema: {
            type: 'object' as const,
            properties: {
                pair: {
                    type: 'string',
                    description: 'Trading pair like "BTC-USD", "ETH-USD"',
                },
                side: {
                    type: 'string',
                    enum: ['long', 'short'],
                    description: 'Trade direction',
                },
                leverage: {
                    type: 'number',
                    description: 'Leverage multiplier (1-100)',
                },
                sizeUsd: {
                    type: 'number',
                    description: 'Position size in USD',
                },
            },
            required: ['pair', 'side', 'leverage', 'sizeUsd'],
        },
    },
    {
        name: 'get_venue_rankings',
        description: 'Get reputation rankings and metrics for all available trading venues including success rates, average fees, and latency.',
        input_schema: {
            type: 'object' as const,
            properties: {},
        },
    },
    {
        name: 'get_funding_rates',
        description: 'Get current funding rates across perpetual DEX venues for a specific token.',
        input_schema: {
            type: 'object' as const,
            properties: {
                token: {
                    type: 'string',
                    description: 'Token symbol like "BTC", "ETH"',
                },
            },
            required: ['token'],
        },
    },
    {
        name: 'discover_services',
        description: 'Search for AI services and agents available on Relay Core with filters for category, reputation, and capabilities.',
        input_schema: {
            type: 'object' as const,
            properties: {
                category: {
                    type: 'string',
                    description: 'Service category like "trading.execution", "ai.inference", "data.prices"',
                },
                minReputation: {
                    type: 'number',
                    description: 'Minimum reputation score (0-100)',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_wallet_info',
        description: 'Get information about a wallet address including balance, recent trades, and reputation.',
        input_schema: {
            type: 'object' as const,
            properties: {
                address: {
                    type: 'string',
                    description: 'Ethereum wallet address',
                },
            },
            required: ['address'],
        },
    },
];

/**
 * Main chat function - processes user message with Claude AI
 */
export async function chatWithAgent(
    userMessage: string,
    context: AgentContext
): Promise<ChatResponse> {
    const startTime = performance.now();
    const sessionId = context.sessionId || crypto.randomUUID();

    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
        logger.error('ANTHROPIC_API_KEY not configured');
        return {
            message: 'AI service is not configured. Please set ANTHROPIC_API_KEY environment variable.',
            sessionId,
            processingTimeMs: Math.round(performance.now() - startTime),
        };
    }

    try {
        const systemPrompt = buildSystemPrompt(context);
        const messages = buildMessageHistory(userMessage, context);

        logger.info('Sending request to Claude', {
            messageLength: userMessage.length,
            historyLength: context.conversationHistory?.length || 0,
        });

        // Initial Claude API call
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages,
            tools: TOOLS,
        });

        // Process response and handle tool calls
        const { message, toolCalls } = await processResponse(response, messages, systemPrompt);

        return {
            message,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            sessionId,
            processingTimeMs: Math.round(performance.now() - startTime),
        };
    } catch (error: unknown) {
        logger.error('Claude API error', error as Error);

        const apiError = error as { status?: number; message?: string };
        if (apiError.status === 401) {
            return {
                message: 'AI service authentication failed. Please check API key configuration.',
                sessionId,
                processingTimeMs: Math.round(performance.now() - startTime),
            };
        }

        if (apiError.status === 429) {
            return {
                message: 'AI service is rate limited. Please try again in a moment.',
                sessionId,
                processingTimeMs: Math.round(performance.now() - startTime),
            };
        }

        return {
            message: 'I encountered an error processing your request. Please try again.',
            sessionId,
            processingTimeMs: Math.round(performance.now() - startTime),
        };
    }
}

/**
 * Build system prompt with context
 */
function buildSystemPrompt(context: AgentContext): string {
    return `You are a DeFi trading assistant for Relay Core on Cronos blockchain.

## Your Capabilities
- Access REAL-TIME cryptocurrency prices from multiple DEX sources (Pyth Oracle, VVS Finance, Moonlander, MM Finance)
- Get perpetual trade quotes from venues: Moonlander (up to 1000x), GMX, Fulcrom (up to 100x)
- Recommend best trading venues based on reputation, fees, and liquidity
- Discover AI services and agents on the Relay Core platform
- Check funding rates across perpetual DEXes

## Current Session
- Wallet: ${context.walletAddress || 'Not connected'}
- Platform: Cronos Mainnet (Chain ID: 25)
- Payment: x402 gasless USDC transfers

## Guidelines
1. Always use tools to get REAL data - never make up prices or rates
2. When discussing trades, always mention:
   - Current price from oracle
   - Estimated fees
   - Recommended venue with reasoning
   - Risk warnings for leveraged positions
3. If wallet is not connected, remind user to connect before executing trades
4. Be concise but thorough
5. Format numbers clearly (e.g., $45,234.56 not 45234.56)
6. Use markdown for better readability`;
}

/**
 * Build message history for Claude
 */
function buildMessageHistory(
    userMessage: string,
    context: AgentContext
): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = [];

    // Add conversation history
    if (context.conversationHistory && context.conversationHistory.length > 0) {
        // Only keep last 10 messages to manage token usage
        const recentHistory = context.conversationHistory.slice(-10);
        recentHistory.forEach((msg) => {
            messages.push({
                role: msg.role,
                content: msg.content,
            });
        });
    }

    // Add current message
    messages.push({
        role: 'user',
        content: userMessage,
    });

    return messages;
}

/**
 * Process Claude response and handle tool calls recursively
 */
async function processResponse(
    response: Anthropic.Message,
    messages: Anthropic.MessageParam[],
    systemPrompt: string
): Promise<{ message: string; toolCalls: ToolCall[] }> {
    let finalMessage = '';
    const toolCalls: ToolCall[] = [];

    // Process each content block
    for (const block of response.content) {
        if (block.type === 'text') {
            finalMessage += block.text;
        } else if (block.type === 'tool_use') {
            // Execute tool
            const toolStart = performance.now();
            const toolResult = await executeToolCall(block.name, block.input as Record<string, unknown>);
            const executionTimeMs = Math.round(performance.now() - toolStart);

            toolCalls.push({
                name: block.name,
                input: block.input as Record<string, unknown>,
                result: toolResult,
                executionTimeMs,
            });

            logger.info('Tool executed', {
                tool: block.name,
                executionTimeMs,
            });

            // Continue conversation with tool result
            const continuedResponse = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                system: systemPrompt,
                messages: [
                    ...messages,
                    {
                        role: 'assistant',
                        content: response.content,
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: block.id,
                                content: JSON.stringify(toolResult),
                            },
                        ],
                    },
                ],
                tools: TOOLS,
            });

            // Recursively process continued response (handles chained tool calls)
            const continued = await processResponse(
                continuedResponse,
                [
                    ...messages,
                    { role: 'assistant', content: response.content },
                    { role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(toolResult) }] },
                ],
                systemPrompt
            );

            finalMessage += continued.message;
            toolCalls.push(...continued.toolCalls);
        }
    }

    return {
        message: finalMessage || 'I processed your request but have no additional response.',
        toolCalls,
    };
}

/**
 * Execute a tool call and return the result
 */
async function executeToolCall(
    toolName: string,
    input: Record<string, unknown>
): Promise<unknown> {
    try {
        switch (toolName) {
            case 'get_crypto_price':
                return await getCryptoPrice(input.symbol as string);

            case 'get_trade_quote':
                return await getTradeQuote(input);

            case 'get_venue_rankings':
                return await getVenueRankings();

            case 'get_funding_rates':
                return await getFundingRates(input.token as string);

            case 'discover_services':
                return await discoverServices(input);

            case 'get_wallet_info':
                return await getWalletInfo(input.address as string);

            default:
                return { error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {
        logger.error(`Tool execution failed: ${toolName}`, error as Error);
        return { error: `Tool execution failed: ${(error as Error).message}` };
    }
}

// ============ TOOL IMPLEMENTATIONS ============

/**
 * Get real-time crypto price from multi-DEX aggregator
 */
async function getCryptoPrice(symbol: string): Promise<unknown> {
    try {
        // Normalize symbol format
        const normalizedSymbol = symbol.toUpperCase().replace('-', '/') as PriceFeedSymbol;

        const result = await multiDexAggregator.getAggregatedPrice(normalizedSymbol);

        return {
            symbol: result.symbol,
            price: result.bestPrice,
            source: result.bestSource,
            allSources: result.sources.map(s => ({
                name: s.name,
                price: s.price,
                latencyMs: s.latencyMs,
            })),
            timestamp: new Date(result.aggregatedAt).toISOString(),
        };
    } catch (error) {
        logger.error('Failed to get crypto price', error as Error);
        return { error: 'Failed to fetch price data' };
    }
}

/**
 * Get trade quote from trade router
 */
async function getTradeQuote(input: Record<string, unknown>): Promise<unknown> {
    try {
        const quote = await tradeRouterInstance.getQuote({
            pair: input.pair as string,
            side: input.side as 'long' | 'short',
            leverage: input.leverage as number,
            sizeUsd: input.sizeUsd as number,
        });

        return {
            venue: quote.bestVenue.name,
            venueReputation: quote.bestVenue.reputationScore,
            entryPrice: quote.expectedPrice,
            liquidationPrice: quote.liquidationPrice,
            estimatedFees: quote.totalFees,
            slippage: quote.expectedSlippage,
            priceImpact: quote.priceImpact,
            priceSource: quote.priceSource,
            priceSources: quote.priceSources,
            estimatedExecutionTime: quote.estimatedExecutionTime,
            quoteLatencyMs: quote.quoteLatencyMs,
        };
    } catch (error) {
        logger.error('Failed to get trade quote', error as Error);
        return { error: 'Failed to get quote. Please try again.' };
    }
}

/**
 * Get venue reputation rankings
 */
async function getVenueRankings(): Promise<unknown> {
    try {
        const { data: venues, error } = await supabase
            .from('dex_venues')
            .select('*')
            .eq('is_active', true)
            .order('reputation_score', { ascending: false });

        if (error) throw error;

        return {
            venues: (venues || []).map(v => ({
                name: v.name,
                reputationScore: v.reputation_score,
                tradingFee: `${v.trading_fee_bps / 100}%`,
                maxLeverage: v.max_leverage,
                supportedPairs: v.supported_pairs,
                totalVolume24h: v.volume_24h_usd,
            })),
            lastUpdated: new Date().toISOString(),
        };
    } catch (error) {
        logger.error('Failed to get venue rankings', error as Error);
        return { error: 'Failed to fetch venue data' };
    }
}

/**
 * Get funding rates from perpetual venues
 */
async function getFundingRates(token: string): Promise<unknown> {
    try {
        const { data: rates, error } = await supabase
            .from('funding_rates_timeseries')
            .select('*')
            .eq('token', token.toUpperCase())
            .order('timestamp', { ascending: false })
            .limit(10);

        if (error) throw error;

        // Group by venue
        const byVenue: Record<string, { rate: number; timestamp: string }[]> = {};
        (rates || []).forEach(r => {
            if (!byVenue[r.venue]) byVenue[r.venue] = [];
            byVenue[r.venue].push({
                rate: r.funding_rate,
                timestamp: r.timestamp,
            });
        });

        return {
            token: token.toUpperCase(),
            rates: Object.entries(byVenue).map(([venue, history]) => ({
                venue,
                currentRate: history[0]?.rate || 0,
                rateHistory: history.slice(0, 5),
            })),
        };
    } catch (error) {
        logger.error('Failed to get funding rates', error as Error);
        return { error: 'Failed to fetch funding rates' };
    }
}

/**
 * Discover services from Relay Core registry
 */
async function discoverServices(input: Record<string, unknown>): Promise<unknown> {
    try {
        let query = supabase
            .from('services')
            .select('*')
            .eq('is_active', true);

        if (input.category) {
            query = query.eq('category', input.category);
        }
        if (typeof input.minReputation === 'number') {
            query = query.gte('reputation_score', input.minReputation);
        }

        const { data: services, error } = await query.limit(10);

        if (error) throw error;

        return {
            count: services?.length || 0,
            services: (services || []).map(s => ({
                id: s.id,
                name: s.name,
                description: s.description,
                category: s.category,
                reputationScore: s.reputation_score,
                pricePerCall: s.price_per_call,
                endpoint: s.endpoint_url,
            })),
        };
    } catch (error) {
        logger.error('Failed to discover services', error as Error);
        return { error: 'Failed to search services' };
    }
}

/**
 * Get wallet information
 */
async function getWalletInfo(address: string): Promise<unknown> {
    try {
        // Get agent reputation
        const { data: reputation } = await supabase
            .from('agent_reputation')
            .select('*')
            .eq('wallet_address', address.toLowerCase())
            .single();

        // Get recent trades
        const { data: trades } = await supabase
            .from('trades')
            .select('*')
            .eq('trader_address', address.toLowerCase())
            .order('created_at', { ascending: false })
            .limit(5);

        // Get services owned
        const { data: services } = await supabase
            .from('services')
            .select('id, name, reputation_score')
            .eq('owner_address', address.toLowerCase());

        return {
            address,
            reputation: reputation ? {
                score: reputation.reputation_score,
                totalTrades: reputation.total_trades,
                successRate: reputation.success_rate,
            } : null,
            recentTrades: (trades || []).map(t => ({
                pair: t.pair,
                side: t.side,
                size: t.size_usd,
                pnl: t.pnl_usd,
                status: t.status,
                timestamp: t.created_at,
            })),
            servicesOwned: services?.length || 0,
        };
    } catch (error) {
        logger.error('Failed to get wallet info', error as Error);
        return { error: 'Failed to fetch wallet data' };
    }
}

export default { chatWithAgent };
