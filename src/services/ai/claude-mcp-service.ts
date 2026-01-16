/**
 * Claude AI Service with MCP Tool Integration
 * 
 * Integrates Claude with crypto.com MCP tools for:
 * - Real-time crypto prices
 * - Market data
 * - Trading insights
 * - Service discovery
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger.js';
import { mcpClient } from '../mcp/crypto-com-mcp.js';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define MCP tools for Claude
const MCP_TOOLS = [
    {
        name: 'get_crypto_price',
        description: 'Get real-time cryptocurrency price from crypto.com. Returns current price, 24h change, volume, and market data.',
        input_schema: {
            type: 'object' as const,
            properties: {
                symbol: {
                    type: 'string',
                    description: 'Crypto symbol (e.g., BTC, ETH, SOL, CRO). Will be converted to SYMBOL_USDT format.',
                },
            },
            required: ['symbol'],
        },
    },
    {
        name: 'get_order_book',
        description: 'Get order book data for a cryptocurrency pair showing bids and asks.',
        input_schema: {
            type: 'object' as const,
            properties: {
                symbol: {
                    type: 'string',
                    description: 'Crypto symbol (e.g., BTC, ETH)',
                },
                depth: {
                    type: 'number',
                    description: 'Order book depth (default: 10)',
                },
            },
            required: ['symbol'],
        },
    },
] as const;

import type { MessageParam } from '@anthropic-ai/sdk/resources';

interface ToolCall {
    name: string;
    input: Record<string, any>;
    result?: any;
    executionTimeMs?: number;
}

interface ClaudeResponse {
    content: string;
    toolCalls?: ToolCall[];
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
}

/**
 * Execute MCP tool calls
 */
async function executeTool(toolName: string, input: Record<string, any>): Promise<any> {
    const startTime = Date.now();

    try {
        let result;

        switch (toolName) {
            case 'get_crypto_price': {
                const symbol = input.symbol.toUpperCase();
                const formattedSymbol = symbol.includes('_') ? symbol : `${symbol}_USDT`;
                const data = await mcpClient.getMarketData(formattedSymbol);

                result = {
                    symbol: formattedSymbol,
                    price: data.price,
                    change24h: data.change24h,
                    high24h: data.high24h,
                    low24h: data.low24h,
                    volume24h: data.volume24h,
                    bid: data.bid,
                    ask: data.ask,
                };
                break;
            }

            case 'get_order_book': {
                const symbol = input.symbol.toUpperCase();
                const formattedSymbol = symbol.includes('_') ? symbol : `${symbol}_USDT`;
                const depth = input.depth || 10;
                const data = await mcpClient.getOrderBook(formattedSymbol, depth);

                result = {
                    symbol: formattedSymbol,
                    bids: data.bids.slice(0, 5), // Top 5 for brevity
                    asks: data.asks.slice(0, 5),
                };
                break;
            }

            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }

        const executionTimeMs = Date.now() - startTime;
        logger.info(`Tool executed: ${toolName}`, { executionTimeMs });

        return { result, executionTimeMs };
    } catch (error) {
        logger.error(`Tool execution failed: ${toolName}`, error as Error);
        throw error;
    }
}

/**
 * Chat with Claude using MCP tools
 */
export async function chatWithTools(
    messages: MessageParam[],
    options: {
        systemPrompt?: string;
        maxTokens?: number;
        temperature?: number;
    } = {}
): Promise<ClaudeResponse> {
    const toolCalls: ToolCall[] = [];
    let conversationMessages = [...messages];

    // Initial Claude call with tools
    let response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature || 0.8,
        system: options.systemPrompt || 'You are a helpful AI assistant for Relay Core.',
        messages: conversationMessages,
        tools: MCP_TOOLS as any,
    });

    // Handle tool calls in a loop (Claude may request multiple tools)
    while (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

        // Execute all tool calls
        const toolResults = await Promise.all(
            toolUseBlocks.map(async (toolUse: any) => {
                const { result, executionTimeMs } = await executeTool(toolUse.name, toolUse.input);

                toolCalls.push({
                    name: toolUse.name,
                    input: toolUse.input,
                    result,
                    executionTimeMs,
                });

                return {
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(result),
                };
            })
        );

        // Add assistant's tool use and tool results to conversation
        conversationMessages.push({
            role: 'assistant',
            content: response.content as any,
        });

        conversationMessages.push({
            role: 'user',
            content: toolResults as any,
        });

        // Continue conversation with tool results
        response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: options.maxTokens || 2048,
            temperature: options.temperature || 0.8,
            system: options.systemPrompt,
            messages: conversationMessages,
            tools: MCP_TOOLS as any,
        });
    }

    // Extract final text response
    const textContent = response.content.find(block => block.type === 'text');
    const finalText = textContent?.type === 'text' ? textContent.text : '';

    // Strip markdown
    const cleanText = finalText
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .trim();

    return {
        content: cleanText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
        },
    };
}

export default {
    chatWithTools,
};
