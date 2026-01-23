/**
 * Dashboard & Explorer Types
 * 
 * Defines the schema for dashboard metrics, explorer views, and system status.
 */

// import { AgentType, InteractionMode } from './agent';

// ============================================
// EXPLORER DATA TYPES
// ============================================

export interface LatestBlock {
    blockNumber: number;
    timestamp: Date | string;
    txCount: number;
    gasUsed: string;
}

export interface SessionRecord {
    sessionId: string;
    owner: string;
    totalDeposited: string;
    totalSpent: string;
    state: 'active' | 'closed' | 'refunded';
    agentCount: number;
    createdAt: Date | string;
    lastActivity: Date | string;
}

export interface TransactionRecord {
    txHash: string;
    type: 'deposit' | 'release' | 'refund' | 'authorize' | 'revoke';
    from: string;
    to: string;
    value: string;
    status: 'success' | 'pending' | 'failed';
    timestamp: Date | string;
    blockNumber: number;
}

export interface AgentRecord {
    agentId: string;
    name: string;
    owner: string;
    sessionsActive: number;
    totalEarned: string;
    successRate: number;
    lastActive: Date | string;
}

export interface PaymentRecord {
    paymentId: string;
    from: string;
    to: string;
    amount: string;
    status: 'pending' | 'settled' | 'failed';
    timestamp: Date | string;
    txHash?: string;
    resourceUrl?: string;
    tokenAddress?: string;
}

export interface SessionDetail {
    sessionId: string;
    owner: string;
    totalDeposited: string;
    totalSpent: string;
    state: 'active' | 'closed' | 'refunded';
    createdAt: Date | string;
    lastActivity: Date | string;
    events: Array<{
        id: string;
        type: string;
        txHash: string;
        timestamp: Date | string;
        data: any;
    }>;
    agents: Array<{
        agentId: string;
        isAuthorized: boolean;
        totalSpend: string;
        authorizedAt: Date | string;
    }>;
}

export interface RWARecord {
    rwaId: string;
    currentState: string;
    previousState: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    transitionCount: number;
    lastAgent?: string;
}

// ============================================
// SYSTEM OBSERVABILITY TYPES
// ============================================

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: HealthCheck[];
    version: string;
    uptime: number;
}

export interface HealthCheck {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    latencyMs: number;
    message?: string;
    lastChecked: string;
}

export interface SystemMetrics {
    requestsTotal: number;
    requestsSuccessful?: number;
    requestsSuccess?: number;
    requestsFailed: number;
    averageLatencyMs?: number;
    avgLatencyMs?: number;
    memoryUsageMb: number;
    requestsPerMinute?: number[];
    activeConnections?: number;
    cpuPercent?: number;
    uptime?: number;
}

export interface Trace {
    traceId: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    timestamp: string;
}

export interface AlertRecord {
    id: string;
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: string;
    resolved: boolean;
}

// ============================================
// DASHBOARD STATS
// ============================================

export interface DashboardStats {
    totalSessions: number;
    activeAgents: number;
    totalVolume: string;
    successRate: number;
}

// ============================================
// API RESPONSES
// ============================================

export interface OverviewResponse {
    stats: DashboardStats;
    sessions: SessionRecord[];
    transactions: TransactionRecord[];
    agents: AgentRecord[];
    payments: PaymentRecord[];
}
