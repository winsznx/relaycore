/**
 * Session Types - Matching Database Schema (migration 20260120)
 */

export interface Session {
    id: string; // UUID
    session_id: string; // TEXT unique identifier
    owner_address: string;
    escrow_agent: string; // Changed from escrow_agent_address
    max_spend: string;
    expiry: string; // Changed from expires_at
    deposited: string;
    released: string;
    is_active: boolean; // Changed from status
    created_at: string;
    created_tx_hash: string;
    created_block: number;
    closed_at?: string;
    closed_tx_hash?: string;
    closed_block?: number;
    updated_at: string;
}

export interface SessionPayment {
    id: string; // UUID
    session_id: string; // TEXT reference
    agent_address: string;
    agent_name?: string;
    amount: string;
    tx_hash?: string;
    payment_method: 'x402' | 'escrow' | 'direct';
    metadata?: Record<string, any>;
    created_at: string;
}

export interface CreateSessionParams {
    ownerAddress: string;
    maxSpend: string;
    durationHours: number;
    authorizedAgents?: string[];
}

export interface SessionBudgetCheck {
    canAfford: boolean;
    remaining: string;
    released: string; // Changed from spent
    maxSpend: string;
    reason?: string;
}

export interface RecordPaymentParams {
    agentAddress: string;
    agentName?: string;
    amount: string;
    txHash?: string;
    paymentMethod?: 'x402' | 'escrow' | 'direct';
    metadata?: Record<string, any>;
}

export interface SessionStats {
    totalSessions: number;
    activeSessions: number;
    totalReleased: string; // Changed from totalSpent
    totalPayments: number;
    averageSpendPerSession: string;
}

export interface SessionSummary {
    session: Session;
    payments: SessionPayment[];
    stats: {
        totalReleased: string; // Changed from totalSpent
        paymentCount: number;
        remaining: string;
        utilizationPercent: number;
    };
}
