/**
 * Chat Service Types
 * 
 * Defines the chat API contract per the In-App Chat Architecture specification.
 * Chat is a control plane + explainer + orchestrator, NOT an executor.
 */

export type ChatMode = 'explain' | 'simulate' | 'plan' | 'observe';

export type ChatResponseType = 'explanation' | 'simulation' | 'plan' | 'observation' | 'error';

/**
 * Chat request structure
 */
export interface ChatRequest {
    /** User's query */
    query: string;
    /** Operating mode */
    mode: ChatMode;
    /** Context for the request */
    context?: {
        sessionId?: string;
        agentId?: string;
        taskId?: string;
        walletAddress?: string;
    };
    /** Conversation history */
    history?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}

/**
 * Proposed action that requires user approval
 */
export interface ChatAction {
    /** Human-readable label */
    label: string;
    /** API endpoint to call */
    endpoint: string;
    /** HTTP method */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    /** Request body */
    body: Record<string, unknown>;
    /** Whether this action requires explicit user approval */
    requiresApproval: boolean;
    /** Estimated cost if applicable */
    estimatedCost?: {
        amount: string;
        currency: string;
    };
    /** Risk level */
    riskLevel?: 'low' | 'medium' | 'high';
}

/**
 * Simulation result for dry-run operations
 */
export interface SimulationResult {
    /** What would happen */
    description: string;
    /** Expected outcome */
    expectedOutcome: {
        success: boolean;
        estimatedResult?: Record<string, unknown>;
    };
    /** Potential risks */
    risks?: string[];
    /** Required confirmations */
    confirmations?: string[];
    /** Gas/fee estimate */
    estimatedFees?: {
        gas?: string;
        payment?: string;
        total?: string;
    };
}

/**
 * Chat response structure
 */
export interface ChatResponse {
    /** Response type */
    type: ChatResponseType;
    /** Main content (human-readable) */
    content: string;
    /** Structured data */
    data?: Record<string, unknown>;
    /** Actions user can take (require approval) */
    actions?: ChatAction[];
    /** Simulation results (for simulate mode) */
    simulation?: SimulationResult;
    /** Data sources used */
    sources?: Array<{
        name: string;
        type: 'indexer' | 'api' | 'contract' | 'database';
        latencyMs?: number;
    }>;
    /** Processing metadata */
    meta?: {
        processingTimeMs: number;
        tokensUsed?: number;
        mode: ChatMode;
    };
}

/**
 * Chat capabilities per mode
 */
export const CHAT_CAPABILITIES = {
    explain: {
        description: 'Explain agent decisions, transactions, and system state',
        canExecute: false,
        canModify: false,
    },
    simulate: {
        description: 'Dry-run operations before committing',
        canExecute: false,
        canModify: false,
    },
    plan: {
        description: 'Create execution plans for user approval',
        canExecute: false,
        canModify: false,
    },
    observe: {
        description: 'Summarize trends, anomalies, and system health',
        canExecute: false,
        canModify: false,
    },
} as const;

/**
 * Prohibited chat operations
 * Chat should NEVER do these directly - they require SDK/MCP
 */
export const PROHIBITED_OPERATIONS = [
    'send_transaction',
    'sign_message',
    'approve_token',
    'execute_trade',
    'release_payment',
    'create_session',
    'fund_session',
] as const;
