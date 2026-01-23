/**
 * Meta-Agent Types
 * Agent discovery, evaluation, and hiring
 */

export interface AgentCard {
    name: string;
    description: string;
    url: string;
    network: string;
    resources: AgentResource[];
}

export interface AgentResource {
    id: string;
    title: string;
    description?: string;
    url: string;
    paywall: {
        protocol: 'x402';
        settlement: string;
    };
}

export interface AgentDiscoveryQuery {
    capability?: string;
    category?: string;
    minReputation?: number;
    maxPricePerCall?: string;
    isActive?: boolean;
    limit?: number;
}

export interface AgentScore {
    agentId: string;
    agentName: string;
    agentUrl: string;
    ownerAddress: string;
    reputationScore: number;
    pricePerCall: string;
    successRate: number;
    avgLatencyMs: number;
    compositeScore: number;
    card?: AgentCard;
}

export interface HireAgentRequest {
    agentId: string;
    resourceId: string;
    budget: string;
    task: Record<string, unknown>;
    maxRetries?: number;
}

export interface HireAgentResult {
    success: boolean;
    taskId: string;
    agentId: string;
    paymentId?: string;
    cost: string;
    estimatedCompletion?: string;
    paymentMethod?: 'session' | 'escrow' | 'direct';
    paymentTxHash?: string;
    escrowSessionId?: number;
}

export interface DelegationOutcome {
    taskId: string;
    agentId: string;
    state: 'pending' | 'settled' | 'failed';
    paymentId?: string;
    cost: string;
    outputs?: Record<string, unknown>;
    error?: {
        code: string;
        message: string;
    };
    metrics?: {
        total_ms: number;
        payment_ms?: number;
        execution_ms?: number;
    };
}
