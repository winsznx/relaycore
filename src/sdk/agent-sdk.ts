/**
 * Relay Core Agent SDK
 * 
 * Enables AI agents to interact with Relay Core:
 * - Register services (on-chain + off-chain)
 * - Discover other agents
 * - Pay for services (x402)
 * - Submit feedback
 */

import { createSupabaseClient } from './lib/supabase';
import { FacilitatorClient } from './lib/facilitator';
import type { PaymentRequirements, CronosNetwork } from '@crypto.com/facilitator-client';
import { uploadAgentMetadataToIPFS, buildAgentMetadata } from './lib/ipfs';
import { registerAgent as registerAgentOnChain } from './lib/erc8004';
import { ethers } from 'ethers';
import { SupabaseClient } from '@supabase/supabase-js';

// SDK Configuration
export interface SDKConfig {
    apiKey?: string;           // API key for authenticated access
    walletAddress: string;      // Agent's wallet address
    rpcUrl?: string;            // Cronos RPC URL
    baseUrl?: string;           // Relay Core API URL (default: localhost:4000)
    supabaseUrl?: string;
    supabaseKey?: string;
    contracts?: {
        identityRegistry?: string;
    };
}

export interface AgentService {
    serviceId?: string;
    name: string;
    description: string;
    serviceType: string;
    pricePerRequest: string;    // in USDC
    endpoint: string;
    agentAddress?: string;
}

export interface AgentProfile {
    address: string;
    agentId?: number;           // On-chain agent ID
    name?: string;
    services: AgentService[];
    reputationScore: number;
    successRate: number;
}

export interface RegisterAgentResult {
    agentId: number;
    txHash: string;
    ipfsUri: string;
}

/**
 * Relay Core Agent SDK
 */
export class AgentSDK {
    private config: SDKConfig;
    private headers: Record<string, string>;
    private supabase: SupabaseClient | null = null;
    private facilitator: FacilitatorClient;

    constructor(config: SDKConfig) {
        this.config = {
            rpcUrl: 'https://evm-t3.cronos.org',
            baseUrl: 'http://localhost:4000',
            ...config,
        };

        // Set up headers with API key if provided
        this.headers = {
            'Content-Type': 'application/json',
        };

        if (config.apiKey) {
            this.headers['x-api-key'] = config.apiKey;
        }

        // Initialize Supabase if config provided
        if (config.supabaseUrl && config.supabaseKey) {
            this.supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
        }

        // Initialize Facilitator
        // Determining network from RPC URL is heuristics, might be better to explicitly ask for network
        // For now defaulting to testnet
        this.facilitator = new FacilitatorClient('cronos-testnet' as CronosNetwork);
    }

    /**
     * Register an agent on-chain with IPFS metadata
     * 
     * Requires a signer (wallet) to submit the transaction.
     */
    async registerAgentOnChain(
        service: Omit<AgentService, 'agentAddress' | 'serviceId'>,
        signer: ethers.Signer
    ): Promise<RegisterAgentResult> {
        // Build and upload metadata to IPFS
        const metadata = buildAgentMetadata({
            name: service.name,
            description: service.description,
            serviceType: service.serviceType,
            endpoint: service.endpoint,
            pricePerRequest: service.pricePerRequest,
        });

        // Use base URL for IPFS upload proxy
        const ipfsUri = await uploadAgentMetadataToIPFS(metadata, this.config.baseUrl || 'http://localhost:4000');

        // Register on-chain
        const { agentId, txHash } = await registerAgentOnChain(
            ipfsUri,
            this.config.walletAddress,
            signer,
            this.config.contracts?.identityRegistry || '0x4b697D8ABC0e3dA0086011222755d9029DBB9C43'
        );

        // Also save to Supabase for discoverability
        await this.registerServiceOffChain({
            ...service,
            serviceId: `agent-${agentId}`,
        });

        return { agentId, txHash, ipfsUri };
    }

