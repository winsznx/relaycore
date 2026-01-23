/**
 * Agent Discovery API
 * 
 * REST endpoints for discovering agents via multiple sources:
 * - Database lookup
 * - URL-based agent card fetching
 * - On-chain registry
 * 
 * Phase 6 Implementation - End-to-End Agent Discovery
 */

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import logger from '../lib/logger.js';
import { ethers } from 'ethers';

const router = Router();

// Agent card cache
const agentCardCache = new Map<string, { card: AgentCard; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface AgentCard {
    name: string;
    description?: string;
    url: string;
    version?: string;
    network?: string;
    capabilities?: string[];
    resources?: Array<{
        id: string;
        title: string;
        description?: string;
        url: string;
        paywall?: {
            protocol: string;
            settlement?: string;
        };
    }>;
    x402?: {
        payeeAddress: string;
        tokenAddress?: string;
    };
    contracts?: Record<string, string>;
}

interface DiscoveredAgent {
    id: string;
    name: string;
    description: string;
    ownerAddress: string;
    endpointUrl: string;
    category?: string;
    pricePerCall?: string;
    reputationScore: number;
    successRate: number;
    avgLatencyMs?: number;
    source: 'database' | 'onchain' | 'url';
    card?: AgentCard;
    x402Enabled?: boolean;
}

// ============================================
// AGENT DISCOVERY ENDPOINTS
// ============================================

/**
 * GET /api/agents/discover
 * 
 * Discover agents with filtering options.
 */
router.get('/discover', async (req, res) => {
    try {
        const {
            capability,
            category,
            minReputation = 0,
            maxPrice,
            limit = 20,
            includeCards = 'true'
        } = req.query;

        // Query database for agents/services
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
                    total_payments,
                    avg_latency_ms
                )
            `)
            .eq('is_active', true);

        if (category) {
            query = query.eq('category', category);
        }

        if (maxPrice) {
            query = query.lte('price_per_call', maxPrice);
        }

        const { data: services, error } = await query.limit(Number(limit));

        if (error) {
            logger.error('Agent discovery query failed', error);
            return res.status(500).json({ error: 'Discovery failed' });
        }

        // Transform to DiscoveredAgent format
        const agents: DiscoveredAgent[] = [];

        for (const service of services || []) {
            const rep = Array.isArray(service.reputations)
                ? service.reputations[0]
                : service.reputations;

            const reputationScore = rep?.reputation_score || 80;
            const totalPayments = rep?.total_payments || 0;
            const successfulPayments = rep?.successful_payments || 0;

            // Filter by reputation
            if (reputationScore < Number(minReputation)) continue;

            const agent: DiscoveredAgent = {
                id: service.id,
                name: service.name,
                description: service.description || '',
                ownerAddress: service.owner_address,
                endpointUrl: service.endpoint_url || '',
                category: service.category,
                pricePerCall: service.price_per_call,
                reputationScore,
                successRate: totalPayments > 0
                    ? (successfulPayments / totalPayments) * 100
                    : 100,
                avgLatencyMs: rep?.avg_latency_ms,
                source: 'database'
            };

            // Fetch agent card if requested
            if (includeCards === 'true' && agent.endpointUrl) {
                try {
                    agent.card = await fetchAgentCard(agent.endpointUrl);
                    agent.x402Enabled = !!agent.card?.x402 ||
                        agent.card?.resources?.some(r => r.paywall);

                    // Filter by capability if specified
                    if (capability && agent.card) {
                        const hasCapability =
                            agent.card.capabilities?.includes(String(capability)) ||
                            agent.card.resources?.some(r =>
                                r.id.includes(String(capability)) ||
                                r.title.toLowerCase().includes(String(capability).toLowerCase())
                            );
                        if (!hasCapability) continue;
                    }
                } catch (cardError) {
                    // Agent card fetch failed, continue without it
                    logger.debug('Agent card fetch failed', { url: agent.endpointUrl });
                }
            }

            agents.push(agent);
        }

        // Sort by reputation
        agents.sort((a, b) => b.reputationScore - a.reputationScore);

        res.json({
            success: true,
            count: agents.length,
            agents
        });
    } catch (error) {
        logger.error('Agent discovery error', error as Error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/agents/fetch-card
 * 
 * Fetch agent card from any URL.
 */
router.post('/fetch-card', async (req, res) => {
    try {
        const { url, fullUrl = false } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const card = await fetchAgentCard(url, fullUrl);

        if (!card) {
            return res.status(404).json({
                success: false,
                error: 'No agent card found',
                triedUrls: fullUrl ? [url] : [
                    `${url.replace(/\/$/, '')}/.well-known/agent-card.json`,
                    `${url.replace(/\/$/, '')}/.well-known/agent.json`,
                    `${url.replace(/\/$/, '')}/agent-card.json`
                ]
            });
        }

        res.json({
            success: true,
            card
        });
    } catch (error) {
        logger.error('Agent card fetch error', error as Error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to fetch agent card'
        });
    }
});

/**
 * GET /api/agents/:id
 * 
 * Get agent by ID.
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: service, error } = await supabase
            .from('services')
            .select(`
                *,
                reputations (
                    reputation_score,
                    successful_payments,
                    total_payments,
                    avg_latency_ms
                )
            `)
            .eq('id', id)
            .single();

        if (error || !service) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const rep = Array.isArray(service.reputations)
            ? service.reputations[0]
            : service.reputations;

        const agent: DiscoveredAgent = {
            id: service.id,
            name: service.name,
            description: service.description || '',
            ownerAddress: service.owner_address,
            endpointUrl: service.endpoint_url || '',
            category: service.category,
            pricePerCall: service.price_per_call,
            reputationScore: rep?.reputation_score || 80,
            successRate: (rep?.total_payments || 0) > 0
                ? ((rep?.successful_payments || 0) / rep.total_payments) * 100
                : 100,
            avgLatencyMs: rep?.avg_latency_ms,
            source: 'database'
        };

        // Fetch agent card
        if (agent.endpointUrl) {
            try {
                agent.card = await fetchAgentCard(agent.endpointUrl);
                agent.x402Enabled = !!agent.card?.x402 ||
                    agent.card?.resources?.some(r => r.paywall);
            } catch {
                // Continue without card
            }
        }

        res.json({
            success: true,
            agent
        });
    } catch (error) {
        logger.error('Agent fetch error', error as Error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/agents/:id/resources
 * 
 * List resources from agent's card.
 */
router.get('/:id/resources', async (req, res) => {
    try {
        const { id } = req.params;

        // Get agent endpoint
        const { data: service, error } = await supabase
            .from('services')
            .select('endpoint_url, name')
            .eq('id', id)
            .single();

        if (error || !service?.endpoint_url) {
            return res.status(404).json({ error: 'Agent not found or no endpoint' });
        }

        const card = await fetchAgentCard(service.endpoint_url);

        if (!card) {
            return res.status(404).json({ error: 'No agent card found' });
        }

        const resources = (card.resources || []).map((r, index) => ({
            index,
            id: r.id,
            title: r.title,
            description: r.description || '',
            url: r.url,
            fullUrl: r.url.startsWith('http')
                ? r.url
                : `${card.url || service.endpoint_url.replace(/\/$/, '')}${r.url}`,
            hasPaywall: !!r.paywall,
            paywall: r.paywall
        }));

        res.json({
            success: true,
            agentId: id,
            agentName: service.name,
            resourceCount: resources.length,
            resources
        });
    } catch (error) {
        logger.error('Resources fetch error', error as Error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/agents/validate
 * 
 * Validate if a URL hosts a valid A2A agent.
 */
router.post('/validate', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const card = await fetchAgentCard(url);

        if (!card) {
            return res.json({
                valid: false,
                url,
                reason: 'No agent card found at well-known locations',
                suggestion: 'Agent must serve /.well-known/agent-card.json'
            });
        }

        // Validate required fields
        const issues: string[] = [];
        if (!card.name) issues.push("Missing 'name' field");
        if (!card.url) issues.push("Missing 'url' field");
        if (!card.resources || !Array.isArray(card.resources)) {
            issues.push("Missing or invalid 'resources' array");
        }

        const hasX402 = !!card.x402 || card.resources?.some(r => r.paywall);

        res.json({
            valid: issues.length === 0,
            url,
            agentName: card.name || 'Unknown',
            resourceCount: (card.resources || []).length,
            x402Enabled: hasX402,
            issues: issues.length > 0 ? issues : undefined,
            capabilities: card.capabilities || [],
            card: issues.length === 0 ? card : undefined
        });
    } catch (error) {
        logger.error('Agent validation error', error as Error);
        res.json({
            valid: false,
            url: req.body.url,
            reason: error instanceof Error ? error.message : 'Validation failed'
        });
    }
});

/**
 * GET /api/agents/onchain
 * 
 * Discover agents from on-chain registry.
 */
router.get('/onchain', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const registryAddress = process.env.IDENTITY_REGISTRY_ADDRESS;

        if (!registryAddress) {
            return res.json({
                success: true,
                agents: [],
                message: 'Identity registry not configured'
            });
        }

        const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        const registry = new ethers.Contract(registryAddress, [
            'function totalAgents() view returns (uint256)',
            'function getAgent(uint256) view returns (address owner, string memory agentURI, bool isActive)'
        ], provider);

        const total = await registry.totalAgents();
        const agents: DiscoveredAgent[] = [];

        const start = Math.max(1, Number(total) - Number(limit));

        for (let i = Number(total); i >= start && agents.length < Number(limit); i--) {
            try {
                const [owner, agentURI, isActive] = await registry.getAgent(i);
                if (!isActive) continue;

                const endpointUrl = resolveAgentURI(agentURI);
                let card: AgentCard | undefined;

                try {
                    card = await fetchAgentCard(endpointUrl);
                } catch {
                    // Continue without card
                }

                agents.push({
                    id: `onchain_${i}`,
                    name: card?.name || `Agent #${i}`,
                    description: card?.description || '',
                    ownerAddress: owner,
                    endpointUrl,
                    reputationScore: 80,
                    successRate: 100,
                    source: 'onchain',
                    card,
                    x402Enabled: !!card?.x402
                });
            } catch {
                continue;
            }
        }

        res.json({
            success: true,
            count: agents.length,
            totalOnChain: Number(total),
            agents
        });
    } catch (error) {
        logger.error('On-chain discovery error', error as Error);
        res.status(500).json({ error: 'Failed to query on-chain registry' });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchAgentCard(baseUrl: string, fullUrl = false): Promise<AgentCard | undefined> {
    // Check cache
    const cached = agentCardCache.get(baseUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.card;
    }

    const urlsToTry = fullUrl
        ? [baseUrl]
        : [
            `${baseUrl.replace(/\/$/, '')}/.well-known/agent-card.json`,
            `${baseUrl.replace(/\/$/, '')}/.well-known/agent.json`,
            `${baseUrl.replace(/\/$/, '')}/agent-card.json`
        ];

    for (const url of urlsToTry) {
        try {
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const card = await response.json() as AgentCard;

                // Cache result
                agentCardCache.set(baseUrl, { card, timestamp: Date.now() });

                return card;
            }
        } catch {
            continue;
        }
    }

    return undefined;
}

function resolveAgentURI(uri: string): string {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
        return uri;
    }
    if (uri.startsWith('ipfs://')) {
        return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
    }
    if (uri.startsWith('ar://')) {
        return `https://arweave.net/${uri.replace('ar://', '')}`;
    }
    return uri;
}

export default router;
