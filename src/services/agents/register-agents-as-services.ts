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

// All agents to register as services
const PLATFORM_AGENTS = [
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
    },
    {
        name: 'x402 Session Manager',
        description: 'Gasless payment session management. Creates x402 sessions, tracks spending, manages agent payments, and handles refunds. All operations gasless via x402 protocol.',
        category: 'compute',
        endpoint_url: `${API_BASE_URL}/api/sessions/x402`,
        price_per_call: '0.01', // $0.01 USDC to create session
        input_schema: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['create', 'activate', 'status', 'close'] },
                ownerAddress: { type: 'string', description: 'Session owner address' },
                maxSpend: { type: 'string', description: 'Maximum budget in USDC' },
                durationHours: { type: 'number', description: 'Session duration in hours' },
                sessionId: { type: 'number', description: 'Session ID (for activate/status/close)' },
                txHash: { type: 'string', description: 'Payment transaction hash (for activate)' },
                amount: { type: 'string', description: 'Payment amount (for activate)' }
            },
            required: ['action']
        },
        output_schema: {
            type: 'object',
            properties: {
                session_id: { type: 'number' },
                status: { type: 'string' },
                deposited: { type: 'string' },
                spent: { type: 'string' },
                remaining: { type: 'string' },
                payment_count: { type: 'number' },
                paymentRequest: { type: 'object' }
            }
        },
        input_type: 'SessionRequest',
        output_type: 'SessionResponse',
        tags: ['payments', 'x402', 'sessions', 'gasless', 'ai-agent'],
        capabilities: ['session-management', 'budget-tracking', 'gasless-payments', 'auto-refund', 'agent-coordination']
    },
    {
        name: 'RWA Settlement Agent',
        description: 'Real-World Asset settlement coordination. Handles off-chain verification, multi-party approvals, and on-chain settlement for physical asset transactions.',
        category: 'compute',
        endpoint_url: `${API_BASE_URL}/api/agents/rwa-settlement/invoke`,
        price_per_call: '0.25', // $0.25 USDC per request
        input_schema: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['initiate', 'verify', 'approve', 'settle'] },
                request_id: { type: 'string', description: 'Settlement request ID' },
                asset_type: { type: 'string', description: 'Type of RWA (real-estate, commodity, etc)' },
                parties: { type: 'array', description: 'Involved parties and roles' },
                amount: { type: 'string', description: 'Settlement amount' },
                verification_docs: { type: 'array', description: 'IPFS hashes of verification documents' }
            },
            required: ['action']
        },
        output_schema: {
            type: 'object',
            properties: {
                request_id: { type: 'string' },
                status: { type: 'string' },
                approvals: { type: 'array' },
                tx_hash: { type: 'string' },
                message: { type: 'string' }
            }
        },
        input_type: 'RWARequest',
        output_type: 'RWAResponse',
        tags: ['rwa', 'settlement', 'verification', 'ai-agent', 'compliance'],
        capabilities: ['rwa-verification', 'multi-party-approval', 'document-validation', 'settlement-coordination']
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
    console.log('[Agent Registration] Registering platform agents as services...');

    for (const agent of PLATFORM_AGENTS) {
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

                    // Ensure reputation record exists
                    const { data: existingRep } = await supabase
                        .from('reputations')
                        .select('service_id')
                        .eq('service_id', existing.id)
                        .single();

                    if (!existingRep) {
                        await supabase.from('reputations').insert({
                            service_id: existing.id,
                            reputation_score: 80,
                            success_rate: 100,
                            total_payments: 0,
                            successful_payments: 0,
                            avg_latency_ms: 200
                        });
                    }

                    // Update or insert schema
                    const { data: existingSchema } = await supabase
                        .from('service_schemas')
                        .select('service_id')
                        .eq('service_id', existing.id)
                        .single();

                    const schemaData = {
                        service_id: existing.id,
                        input_schema: agent.input_schema,
                        output_schema: agent.output_schema,
                        input_type: agent.input_type,
                        output_type: agent.output_type,
                        tags: agent.tags,
                        capabilities: agent.capabilities,
                        schema_version: '1.0'
                    };

                    if (existingSchema) {
                        await supabase
                            .from('service_schemas')
                            .update(schemaData)
                            .eq('service_id', existing.id);
                    } else {
                        await supabase
                            .from('service_schemas')
                            .insert(schemaData);
                    }
                }
            } else {
                // Insert new service
                const { data: newService, error } = await supabase
                    .from('services')
                    .insert(serviceData)
                    .select('id')
                    .single();

                if (error) {
                    console.error(`[Agent Registration] Failed to register service ${agent.name}`, error);
                } else {
                    console.log(`[Agent Registration] Registered new service: ${agent.name}`);

                    if (newService?.id) {
                        // Create initial reputation record
                        await supabase.from('reputations').insert({
                            service_id: newService.id,
                            reputation_score: 80,
                            success_rate: 100,
                            total_payments: 0,
                            successful_payments: 0,
                            avg_latency_ms: 200
                        });

                        // Insert schema
                        await supabase.from('service_schemas').insert({
                            service_id: newService.id,
                            input_schema: agent.input_schema,
                            output_schema: agent.output_schema,
                            input_type: agent.input_type,
                            output_type: agent.output_type,
                            tags: agent.tags,
                            capabilities: agent.capabilities,
                            schema_version: '1.0'
                        });
                    }
                }
            }
        } catch (err) {
            console.error(`[Agent Registration] Error registering ${agent.name}`, err);
        }
    }

    console.log('[Agent Registration] Platform agent registration complete');
}
