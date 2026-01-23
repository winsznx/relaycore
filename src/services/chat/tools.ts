/**
 * Relay Core Tool Definitions with Zod Schemas
 * 
 * Production-grade tool definitions for LangGraph.
 * Tools are separated from execution logic.
 */

import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { pythPriceService, type PriceFeedSymbol } from '../prices/pyth-price-service.js';
import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

// Query Tools (Read-only, no side effects)

export const queryIndexerTool = tool(
    async ({ table, filters, limit }) => {
        const startTime = Date.now();

        try {
            let query = supabase.from(table).select('*');

            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    query = query.eq(key, value);
                });
            }

            const { data, error } = await query.limit(limit || 10);

            if (error) throw error;

            return {
                success: true,
                data,
                count: data?.length || 0,
                executionTimeMs: Date.now() - startTime,
                dataSource: `supabase_${table}`,
            };
        } catch (error) {
            logger.error('query_indexer failed', error as Error);
            return {
                success: false,
                error: (error as Error).message,
                executionTimeMs: Date.now() - startTime,
            };
        }
    },
    {
        name: 'query_indexer',
        description: 'Query indexed blockchain data from Supabase. Tables: payments, sessions, outcomes, services, transactions.',
        schema: z.object({
            table: z.enum(['payments', 'sessions', 'outcomes', 'services', 'transactions']),
            filters: z.record(z.unknown()).optional(),
            limit: z.number().max(50).optional(),
        }),
    }
);

export const getServiceMetricsTool = tool(
    async ({ serviceId }) => {
        const startTime = Date.now();

        try {
            const { data, error } = await supabase
                .from('services')
                .select('*, service_metrics(*)')
                .eq('id', serviceId)
                .single();

            if (error) throw error;

            return {
                success: true,
                service: {
                    id: data.id,
                    name: data.name,
                    reputation: data.reputation_score,
                    status: data.status,
                    totalCalls: data.service_metrics?.[0]?.total_calls || 0,
                    successRate: data.service_metrics?.[0]?.success_rate || 0,
                    avgLatency: data.service_metrics?.[0]?.avg_latency_ms || 0,
                },
                executionTimeMs: Date.now() - startTime,
                dataSource: 'supabase_services',
            };
        } catch (error) {
            logger.error('get_service_metrics failed', error as Error);
            return {
                success: false,
                error: (error as Error).message,
                executionTimeMs: Date.now() - startTime,
            };
        }
    },
    {
        name: 'get_service_metrics',
        description: 'Get reputation and performance metrics for a specific service.',
        schema: z.object({
            serviceId: z.string().describe('Service ID or address'),
        }),
    }
);

export const getMarketPriceTool = tool(
    async ({ symbol }) => {
        const startTime = Date.now();

        try {
            const priceData = await pythPriceService.getPriceWithConfidence(symbol as PriceFeedSymbol);

            return {
                success: true,
                price: {
                    symbol,
                    price: priceData.price,
                    confidence: priceData.confidence,
                    publishTime: new Date(priceData.publishTime * 1000).toISOString(),
                    source: 'Pyth Oracle on Cronos',
                },
                executionTimeMs: Date.now() - startTime,
                dataSource: 'pyth_oracle',
            };
        } catch (error) {
            logger.error('get_market_price failed', error as Error);
            return {
                success: false,
                error: (error as Error).message,
                executionTimeMs: Date.now() - startTime,
            };
        }
    },
    {
        name: 'get_market_price',
        description: 'Get real-time cryptocurrency price from Pyth Oracle on Cronos.',
        schema: z.object({
            symbol: z.enum(['BTC/USD', 'ETH/USD', 'CRO/USD', 'USDC/USD']),
        }),
    }
);

export const discoverServicesTool = tool(
    async ({ category, minReputation, limit }) => {
        const startTime = Date.now();

        try {
            let query = supabase
                .from('services')
                .select('*')
                .eq('status', 'active');

            if (category) {
                query = query.ilike('category', `%${category}%`);
            }

            if (minReputation !== undefined) {
                query = query.gte('reputation_score', minReputation);
            }

            const { data, error } = await query.limit(limit || 10);

            if (error) throw error;

            return {
                success: true,
                services: data?.map(s => ({
                    id: s.id,
                    name: s.name,
                    category: s.category,
                    reputation: s.reputation_score,
                    pricePerCall: s.price_per_call,
                    endpoint: s.endpoint_url,
                })) || [],
                count: data?.length || 0,
                executionTimeMs: Date.now() - startTime,
                dataSource: 'supabase_services',
            };
        } catch (error) {
            logger.error('discover_services failed', error as Error);
            return {
                success: false,
                error: (error as Error).message,
                executionTimeMs: Date.now() - startTime,
            };
        }
    },
    {
        name: 'discover_services',
        description: 'Search for AI services in the Relay Core marketplace.',
        schema: z.object({
            category: z.string().optional().describe('Service category filter'),
            minReputation: z.number().min(0).max(100).optional().describe('Minimum reputation score'),
            limit: z.number().max(50).optional(),
        }),
    }
);

// Simulation Tools (No side effects)

export const simulatePaymentTool = tool(
    async ({ serviceId, amount }) => {
        const startTime = Date.now();

        try {
            // Fetch service details
            const { data: service, error } = await supabase
                .from('services')
                .select('*')
                .eq('id', serviceId)
                .single();

            if (error) throw error;

            // Simulate without executing
            return {
                success: true,
                simulation: {
                    service: {
                        id: service.id,
                        name: service.name,
                        pricePerCall: service.price_per_call,
                    },
                    payment: {
                        amount,
                        estimatedGas: '~0.001 CRO',
                        totalCost: `${parseFloat(amount) + 0.001} USDC + gas`,
                    },
                    risks: [],
                    confirmations: [
                        'This will spend USDC from your wallet',
                        'Ensure sufficient balance before proceeding',
                    ],
                },
                executionTimeMs: Date.now() - startTime,
                dataSource: 'simulation',
            };
        } catch (error) {
            logger.error('simulate_payment failed', error as Error);
            return {
                success: false,
                error: (error as Error).message,
                executionTimeMs: Date.now() - startTime,
            };
        }
    },
    {
        name: 'simulate_payment',
        description: 'Simulate an x402 payment without executing it. Returns cost estimates and risks.',
        schema: z.object({
            serviceId: z.string(),
            amount: z.string().describe('Payment amount in USDC'),
        }),
    }
);

// Approval Tools (Generate handoff URLs, no execution)

export const generateHandoffUrlTool = tool(
    async ({ action, params }) => {
        const startTime = Date.now();

        try {
            // Generate URL for wallet signing
            const baseUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
            const handoffUrl = `${baseUrl}/sign/${action}?${new URLSearchParams(params as Record<string, string>).toString()}`;

            return {
                success: true,
                handoffUrl,
                action,
                params,
                executionTimeMs: Date.now() - startTime,
                dataSource: 'generated',
            };
        } catch (error) {
            logger.error('generate_handoff_url failed', error as Error);
            return {
                success: false,
                error: (error as Error).message,
                executionTimeMs: Date.now() - startTime,
            };
        }
    },
    {
        name: 'generate_handoff_url',
        description: 'Generate a URL for wallet signing. Does NOT execute the action.',
        schema: z.object({
            action: z.enum(['payment', 'session_create', 'approve']),
            params: z.record(z.unknown()),
        }),
    }
);

// Export all tools
export const relayTools = [
    queryIndexerTool,
    getServiceMetricsTool,
    getMarketPriceTool,
    discoverServicesTool,
    simulatePaymentTool,
    generateHandoffUrlTool,
];
