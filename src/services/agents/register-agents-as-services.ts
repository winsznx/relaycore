/**
 * Register PerpAI Agents as Services
 * 
 * This module registers the built-in PerpAI agents as services in the marketplace
 * so they appear alongside other services in the "AI Agents" category.
 * 
 * Run this during server startup or as a migration.
 */

import { supabase, isSupabaseAvailable } from '../../lib/supabase';

// Default owner address for platform-hosted agents
const PLATFORM_OWNER_ADDRESS = process.env.PAYMENT_RECIPIENT_ADDRESS || '0x0000000000000000000000000000000000000001';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4001';

// PerpAI agents to register as services
const PERPAI_AGENTS = [
    {
        name: 'PerpAI Quote',
        description: 'Get price quotes and analysis for perpetual trades. Returns best venues, entry prices, funding rates, and risk metrics.',
        category: 'compute',
        endpoint_url: `${API_BASE_URL}/api/agents/perp-ai-quote/invoke`,
        price_per_call: '0.01', // $0.01 USDC
        input_schema: {
            type: 'object',
            properties: {
                pair: { type: 'string', description: 'Trading pair (e.g., ETH/USD)' },
                side: { type: 'string', enum: ['long', 'short'] },
                leverage: { type: 'number', minimum: 1, maximum: 100 },
                size_usd: { type: 'number', description: 'Position size in USD' }
            },
            required: ['pair', 'side']
        },
        output_schema: {
            type: 'object',
            properties: {
                best_venue: { type: 'string' },
                entry_price: { type: 'number' },
                funding_rate: { type: 'number' },
                liquidation_price: { type: 'number' }
            }
        },
        input_type: 'TradeQuoteRequest',
        output_type: 'TradeQuoteResponse',
        tags: ['trading', 'perpetuals', 'defi', 'ai-agent', 'research'],
        capabilities: ['price-analysis', 'venue-comparison', 'risk-assessment']
    },
    {
        name: 'PerpAI Trade',
        description: 'Execute perpetual trades with AI-optimized routing. Handles order placement, position management, and risk controls.',
        category: 'compute',
        endpoint_url: `${API_BASE_URL}/api/agents/perp-ai-trade/invoke`,
        price_per_call: '0.05', // $0.05 USDC
        input_schema: {
            type: 'object',
            properties: {
                pair: { type: 'string', description: 'Trading pair (e.g., ETH/USD)' },
                side: { type: 'string', enum: ['long', 'short'] },
                leverage: { type: 'number', minimum: 1, maximum: 100 },
                size_usd: { type: 'number', description: 'Position size in USD' },
                slippage_bps: { type: 'number', description: 'Max slippage in basis points' },
                stop_loss_percent: { type: 'number' },
                take_profit_percent: { type: 'number' }
            },
            required: ['pair', 'side', 'size_usd']
        },
        output_schema: {
            type: 'object',
            properties: {
                tx_hash: { type: 'string' },
                position_id: { type: 'string' },
                entry_price: { type: 'number' },
                status: { type: 'string' }
            }
        },
        input_type: 'TradeExecuteRequest',
        output_type: 'TradeExecuteResponse',
        tags: ['trading', 'perpetuals', 'defi', 'ai-agent', 'execution'],
        capabilities: ['trade-execution', 'position-management', 'risk-controls']
    },
    {
        name: 'PerpAI Venues',
        description: 'Get information about available perpetual DEX venues. Returns supported pairs, fees, and current market conditions.',
        category: 'compute',
        endpoint_url: `${API_BASE_URL}/api/agents/perp-ai-venues/invoke`,
        price_per_call: '0', // Free
        input_schema: {
            type: 'object',
            properties: {
                pair: { type: 'string', description: 'Optional: filter by trading pair' }
            }
        },
        output_schema: {
            type: 'object',
            properties: {
                venues: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            pairs: { type: 'array' },
                            fees: { type: 'object' }
                        }
                    }
                }
            }
        },
        input_type: 'VenuesRequest',
        output_type: 'VenuesResponse',
        tags: ['trading', 'perpetuals', 'defi', 'ai-agent', 'research'],
        capabilities: ['venue-discovery', 'market-info']
    }
];

/**
 * Register or update PerpAI agents as services in the database
 */
export async function registerAgentsAsServices(): Promise<void> {
    if (!isSupabaseAvailable()) {
        console.warn('[Agent Registration] Supabase not available, skipping registration');
        return;
    }
    console.log('[Agent Registration] Registering PerpAI agents as services...');

    for (const agent of PERPAI_AGENTS) {
        try {
            // Check if service already exists by name and owner
            const { data: existing } = await supabase
                .from('services')
                .select('id')
                .eq('name', agent.name)
                .eq('owner_address', PLATFORM_OWNER_ADDRESS)
                .single();

            const serviceData = {
                name: agent.name,
                description: agent.description,
                category: agent.category,
                endpoint_url: agent.endpoint_url,
                price_per_call: agent.price_per_call,
                owner_address: PLATFORM_OWNER_ADDRESS,
                is_active: true,
            };

            if (existing?.id) {
                // Update existing service
                const { error } = await supabase
                    .from('services')
                    .update(serviceData)
                    .eq('id', existing.id);

                if (error) {
                    console.error(`[Agent Registration] Failed to update service ${agent.name}`, error);
                } else {
                    console.log(`[Agent Registration] Updated service: ${agent.name}`);
                }
            } else {
                // Insert new service
                const { error } = await supabase
                    .from('services')
                    .insert(serviceData);

                if (error) {
                    console.error(`[Agent Registration] Failed to register service ${agent.name}`, error);
                } else {
                    console.log(`[Agent Registration] Registered new service: ${agent.name}`);

                    // Also create initial reputation record
                    const { data: newService } = await supabase
                        .from('services')
                        .select('id')
                        .eq('name', agent.name)
                        .eq('owner_address', PLATFORM_OWNER_ADDRESS)
                        .single();

                    if (newService?.id) {
                        await supabase.from('reputations').insert({
                            service_id: newService.id,
                            reputation_score: 80, // Start with good score
                            success_rate: 100,
                            total_payments: 0,
                            successful_payments: 0,
                            avg_latency_ms: 200
                        });
                    }
                }
            }
        } catch (err) {
            console.error(`[Agent Registration] Error registering ${agent.name}`, err);
        }
    }

    console.log('[Agent Registration] PerpAI agent registration complete');
}
