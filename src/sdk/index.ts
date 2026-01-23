/**
 * Relay Core SDK
 * 
 * Complete SDK for interacting with the Relay Core platform.
 * 
 * NEW (Recommended):
 * - RelayAgent - For AI agents to discover, decide, and execute
 * - RelayService - For service providers to expose, deliver, and earn
 * 
 * LEGACY (Still supported):
 * - ServiceProviderSDK
 * - ServiceConsumerSDK
 * - AgentSDK
 */

// =============================================================================
// NEW IMPROVED SDKs (Recommended)
// =============================================================================

// RelayAgent - For AI agents
export {
    RelayAgent,
    createAgent,
    type AgentConfig,
    type TrustPolicy,
    type ServiceCriteria,
    type SelectedService,
    type ExecutionResult,
    type ExecutionError,
    type ErrorCode,
    type WorkflowStep as AgentWorkflowStep,
    type WorkflowResult,
    type OutcomeRecord as AgentOutcome,
    type AgentMemory,
    type AgentCard,
    type AgentCardResource,
    type TaskArtifact,
    type TaskState,
    type TaskStats,
} from './relay-agent';

// RelayService - For service providers
export {
    RelayService,
    createService,
    defineService,
    hashProof,
    createPaymentMiddleware,
    type ServiceConfig,
    type ServiceDefinition,
    type RegisteredService as ServiceRegistered,
    type PaymentContext,
    type DeliveryProof,
    type PaymentStatus,
    type PaymentEvent,
    type OutcomeType,
    type OutcomeRecord as ServiceOutcome,
    type ServiceMetrics as ServiceMetricsData,
    type ProviderReputation as ServiceReputation,
    type PaymentRequirements as ServicePaymentRequirements,
    type ServiceLogger,
    type JsonSchema,
} from './relay-service';

// =============================================================================
// LEGACY SDKs (Backwards compatible)
// =============================================================================

// Provider SDK - For registering and managing services
export {
    ServiceProviderSDK,
    createProviderSDK,
    type ProviderSDKConfig,
    type ServiceRegistration,
    type RegisteredService,
    type ProviderReputation,
    type PaymentReceived,
    type ServiceMetrics,
} from './provider-sdk';

// Consumer SDK - For discovering and calling services
export {
    ServiceConsumerSDK,
    createConsumerSDK,
    type ConsumerSDKConfig,
    type ServiceQuery,
    type DiscoveredService,
    type PaymentResult,
    type ServiceCallResult,
    type WorkflowStep,
} from './consumer-sdk';

// Legacy Agent SDK (for backwards compatibility)
export {
    AgentSDK,
    createAgentSDK,
    type AgentService,
    type AgentProfile,
} from './agent-sdk';

// Re-export types for convenience
export type { PaymentRequirements } from '@crypto.com/facilitator-client';

// =============================================================================
// X402 PROTOCOL (Cronos Standard)
// =============================================================================

export {
    requireX402,
    handleX402Settlement,
    generatePaymentId,
    isEntitled,
    getEntitlement,
    recordEntitlement,
    createPaymentRequirements,
} from './lib/x402';

export type {
    X402Accepts,
    X402Response,
    X402PaidRecord,
    X402PayResult,
    X402ProtectionOptions,
    X402PayParams,
} from './types/x402.types';

// =============================================================================
// CHAT TYPES (Control Plane Architecture)
// =============================================================================

export type {
    ChatMode,
    ChatResponseType,
    ChatRequest,
    ChatResponse,
    ChatAction,
    SimulationResult,
} from './types/chat.types';

export { CHAT_CAPABILITIES, PROHIBITED_OPERATIONS } from './types/chat.types';

// =============================================================================
// RWA SDK (State Machine & Asset Management)
// =============================================================================

export {
    RelayRWASDK,
    createRWASDK,
    type RWAConfig,
    type RWAStateMachine,
    type TransitionParams,
    type TransitionResult
} from './relay-rwa';
