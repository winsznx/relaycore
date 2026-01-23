/**
 * Playground Type Definitions
 * Production-grade types for graph-based execution surface
 */

import type { Node, Edge } from '@xyflow/react';

// =============================================================================
// EXECUTION MODES
// =============================================================================

export type ExecutionMode = 'mock' | 'real';

export type ExecutionState =
    | 'idle'
    | 'planning'
    | 'blocked'      // Waiting for payment
    | 'authorized'   // Payment settled
    | 'executing'
    | 'completed'
    | 'failed';

// =============================================================================
// NODE DATA TYPES
// =============================================================================

export interface BaseNodeData {
    label: string;
    status: ExecutionState;
    executionMode: ExecutionMode;
    createdAt: Date;
    updatedAt: Date;
}

export interface AgentNodeData extends BaseNodeData {
    type: 'agent';
    agentId?: string;
    agentType: string;
    tools: string[];
    costIncurred: number;
    paymentsSent: Payment[];
    paymentsReceived: Payment[];
    sessionId?: string;
    toolCalls: ToolCall[];
    memory?: Record<string, any>;
}

export interface X402GateNodeData extends BaseNodeData {
    type: 'x402_gate';
    price: number;
    asset: string;
    recipientAddress: string;
    paymentId?: string;
    paymentStatus: 'pending' | 'authorized' | 'settled' | 'failed';
    settlementTxHash?: string;
    blockNumber?: number;
    challengeTimestamp?: Date;
    settlementTimestamp?: Date;
}

export interface SessionNodeData extends BaseNodeData {
    type: 'session';
    sessionId: string;
    ownerAddress: string;
    maxSpend: number;
    deposited: number;
    released: number;
    remaining: number;
    expiresAt: Date;
    authorizedAgents: string[];
    events: SessionEvent[];
    isActive: boolean;
}

export interface WalletNodeData extends BaseNodeData {
    type: 'wallet';
    address: string;
    balance: number;
    chainId: number;
    pendingTransactions: PendingTransaction[];
    handoffUrl?: string;
}

export interface IndexerNodeData extends BaseNodeData {
    type: 'indexer';
    blockHeight: number;
    latency: number;
    eventStream: IndexerEvent[];
    dataFreshness: 'live' | 'stale' | 'error';
    lastUpdate: Date;
}

export interface EndpointNodeData extends BaseNodeData {
    type: 'endpoint';
    url: string;
    method: string;
    x402Protected: boolean;
    pricePerCall?: number;
    responseTime: number;
    successRate: number;
    callHistory: EndpointCall[];
}

export interface EscrowNodeData extends BaseNodeData {
    type: 'escrow';
    contractAddress: string;
    locked: number;
    state: string;
}

export interface PaymentNodeData extends BaseNodeData {
    type: 'payment';
    amount: number;
    asset: string;
    status: string;
}

export type PlaygroundNodeData =
    | AgentNodeData
    | X402GateNodeData
    | SessionNodeData
    | WalletNodeData
    | IndexerNodeData
    | EndpointNodeData
    | EscrowNodeData
    | PaymentNodeData;

// =============================================================================
// EDGE DATA TYPES
// =============================================================================

export interface EdgeData {
    state: ExecutionState;
    triggerCondition?: string;
    valueTransferred?: number;
    asset?: string;
    executionTime?: Date;
}

export type PlaygroundEdge = Edge<EdgeData>;
export type PlaygroundNode = Node<PlaygroundNodeData>;

// =============================================================================
// EXECUTION LOG
// =============================================================================

export interface ExecutionLogEntry {
    id: string;
    timestamp: Date;
    level: 'info' | 'success' | 'warning' | 'error';
    category: 'agent' | 'payment' | 'session' | 'indexer' | 'system';
    message: string;
    nodeId?: string;
    edgeId?: string;
    metadata?: Record<string, any>;
}

// =============================================================================
// SUPPORTING TYPES
// =============================================================================

export interface Payment {
    paymentId: string;
    amount: number;
    asset: string;
    from: string;
    to: string;
    txHash?: string;
    status: 'pending' | 'settled' | 'failed';
    timestamp: Date;
}

export interface ToolCall {
    toolName: string;
    params: Record<string, any>;
    result?: any;
    error?: string;
    duration: number;
    timestamp: Date;
}

export interface SessionEvent {
    eventType: 'DEPOSIT' | 'RELEASE' | 'REFUND' | 'CLOSE' | 'AUTHORIZE' | 'REVOKE';
    actorAddress?: string;
    amount?: number;
    txHash: string;
    blockNumber: number;
    timestamp: Date;
}

export interface PendingTransaction {
    transactionId: string;
    to: string;
    data: string;
    value: string;
    status: 'pending' | 'signed' | 'broadcast' | 'confirmed' | 'failed';
    handoffUrl?: string;
    createdAt: Date;
}

export interface IndexerEvent {
    eventType: string;
    contractAddress: string;
    txHash: string;
    blockNumber: number;
    data: Record<string, any>;
    timestamp: Date;
}

export interface EndpointCall {
    callId: string;
    method: string;
    statusCode: number;
    responseTime: number;
    success: boolean;
    timestamp: Date;
}

// =============================================================================
// INSPECTOR PANEL
// =============================================================================

export interface InspectorData {
    nodeId: string;
    nodeType: string;
    data: PlaygroundNodeData;
    connectedEdges: PlaygroundEdge[];
    executionHistory: ExecutionLogEntry[];
}

// =============================================================================
// GRAPH EXPORT/IMPORT
// =============================================================================

export interface PlaygroundExport {
    version: string;
    mode: ExecutionMode;
    nodes: PlaygroundNode[];
    edges: PlaygroundEdge[];
    config: {
        chainId: number;
        facilitatorUrl: string;
        mcpServerUrl?: string;
    };
    executionLog: ExecutionLogEntry[];
    exportedAt: Date;
}

// =============================================================================
// REALTIME UPDATES
// =============================================================================

export interface RealtimeUpdate {
    type: 'node_update' | 'edge_update' | 'log_entry' | 'indexer_event';
    nodeId?: string;
    edgeId?: string;
    data: any;
    timestamp: Date;
}
