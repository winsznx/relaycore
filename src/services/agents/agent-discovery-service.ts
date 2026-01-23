/**
 * Agent Discovery Service
 * 
 * Enhanced agent discovery with multiple resolution methods:
 * - Database lookup (Supabase services table)
 * - URL-based agent card fetch (/.well-known/agent-card.json)
 * - On-chain registry lookup (IdentityRegistry contract)
 * - IPFS/Arweave URI resolution (for decentralized cards)
 */

import { ethers } from 'ethers';
import logger from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import type { AgentCard } from '../../types/meta-agent.js';

// Agent card cache to reduce network calls
const agentCardCache = new Map<string, { card: AgentCard; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface DiscoveredAgent {
    id: string;
    name: string;
    description: string;
    ownerAddress: string;
    endpointUrl: string;
    category?: string;
    pricePerCall?: string;
    reputationScore?: number;
    successRate?: number;
    card?: AgentCard;
    source: 'database' | 'onchain' | 'url' | 'ipfs';
}

export interface DiscoveryOptions {
    capability?: string;
    category?: string;
    minReputation?: number;
    maxPrice?: number;
    limit?: number;
    includeInactive?: boolean;
}

export class AgentDiscoveryService {
    private provider: ethers.JsonRpcProvider | null = null;
    private identityRegistryAddress: string;
    private identityRegistryAbi = [
        'function totalAgents() view returns (uint256)',
        'function getAgent(uint256 agentId) view returns (address owner, string memory agentURI, bool isActive)',
        'event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI)'
    ];

    constructor() {
        this.identityRegistryAddress = process.env.IDENTITY_REGISTRY_ADDRESS || '';
    }

    /**
     * Initialize blockchain provider.
     */
    private getProvider(): ethers.JsonRpcProvider {
        if (!this.provider) {
            const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
        }
        return this.provider;
    }

    /**
     * Discover agents from all sources.
     */
    async discoverAgents(options: DiscoveryOptions = {}): Promise<DiscoveredAgent[]> {
        logger.info('Discovering agents', options);

        const agents: DiscoveredAgent[] = [];
        const limit = options.limit || 20;

        // 1. Database discovery (primary source)
        const dbAgents = await this.discoverFromDatabase(options);
        agents.push(...dbAgents);

        // 2. On-chain registry (if configured)
        if (this.identityRegistryAddress && agents.length < limit) {
            const onchainAgents = await this.discoverFromOnChain(limit - agents.length);

            // Merge, avoiding duplicates by owner address
            for (const agent of onchainAgents) {
                if (!agents.find(a => a.ownerAddress.toLowerCase() === agent.ownerAddress.toLowerCase())) {
                    agents.push(agent);
                }
            }
        }

        // 3. Fetch agent cards for all discovered agents
        await this.enrichWithAgentCards(agents);

        // 4. Filter by capability if specified
        if (options.capability) {
            return agents.filter(agent => {
                if (!agent.card) return false;
                return agent.card.resources.some(r =>
                    r.id.includes(options.capability!) ||
                    r.title.toLowerCase().includes(options.capability!.toLowerCase()) ||
                    r.description?.toLowerCase().includes(options.capability!.toLowerCase())
                );
            });
        }

        // Sort by reputation score
        agents.sort((a, b) => (b.reputationScore || 0) - (a.reputationScore || 0));

        return agents.slice(0, limit);
    }

    /**
     * Discover agents from database.
     */
    private async discoverFromDatabase(options: DiscoveryOptions): Promise<DiscoveredAgent[]> {
        try {
            let query = supabase
                .from('services')
                .select(`
                    id,
                    name,
                    description,
                    endpoint_url,
                    owner_address,
                    category,
                    price_per_call,
                    is_active,
                    reputations (
                        reputation_score,
                        successful_payments,
                        total_payments
                    )
                `)
                .eq('is_active', !options.includeInactive);

            if (options.category) {
                query = query.eq('category', options.category);
            }

            if (options.maxPrice) {
                query = query.lte('price_per_call', options.maxPrice);
            }

            const { data, error } = await query.limit(options.limit || 20);

            if (error) {
                logger.error('Database discovery failed', error);
                return [];
            }

            return (data || []).map(service => {
                const rep = Array.isArray(service.reputations)
                    ? service.reputations[0]
                    : service.reputations;

                const totalPayments = rep?.total_payments || 0;
                const successfulPayments = rep?.successful_payments || 0;

                return {
                    id: service.id,
                    name: service.name,
                    description: service.description || '',
                    ownerAddress: service.owner_address,
                    endpointUrl: service.endpoint_url || '',
                    category: service.category,
                    pricePerCall: service.price_per_call,
                    reputationScore: rep?.reputation_score || 80,
                    successRate: totalPayments > 0
                        ? (successfulPayments / totalPayments) * 100
                        : 100,
                    source: 'database' as const
                };
            }).filter(agent =>
                !options.minReputation || (agent.reputationScore || 0) >= options.minReputation
            );
        } catch (error) {
            logger.error('Database discovery error', error as Error);
            return [];
        }
    }

    /**
     * Discover agents from on-chain registry.
     */
    private async discoverFromOnChain(limit: number): Promise<DiscoveredAgent[]> {
        try {
            if (!this.identityRegistryAddress) {
                return [];
            }

            const contract = new ethers.Contract(
                this.identityRegistryAddress,
                this.identityRegistryAbi,
                this.getProvider()
            );

            const totalAgents = await contract.totalAgents();
            const agents: DiscoveredAgent[] = [];

            // Fetch recent agents (most recent first)
            const start = Math.max(1, Number(totalAgents) - limit);

            for (let i = Number(totalAgents); i >= start && agents.length < limit; i--) {
                try {
                    const [owner, agentURI, isActive] = await contract.getAgent(i);

                    if (!isActive) continue;

                    agents.push({
                        id: `onchain_${i}`,
                        name: `Agent #${i}`,
                        description: '',
                        ownerAddress: owner,
                        endpointUrl: this.resolveAgentURI(agentURI),
                        reputationScore: 80, // Default for new on-chain agents
                        successRate: 100,
                        source: 'onchain'
                    });
                } catch (error) {
                    // Agent might not exist
                    continue;
                }
            }

            return agents;
        } catch (error) {
            logger.error('On-chain discovery error', error as Error);
            return [];
        }
    }

    /**
     * Resolve agent URI to HTTP URL.
     * Handles: HTTP/HTTPS, IPFS, Arweave
     */
    private resolveAgentURI(uri: string): string {
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
            return uri;
        }

        if (uri.startsWith('ipfs://')) {
            const cid = uri.replace('ipfs://', '');
            return `https://ipfs.io/ipfs/${cid}`;
        }

        if (uri.startsWith('ar://')) {
            const txId = uri.replace('ar://', '');
            return `https://arweave.net/${txId}`;
        }

        // Assume it's a raw URL
        return uri;
    }

    /**
     * Enrich agents with their agent cards.
     */
    private async enrichWithAgentCards(agents: DiscoveredAgent[]): Promise<void> {
        const fetchPromises = agents.map(async agent => {
            if (!agent.endpointUrl) return;

            try {
                agent.card = await this.fetchAgentCard(agent.endpointUrl);

                // Update name/description from card if available
                if (agent.card) {
                    agent.name = agent.card.name || agent.name;
                    agent.description = agent.card.description || agent.description;
                }
            } catch (error) {
                // Card fetch failed, continue without it
            }
        });

        await Promise.all(fetchPromises);
    }

    /**
     * Fetch agent card with caching.
     */
    async fetchAgentCard(baseUrl: string): Promise<AgentCard | undefined> {
        // Check cache first
        const cached = agentCardCache.get(baseUrl);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return cached.card;
        }

        // Try standard locations
        const urls = [
            `${baseUrl}/.well-known/agent-card.json`,
            `${baseUrl}/.well-known/agent.json`,
            `${baseUrl}/agent-card.json`
        ];

        for (const url of urls) {
            try {
                const response = await fetch(url, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(5000)
                });

                if (response.ok) {
                    const card = await response.json() as AgentCard;

                    // Cache the result
                    agentCardCache.set(baseUrl, { card, timestamp: Date.now() });

                    return card;
                }
            } catch (error) {
                continue;
            }
        }

        return undefined;
    }

    /**
     * Fetch agent card directly from URL.
     */
    async fetchAgentCardFromUrl(url: string): Promise<AgentCard | undefined> {
        try {
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json() as AgentCard;
        } catch (error) {
            logger.error('Failed to fetch agent card from URL', error as Error, { url });
            return undefined;
        }
    }

    /**
     * Get agent by ID (combines database and on-chain lookup).
     */
    async getAgentById(agentId: string): Promise<DiscoveredAgent | null> {
        // Try database first
        const { data, error } = await supabase
            .from('services')
            .select(`
                id,
                name,
                description,
                endpoint_url,
                owner_address,
                category,
                price_per_call,
                is_active,
                reputations (
                    reputation_score,
                    successful_payments,
                    total_payments
                )
            `)
            .eq('id', agentId)
            .single();

        if (data && !error) {
            const rep = Array.isArray(data.reputations)
                ? data.reputations[0]
                : data.reputations;

            const agent: DiscoveredAgent = {
                id: data.id,
                name: data.name,
                description: data.description || '',
                ownerAddress: data.owner_address,
                endpointUrl: data.endpoint_url || '',
                category: data.category,
                pricePerCall: data.price_per_call,
                reputationScore: rep?.reputation_score || 80,
                successRate: (rep?.total_payments || 0) > 0
                    ? ((rep?.successful_payments || 0) / rep.total_payments) * 100
                    : 100,
                source: 'database'
            };

            // Fetch agent card
            if (agent.endpointUrl) {
                agent.card = await this.fetchAgentCard(agent.endpointUrl);
            }

            return agent;
        }

        // Try on-chain if it's an on-chain ID
        if (agentId.startsWith('onchain_')) {
            const agents = await this.discoverFromOnChain(1);
            return agents.find(a => a.id === agentId) || null;
        }

        return null;
    }

    /**
     * Clear agent card cache.
     */
    clearCache(): void {
        agentCardCache.clear();
    }
}

export const agentDiscoveryService = new AgentDiscoveryService();
