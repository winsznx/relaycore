/**
 * Agent Type Definitions
 * 
 * Defines the schema for agents in the Relay Core ecosystem.
 * Agents are autonomous components that can be invoked via API,
 * workflows, UI, or chat-assisted modes.
 */

// ============================================
// AGENT REGISTRATION
// ============================================

export type AgentType = 'research' | 'execution' | 'decision' | 'automation' | 'hybrid';

export type InteractionMode = 'api' | 'chat' | 'workflow' | 'trigger' | 'ui';

export type LatencyClass = 'low' | 'medium' | 'high';

/**
 * JSON Schema definition for agent input/output
 */
export interface JSONSchema {
    type: 'object' | 'string' | 'number' | 'boolean' | 'array';
    properties?: Record<string, JSONSchemaProperty>;
    required?: string[];
    items?: JSONSchema;
    description?: string;
}

export interface JSONSchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    default?: unknown;
    items?: JSONSchemaProperty;
    properties?: Record<string, JSONSchemaProperty>;
}

/**
 * Agent permissions configuration
 */
export interface AgentPermissions {
    /** Whether the agent can execute actions (vs read-only) */
    can_execute: boolean;

    /** Whether invocation requires x402 payment */
    requires_payment: boolean;

    /** Payment amount in USDC (6 decimals) - e.g., "10000" = 0.01 USDC */
    payment_amount?: string;

    /** Required authentication level */
    auth_level?: 'none' | 'wallet' | 'signature';
}

/**
 * Agent metadata
 */
export interface AgentMetadata {
    /** Version string (semver) */
    version: string;

    /** Expected latency class */
    latency_class: LatencyClass;

    /** Categories for discovery */
    categories: string[];

    /** Tags for search */
    tags?: string[];

    /** Agent icon URL */
    icon?: string;

    /** Documentation URL */
    docs_url?: string;

    /** Contact/support info */
    contact?: string;
}

/**
 * Agent registration request
 */
export interface AgentRegistration {
    /** Unique agent identifier (namespace.name format) */
    id: string;

    /** Owner wallet address */
    owner: string;

    /** Human-readable name */
    name: string;

    /** Description of what the agent does */
    description: string;

    /** Agent type classification */
    agent_type: AgentType;

    /** Supported interaction modes */
    interaction_modes: InteractionMode[];

    /** Input parameters schema */
    input_schema: JSONSchema;

    /** Output response schema */
    output_schema: JSONSchema;

    /** Permissions and payment requirements */
    permissions: AgentPermissions;

    /** Additional metadata */
    metadata: AgentMetadata;
}

/**
 * Registered agent with runtime info
 */
export interface RegisteredAgent extends AgentRegistration {
    /** Registration timestamp */
    registered_at: Date;

    /** Last activity timestamp */
    last_active?: Date;

    /** Is agent currently active */
    is_active: boolean;

    /** Is verified by Relay Core */
    is_verified: boolean;

    /** Current reputation score (0-100) */
    reputation_score: number;

    /** Total invocation count */
    total_invocations: number;

    /** Successful invocation count */
    successful_invocations: number;

    /** Average latency in ms */
    avg_latency_ms: number;
}

// ============================================
// AGENT INVOCATION
// ============================================

/**
 * Agent invocation request
 */
export interface AgentInvokeRequest {
    /** Agent ID to invoke */
    agent_id: string;

    /** Input parameters (must match agent's input_schema) */
    input: Record<string, unknown>;

    /** Caller wallet address (optional) */
    caller_address?: string;

    /** Payment ID if x402 payment was completed */
    payment_id?: string;

    /** Correlation ID for tracking */
    correlation_id?: string;
}

/**
 * Agent invocation result
 */
export interface AgentInvokeResult {
    /** Whether invocation succeeded */
    success: boolean;

    /** Agent ID that was invoked */
    agent_id: string;

    /** Result data (matches agent's output_schema) */
    result?: unknown;

    /** Error message if failed */
    error?: string;

    /** Error code if failed */
    error_code?: string;

    /** Execution time in ms */
    execution_time_ms: number;

    /** Timestamp of invocation */
    timestamp: Date;

    /** Correlation ID for tracking */
    correlation_id?: string;
}

/**
 * x402 payment required response
 */
export interface AgentPaymentRequired {
    status: 'payment_required';
    agent_id: string;
    x402: {
        amount: string;
        token: string;
        token_address: string;
        recipient: string;
        network: string;
        chain_id: number;
        resource: string;
        valid_until: string;
    };
}

// ============================================
// AGENT DISCOVERY
// ============================================

/**
 * Agent search filters
 */
export interface AgentFilters {
    /** Filter by agent type */
    agent_type?: AgentType;

    /** Filter by interaction mode */
    interaction_mode?: InteractionMode;

    /** Filter by category */
    category?: string;

    /** Minimum reputation score */
    min_reputation?: number;

    /** Only show verified agents */
    verified_only?: boolean;

    /** Search query (name/description) */
    query?: string;

    /** Sort field */
    sort_by?: 'reputation' | 'invocations' | 'latency' | 'recency';

    /** Sort direction */
    sort_order?: 'asc' | 'desc';

    /** Pagination limit */
    limit?: number;

    /** Pagination offset */
    offset?: number;
}

/**
 * Agent summary for listing
 */
export interface AgentSummary {
    id: string;
    name: string;
    description: string;
    agent_type: AgentType;
    interaction_modes: InteractionMode[];
    reputation_score: number;
    is_verified: boolean;
    total_invocations: number;
    success_rate: number;
    avg_latency_ms: number;
    price_usdc: number | null;
    categories: string[];
}

/**
 * Agent list response
 */
export interface AgentListResponse {
    agents: AgentSummary[];
    total: number;
    page: number;
    page_size: number;
}

// ============================================
// AGENT METRICS
// ============================================

/**
 * Agent invocation metrics for tracking
 */
export interface AgentInvocationMetrics {
    agent_id: string;
    timestamp: Date;
    latency_ms: number;
    success: boolean;
    error_type?: string;
    payment_settled: boolean;
    payment_amount?: string;
    caller_address?: string;
    correlation_id?: string;
}

/**
 * Detailed agent metrics
 */
export interface AgentDetailedMetrics {
    agent_id: string;
    period: {
        from: Date;
        to: Date;
    };
    totals: {
        invocations: number;
        successful: number;
        failed: number;
        success_rate: number;
    };
    latency: {
        avg_ms: number;
        median_ms: number;
        p95_ms: number;
        p99_ms: number;
    };
    payments: {
        total_amount: string;
        total_count: number;
        unique_payers: number;
    };
    time_series: Array<{
        timestamp: Date;
        invocations: number;
        avg_latency_ms: number;
        success_rate: number;
    }>;
}
