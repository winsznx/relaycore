/**
 * Agents Service Index
 * 
 * Exports all agent-related modules for the Relay Core ecosystem.
 */

// Core registry
export { agentRegistry, AgentRegistry } from './registry';

// PerpAI agents (auto-registers on import)
export { PERP_AI_AGENTS } from './perp-ai-adapter';

// Re-export types
export type {
    AgentRegistration,
    RegisteredAgent,
    AgentInvokeRequest,
    AgentInvokeResult,
    AgentPaymentRequired,
    AgentFilters,
    AgentSummary,
    AgentListResponse,
    AgentInvocationMetrics,
    AgentDetailedMetrics,
    AgentType,
    InteractionMode,
    LatencyClass,
} from '../../types/agent';
