/**
 * Escrow Agent Registration
 * 
 * Registers the ACPS Escrow Agent as a service in Relay Core.
 */

import { supabase } from '../../lib/supabase';
import logger from '../../lib/logger';

export const ESCROW_AGENT_CONFIG = {
    name: 'Escrow Agent',
    serviceType: 'escrow',
    description: 'Agent-Controlled Payment Sessions for autonomous agent execution',
    pricePerRequest: '0',
    endpoint: '/api/escrow',
    capabilities: [
        'session_create',
        'session_deposit',
        'session_release',
        'session_refund',
        'session_close',
        'agent_authorization'
    ],
    supportedAssets: ['USDC'],
    version: '1.0.0'
};

export async function registerEscrowAgent(ownerAddress: string, contractAddress: string): Promise<string> {
    const agentId = `escrow_agent_${Date.now()}`;

    try {
        const { error } = await supabase.from('services').insert({
            id: agentId,
            name: ESCROW_AGENT_CONFIG.name,
            service_type: ESCROW_AGENT_CONFIG.serviceType,
            description: ESCROW_AGENT_CONFIG.description,
            price_per_request: ESCROW_AGENT_CONFIG.pricePerRequest,
            endpoint: ESCROW_AGENT_CONFIG.endpoint,
            owner_address: ownerAddress,
            contract_address: contractAddress,
            capabilities: ESCROW_AGENT_CONFIG.capabilities,
            status: 'active',
            created_at: new Date().toISOString()
        });

        if (error) throw new Error(error.message);

        logger.info('Escrow Agent registered', { agentId, contractAddress });
        return agentId;
    } catch (error) {
        logger.error('Failed to register Escrow Agent', error as Error);
        throw error;
    }
}

export async function getEscrowAgentInfo(): Promise<{
    name: string;
    serviceType: string;
    capabilities: string[];
    contractAddress: string | null;
    status: string;
}> {
    try {
        const { data } = await supabase
            .from('services')
            .select('*')
            .eq('service_type', 'escrow')
            .single();

        return {
            name: data?.name || ESCROW_AGENT_CONFIG.name,
            serviceType: 'escrow',
            capabilities: data?.capabilities || ESCROW_AGENT_CONFIG.capabilities,
            contractAddress: data?.contract_address || process.env.ESCROW_CONTRACT_ADDRESS || null,
            status: data?.status || 'not_deployed'
        };
    } catch {
        return {
            name: ESCROW_AGENT_CONFIG.name,
            serviceType: 'escrow',
            capabilities: ESCROW_AGENT_CONFIG.capabilities,
            contractAddress: process.env.ESCROW_CONTRACT_ADDRESS || null,
            status: 'not_deployed'
        };
    }
}