    /**
     * Register a service (off-chain only, for discovery)
     */
    async registerServiceOffChain(service: Omit<AgentService, 'agentAddress'>): Promise<void> {
        // Use API if available
        if (this.config.apiKey) {
            const response = await fetch(`${this.config.baseUrl}/api/services`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    ...service,
                    agentAddress: this.config.walletAddress,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Failed to register service: ${error.error}`);
            }

            console.log(`Service registered: ${service.name}`);
            return;
        }

        // Fallback to direct Supabase
        if (!this.supabase) {
            console.warn('Supabase not configured. Off-chain service registration skiped.');
            return;
        }

        const { error } = await this.supabase.from('agent_activity').insert({
            agent_address: this.config.walletAddress,
            activity_type: 'service_registered',
            metadata: {
                serviceId: service.serviceId,
                name: service.name,
                description: service.description,
                serviceType: service.serviceType,
                pricePerRequest: service.pricePerRequest,
                endpoint: service.endpoint,
            },
            timestamp: new Date().toISOString(),
        });

        if (error) throw new Error(`Failed to register service: ${error.message}`);

        console.log(`Service registered: ${service.name}`);
    }

    /**
     * Discover agents by service type
     */
    async discoverAgents(serviceType: string, minReputation: number = 0): Promise<AgentProfile[]> {
        // Use API for discovery
        if (this.config.apiKey) {
            const response = await fetch(
                `${this.config.baseUrl}/api/agents?serviceType=${serviceType}&minReputation=${minReputation}`,
                { headers: this.headers }
            );

            if (!response.ok) {
                throw new Error('Failed to discover agents');
            }

            return response.json();
        }

        // Fallback to direct Supabase query
        if (!this.supabase) {
            throw new Error('Supabase not configured. Cannot discover agents without API Key or Supabase credentials.');
        }

        const { data: activities, error: actError } = await this.supabase
            .from('agent_activity')
            .select('agent_address, metadata')
            .eq('activity_type', 'service_registered')
            .contains('metadata', { serviceType });

        if (actError) throw new Error(`Failed to discover agents: ${actError.message}`);

        if (!activities || activities.length === 0) return [];

        const agentAddresses = [...new Set(activities.map((a: any) => a.agent_address))];

        const { data: reputations, error: repError } = await this.supabase
            .from('agent_reputation')
            .select('*')
            .in('agent_address', agentAddresses)
            .gte('reputation_score', minReputation);

        if (repError) throw new Error(`Failed to get reputations: ${repError.message}`);

        const profiles: AgentProfile[] = [];

        for (const address of agentAddresses) {
            const agentActivities = activities.filter((a: any) => a.agent_address === address);
            const reputation = reputations?.find((r: any) => r.agent_address === address);

            const services: AgentService[] = agentActivities.map((a: any) => ({
                serviceId: a.metadata.serviceId,
                name: a.metadata.name,
                description: a.metadata.description,
                serviceType: a.metadata.serviceType,
                pricePerRequest: a.metadata.pricePerRequest,
                endpoint: a.metadata.endpoint,
                agentAddress: address as string,
            }));

            const total = (reputation?.successful_transactions || 0) + (reputation?.failed_transactions || 0);
            const successRate = total > 0 ? (reputation?.successful_transactions || 0) / total : 0;

            profiles.push({
                address: address as string,
                services,
                reputationScore: reputation?.reputation_score || 0,
                successRate,
            });
        }

        return profiles.sort((a, b) => b.reputationScore - a.reputationScore);
    }

    /**
     * Get agent reputation
     */
    async getReputation(address: string): Promise<number> {
        if (!this.supabase) {
            return 0; // Or throw error
        }

        const { data, error } = await this.supabase
            .from('agent_reputation')
            .select('reputation_score')
            .eq('agent_address', address)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return 0;
            throw new Error(`Failed to get reputation: ${error.message}`);
        }

        return data.reputation_score;
    }

    /**
     * Pay for a service using x402
     */
    async payForService(params: {
        serviceId: string;
        agentAddress: string;
        amount: string;
        signer: any;
    }): Promise<{ paymentId: string; txHash: string }> {
        const paymentRequirements = this.facilitator.generatePaymentRequirements({
            merchantAddress: params.agentAddress,
            amount: params.amount,
            resourceUrl: `https://relaycore.xyz/api/services/${params.serviceId}`,
            description: `Payment for service ${params.serviceId}`,
        });

        const facilitator = this.facilitator.getFacilitator();
        const now = Math.floor(Date.now() / 1000);
        const paymentHeader = await facilitator.generatePaymentHeader({
            to: params.agentAddress,
            value: paymentRequirements.maxAmountRequired,
            asset: paymentRequirements.asset,
            signer: params.signer,
            validAfter: now - 60,
            validBefore: now + 300,
        });

        const result = await this.facilitator.settlePayment({
            paymentHeader,
            paymentRequirements,
        });

        const txHash = result.txHash || '';
        const paymentId = `pay_${txHash.slice(2, 18)}`;

        console.log(`Payment settled: ${txHash}`);

        return { paymentId, txHash };
    }

    /**
     * Call a protected service endpoint with automatic payment
     */
    async callService(params: {
        endpoint: string;
        paymentRequirements: PaymentRequirements;
        signer: any;
    }): Promise<any> {
        let response = await fetch(params.endpoint, { headers: this.headers });

        if (response.status === 402) {
            await response.json();

            const facilitator = this.facilitator.getFacilitator();
            const now = Math.floor(Date.now() / 1000);
            const paymentHeader = await facilitator.generatePaymentHeader({
                to: params.paymentRequirements.payTo,
                value: params.paymentRequirements.maxAmountRequired,
                asset: params.paymentRequirements.asset,
                signer: params.signer,
                validAfter: now - 60,
                validBefore: now + (params.paymentRequirements.maxTimeoutSeconds || 300),
            });

            const result = await this.facilitator.settlePayment({
                paymentHeader,
                paymentRequirements: params.paymentRequirements,
            });

            const txHash = result.txHash || '';
            const paymentId = `pay_${txHash.slice(2, 18)}`;

            response = await fetch(params.endpoint, {
                headers: {
                    ...this.headers,
                    'x-payment-id': paymentId,
                },
            });
        }

        if (!response.ok) {
            throw new Error(`Service call failed: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Validate the API key
     */
    async validateApiKey(): Promise<boolean> {
        if (!this.config.apiKey) return false;

        try {
            const response = await fetch(`${this.config.baseUrl}/api/auth/validate`, {
                headers: this.headers,
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

/**
 * Create an Agent SDK instance
 * 
 * @example
 * ```typescript
 * const sdk = createAgentSDK({
 *     apiKey: 'rc_xxxxx',
 *     walletAddress: '0x1234...',
 * });
 * ```
 */
export function createAgentSDK(config: SDKConfig): AgentSDK {
    return new AgentSDK(config);
}
