import type { CronosNetwork } from '@crypto.com/facilitator-client';
import { supabase } from '../../lib/supabase';

// PORT variable removed (unused)
const HOST = process.env.PUBLIC_HOST || 'https://api.relaycore.xyz';
const NETWORK = (process.env.CRONOS_NETWORK ?? 'cronos-testnet') as CronosNetwork;

interface AgentCardResource {
    id: string;
    title: string;
    url: string;
    price?: string;
    paywall: {
        protocol: 'x402';
        settlement: string;
    };
}

interface AgentCard {
    name: string;
    description: string;
    url: string;
    version: string;
    network: string;
    capabilities: string[];
    resources: AgentCardResource[];
    contracts: {
        escrowSession: string;
        identityRegistry: string;
        reputationRegistry: string;
        usdcToken: string;
    };
    x402: {
        facilitator: string;
        token: string;
        chainId: number;
    };
}

export class WellKnownService {
    async getAgentCard(): Promise<AgentCard> {
        const resources = await this.getRegisteredResources();

        return {
            name: 'relay-core',
            description: 'Gasless agentic finance infrastructure on Cronos. Provides x402 payment sessions, service discovery, reputation scoring, and autonomous agent coordination.',
            url: HOST,
            version: '1.0.0',
            network: NETWORK,
            capabilities: [
                'x402-payment-sessions',
                'gasless-payments',
                'service-discovery',
                'agent-coordination',
                'reputation-scoring',
                'perpai-trading',
                'rwa-valuation'
            ],
            resources,
            contracts: {
                escrowSession: process.env.ESCROW_CONTRACT_ADDRESS || '0x9D340a67ddD4Fcf5eC590b7B67e1fE8d020F7D61',
                identityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS || '0x4b697D8ABC0e3dA0086011222755d9029DBB9C43',
                reputationRegistry: process.env.REPUTATION_REGISTRY_ADDRESS || '0xdaFC2fA590C5Ba88155a009660dC3b14A3651a67',
                usdcToken: process.env.USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0'
            },
            x402: {
                facilitator: 'https://facilitator.cronoslabs.org/v2/x402',
                token: process.env.USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
                chainId: NETWORK === 'cronos-testnet' ? 338 : 25
            }
        };
    }

    private async getRegisteredResources(): Promise<AgentCardResource[]> {
        const coreResources: AgentCardResource[] = [
            {
                id: 'x402-session',
                title: 'x402 Payment Session Management',
                url: '/api/sessions/x402',
                price: '0',
                paywall: {
                    protocol: 'x402',
                    settlement: '/api/pay'
                }
            },
            {
                id: 'perpai-quote',
                title: 'PerpAI Quote Service',
                url: '/api/perpai/quote',
                price: '10000',
                paywall: {
                    protocol: 'x402',
                    settlement: '/api/pay'
                }
            },
            {
                id: 'perpai-trade',
                title: 'PerpAI Trade Execution',
                url: '/api/perpai/trade',
                price: '50000',
                paywall: {
                    protocol: 'x402',
                    settlement: '/api/pay'
                }
            },
            {
                id: 'rwa-valuation',
                title: 'RWA Valuation Service',
                url: '/api/rwa/valuation',
                price: '100000',
                paywall: {
                    protocol: 'x402',
                    settlement: '/api/pay'
                }
            },
            {
                id: 'price-aggregation',
                title: 'Multi-DEX Price Aggregation',
                url: '/api/prices/aggregated',
                price: '5000',
                paywall: {
                    protocol: 'x402',
                    settlement: '/api/pay'
                }
            }
        ];

        try {
            const { data: services } = await supabase
                .from('services')
                .select('id, name, endpoint_url, price_per_call, status')
                .eq('status', 'active')
                .limit(50);

            if (services && services.length > 0) {
                const dbResources: AgentCardResource[] = services.map(service => ({
                    id: service.id,
                    title: service.name,
                    url: service.endpoint_url || `/api/services/${service.id}/invoke`,
                    price: service.price_per_call || '10000',
                    paywall: {
                        protocol: 'x402' as const,
                        settlement: '/api/pay'
                    }
                }));

                return [...coreResources, ...dbResources];
            }
        } catch {
            // Database unavailable, return core resources only
        }

        return coreResources;
    }
}

export const wellKnownService = new WellKnownService();
