/**
 * Relay Core SDK Types
 * 
 * Export all types for agent and service developers.
 */

// Escrow / ACPS Types
export type {
    SessionConfig,
    SessionState,
    ReleaseResult,
    SecurityConfig
} from './escrow/escrow-agent';

export { getEscrowAgent, EscrowAgentService } from './escrow/escrow-agent';
export { registerEscrowAgent, getEscrowAgentInfo } from './escrow/register';

// RWA Settlement Types
export type {
    RWAServiceType,
    RWAServiceConfig,
    SLATerms,
    ExecutionProof,
    VerificationResult,
    SettlementResult
} from './rwa/rwa-settlement-agent';

export { getRWASettlementAgent, RWASettlementAgent } from './rwa/rwa-settlement-agent';
