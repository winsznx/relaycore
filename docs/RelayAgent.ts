/**
 * Relay Core - Agent SDK
 * 
 * For AI agents to discover services, make decisions, and execute workflows.
 * 
 * Design Principles:
 * - Decision abstraction, not CRUD
 * - Workflow primitives first
 * - Failure is first-class
 * - 10-minute quickstart
 * 
 * @example Quickstart
 * ```ts
 * const agent = new RelayAgent({ wallet, network: "cronos-testnet" });
 * 
 * // Select best service by policy
 * const service = await agent.selectService({
 *   category: "data.prices",
 *   constraints: { minReputation: 90 }
 * });
 * 
 * // Execute with automatic payment
 * const result = await agent.execute(service, { pair: "BTC/USD" });
 * ```
 */

import { ethers } from 'ethers';

// ============================================================================
// TYPES - Clear, descriptive names
// ============================================================================

/** Network configuration */
export type Network = 'cronos-mainnet' | 'cronos-testnet' | 'cronos-zkevm';

/** Agent configuration - minimal required, progressive optional */
export interface AgentConfig {
    /** Connected wallet (ethers.Signer or address for read-only) */
    wallet: ethers.Signer | string;
    /** Relay Core API Key (starts with rc_...) */
    apiKey: string;
    /** Target network */
    network?: Network;
    /** API endpoint (defaults to production) */
    apiUrl?: string;
}

/** Trust policy for service selection */
export interface TrustPolicy {
    /** Minimum reputation score (0-100) */
    minReputation?: number;
    /** Maximum acceptable latency in ms */
    maxLatency?: number;
    /** Maximum price per call in USDC */
    maxPrice?: number;
    /** Require verified/reliable services only */
    verifiedOnly?: boolean;
    /** Preferred service providers (addresses) */
    preferredProviders?: string[];
    /** Blacklisted providers (addresses) */
    blacklistedProviders?: string[];
}

/** Service selection criteria */
export interface ServiceCriteria {
    /** Service category (e.g., "data.prices", "trading.execution") */
    category?: string;
    /** Required input type */
    inputType?: string;
    /** Required output type */
    outputType?: string;
    /** Required tags */
    tags?: string[];
    /** Required capabilities */
    capabilities?: string[];
    /** Trust constraints */
    constraints?: TrustPolicy;
}

/** Selected service with selection explanation */
export interface SelectedService {
    id: string;
    name: string;
    endpoint: string;
    price: string;
    provider: string;
    reputation: number;
    latency: number;
    /** Why this service was selected */
    selectionReason: string;
    /** Score breakdown */
    scoreBreakdown: {
        reputation: number;
        latency: number;
        price: number;
        total: number;
    };
}

/** Execution result with full context */
export interface ExecutionResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: ExecutionError;
    /** Payment details if payment was made */
    payment?: {
        id: string;
        txHash: string;
        amount: string;
    };
    /** Performance metrics */
    metrics: {
        totalMs: number;
        paymentMs?: number;
        serviceMs?: number;
    };
}

/** Structured error with actionable information */
export interface ExecutionError {
    code: ErrorCode;
    message: string;
    /** Can this operation be retried? */
    retryable: boolean;
    /** If retryable, suggested wait time in ms */
    retryAfterMs?: number;
    /** Original error details */
    details?: unknown;
}

/** Error codes for programmatic handling */
export type ErrorCode =
    | 'SERVICE_NOT_FOUND'
    | 'SERVICE_UNAVAILABLE'
    | 'PAYMENT_FAILED'
    | 'PAYMENT_TIMEOUT'
    | 'EXECUTION_FAILED'
    | 'EXECUTION_TIMEOUT'
    | 'INSUFFICIENT_BALANCE'
    | 'UNAUTHORIZED'
    | 'RATE_LIMITED'
    | 'INVALID_INPUT'
    | 'PARTIAL_SUCCESS'
    | 'UNKNOWN';

/** Workflow step definition */
export interface WorkflowStep<TInput = unknown, TOutput = unknown> {
    name: string;
    service?: SelectedService;
    serviceId?: string;
    criteria?: ServiceCriteria;
    transform?: (input: TInput) => TOutput | Promise<TOutput>;
    timeout?: number;
    retries?: number;
    fallback?: WorkflowStep<TInput, TOutput>;
    onSuccess?: (result: TOutput) => void | Promise<void>;
    onFailure?: (error: ExecutionError) => void | Promise<void>;
}

/** Workflow execution result */
export interface WorkflowResult<T = unknown> {
    success: boolean;
    data?: T;
    /** Results from each step */
    stepResults: Array<{
        stepName: string;
        success: boolean;
        data?: unknown;
        error?: ExecutionError;
        durationMs: number;
    }>;
    /** Total workflow duration */
    totalMs: number;
    /** Number of steps completed */
    completedSteps: number;
    /** Number of steps that failed */
    failedSteps: number;
}

/** Outcome record for memory */
export interface OutcomeRecord {
    timestamp: Date;
    serviceId: string;
    success: boolean;
    latencyMs: number;
    paymentAmount?: string;
    error?: ExecutionError;
}

/** Memory hooks for agent learning */
export interface AgentMemory {
    record(outcome: OutcomeRecord): void;
    getHistory(serviceId?: string): OutcomeRecord[];
    getStats(): { totalCalls: number; successRate: number; avgLatency: number };
    clear(): void;
}

/** A2A Agent Card Resource */
export interface AgentCardResource {
    id: string;
    title: string;
    url: string;
    price?: string;
    paywall: {
        protocol: 'x402';
        settlement: string;
    };
}

/** A2A Agent Card for discovery */
export interface AgentCard {
    name: string;
    description: string;
    url: string;
    version?: string;
    network: string;
    capabilities?: string[];
    resources: AgentCardResource[];
    contracts?: {
        escrowSession?: string;
        identityRegistry?: string;
        reputationRegistry?: string;
        usdcToken?: string;
    };
    x402?: {
        facilitator?: string;
        token?: string;
        chainId?: number;
    };
}

/** Task state enum */
export type TaskState = 'idle' | 'pending' | 'settled' | 'failed';

/** Task Artifact for tracking agent actions */
export interface TaskArtifact {
    task_id: string;
    agent_id: string;
    service_id?: string;
    session_id?: string;
    state: TaskState;
    payment_id?: string;
    facilitator_tx?: string;
    retries: number;
    timestamps: {
        created: string;
        updated: string;
        completed?: string;
    };
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    };
    metrics?: {
        total_ms: number;
        payment_ms?: number;
        service_ms?: number;
    };
}

/** Task statistics summary */
export interface TaskStats {
    total: number;
    pending: number;
    settled: number;
    failed: number;
    success_rate: number;
    avg_duration_ms: number;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

const NETWORK_CONFIG: Record<Network, { apiUrl: string; chainId: number }> = {
    'cronos-mainnet': { apiUrl: 'https://api.relaycore.xyz', chainId: 25 },
    'cronos-testnet': { apiUrl: 'https://testnet-api.relaycore.xyz', chainId: 338 },
    'cronos-zkevm': { apiUrl: 'https://zkevm-api.relaycore.xyz', chainId: 388 },
};

const FACILITATOR_URL = 'https://facilitator.cronoslabs.org/v2/x402';

/**
 * Relay Agent SDK
 * 
 * The main entry point for AI agents to interact with Relay Core services.
 */
/** Internal discovered service type with all fields */
interface DiscoveredServiceInternal {
    id: string;
    name: string;
    endpoint: string;
    price: string;
    provider: string;
    reputation: number;
    latency: number;
    category: string;
    inputType?: string;
    outputType?: string;
    tags: string[];
    capabilities: string[];
    verified: boolean;
}

export class RelayAgent {
    private signer: ethers.Signer | null = null;
    private _address: string = '';
    private network: Network;
    private apiUrl: string;
    private apiKey: string;
    private trustPolicy: TrustPolicy = {};
    private memoryStore: OutcomeRecord[] = [];

    constructor(config: AgentConfig) {
        this.network = config.network || 'cronos-mainnet';
        this.apiUrl = config.apiUrl || NETWORK_CONFIG[this.network].apiUrl;
        this.apiKey = config.apiKey;

        if (typeof config.wallet === 'string') {
            this._address = config.wallet.toLowerCase();
        } else {
            this.signer = config.wallet;
            // Get address async
            config.wallet.getAddress().then(addr => {
                this._address = addr.toLowerCase();
            });
        }
    }

    /**
     * Get authenticated headers for API requests
     */
    private getHeaders(): HeadersInit {
        return {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
        };
    }

    // ==========================================================================
    // CONFIGURATION - Progressive, not overwhelming
    // ==========================================================================

    /**
     * Get agent's wallet address
     */
    async getAddress(): Promise<string> {
        if (this.signer && !this._address) {
            this._address = (await this.signer.getAddress()).toLowerCase();
        }
        return this._address;
    }

    /**
     * Set trust policy for service selection
     * 
     * @example
     * agent.setTrustPolicy({
     *   minReputation: 90,
     *   maxLatency: 500,
     *   verifiedOnly: true
     * });
     */
    setTrustPolicy(policy: TrustPolicy): void {
        this.trustPolicy = { ...this.trustPolicy, ...policy };
    }

    /**
     * Get current trust policy
     */
    getTrustPolicy(): TrustPolicy {
        return { ...this.trustPolicy };
    }

    // ==========================================================================
    // SERVICE SELECTION - Decision abstraction, not CRUD
    // ==========================================================================

    /**
     * Select the best service matching criteria
     * 
     * This is the main decision interface. The SDK handles:
     * - Filtering by criteria
     * - Scoring by trust policy
     * - Explaining why a service was selected
     * 
     * @example
     * const service = await agent.selectService({
     *   category: "data.prices",
     *   constraints: { minReputation: 90, maxLatency: 200 }
     * });
     * 
     * console.log(service.selectionReason);
     * // "Highest score (92.5) based on: reputation=95, latency=150ms, price=$0.01"
     */
    async selectService(criteria: ServiceCriteria): Promise<SelectedService | null> {
        const services = await this.discoverServices(criteria);

        if (services.length === 0) return null;

        // Apply trust policy + criteria constraints
        const constraints = { ...this.trustPolicy, ...criteria.constraints };

        const scored = services
            .filter(s => this.passesConstraints(s, constraints))
            .map(s => this.scoreService(s, constraints))
            .sort((a, b) => b.score - a.score);

        if (scored.length === 0) return null;

        const best = scored[0];
        return {
            id: best.service.id,
            name: best.service.name,
            endpoint: best.service.endpoint,
            price: best.service.price,
            provider: best.service.provider,
            reputation: best.service.reputation,
            latency: best.service.latency,
            selectionReason: this.explainSelection(best),
            scoreBreakdown: {
                reputation: best.repScore,
                latency: best.latScore,
                price: best.priceScore,
                total: best.score,
            },
        };
    }

    /**
     * Discover all services matching criteria (raw, unfiltered)
     */
    async discoverServices(criteria: ServiceCriteria): Promise<Array<{
        id: string;
        name: string;
        endpoint: string;
        price: string;
        provider: string;
        reputation: number;
        latency: number;
        category: string;
        inputType?: string;
        outputType?: string;
        tags: string[];
        capabilities: string[];
        verified: boolean;
    }>> {
        const params = new URLSearchParams();
        if (criteria.category) params.set('category', criteria.category);
        if (criteria.inputType) params.set('inputType', criteria.inputType);
        if (criteria.outputType) params.set('outputType', criteria.outputType);
        if (criteria.tags) params.set('tags', criteria.tags.join(','));
        if (criteria.capabilities) params.set('capabilities', criteria.capabilities.join(','));
        params.set('limit', '100');

        const response = await fetch(`${this.apiUrl}/api/services?${params}`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            throw this.createError('SERVICE_UNAVAILABLE', 'Failed to discover services', true);
        }

        const data = await response.json();
        return (data.services || []).map((s: Record<string, unknown>) => ({
            id: s.id as string,
            name: s.name as string,
            endpoint: s.endpointUrl as string || s.endpoint_url as string || '',
            price: s.pricePerCall as string || s.price_per_call as string || '0',
            provider: s.ownerAddress as string || s.owner_address as string || '',
            reputation: (s.reputationScore as number) || (s.reputation_score as number) || 0,
            latency: (s.avgLatencyMs as number) || (s.avg_latency_ms as number) || 0,
            category: s.category as string || '',
            inputType: (s.schema as Record<string, unknown>)?.inputType as string,
            outputType: (s.schema as Record<string, unknown>)?.outputType as string,
            tags: ((s.schema as Record<string, unknown>)?.tags as string[]) || [],
            capabilities: ((s.schema as Record<string, unknown>)?.capabilities as string[]) || [],
            verified: (s.health as Record<string, unknown>)?.reliable as boolean || false,
        }));
    }

    // ==========================================================================
    // EXECUTION - Payment-first, failure-aware
    // ==========================================================================

    /**
     * Execute a service with automatic payment handling
     * 
     * @example
     * const result = await agent.execute(service, { pair: "BTC/USD" });
     * 
     * if (result.success) {
     *   console.log("Price:", result.data.price);
     * } else if (result.error?.retryable) {
     *   // Wait and retry
     *   await sleep(result.error.retryAfterMs);
     *   const retry = await agent.execute(service, input);
     * }
     */
    async execute<TInput = unknown, TOutput = unknown>(
        service: SelectedService | string,
        input?: TInput,
        options: { timeout?: number } = {}
    ): Promise<ExecutionResult<TOutput>> {
        const startTime = performance.now();
        const timeout = options.timeout || 30000;

        // Resolve service
        const resolvedService = typeof service === 'string'
            ? await this.getServiceById(service)
            : service;

        if (!resolvedService) {
            return {
                success: false,
                error: this.createError('SERVICE_NOT_FOUND', 'Service not found', false),
                metrics: { totalMs: Math.round(performance.now() - startTime) },
            };
        }

        // Make initial request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            let response = await fetch(resolvedService.endpoint, {
                method: input ? 'POST' : 'GET',
                headers: this.getHeaders(),
                body: input ? JSON.stringify(input) : undefined,
                signal: controller.signal,
            });

            let paymentInfo: ExecutionResult<TOutput>['payment'];
            let paymentMs: number | undefined;

            // Handle 402 Payment Required
            if (response.status === 402) {
                if (!this.signer) {
                    clearTimeout(timeoutId);
                    return {
                        success: false,
                        error: this.createError('UNAUTHORIZED', 'Signer required for paid services', false),
                        metrics: { totalMs: Math.round(performance.now() - startTime) },
                    };
                }

                const paymentRequired = await response.json();
                const requirements = paymentRequired.paymentRequirements;

                const paymentStart = performance.now();
                const payment = await this.makePayment(requirements);
                paymentMs = Math.round(performance.now() - paymentStart);

                paymentInfo = {
                    id: payment.paymentId,
                    txHash: payment.txHash,
                    amount: requirements.maxAmountRequired,
                };

                // Retry with payment
                response = await fetch(resolvedService.endpoint, {
                    method: input ? 'POST' : 'GET',
                    headers: {
                        ...this.getHeaders(),
                        'X-Payment': payment.txHash,
                        'X-Payment-Id': payment.paymentId,
                    },
                    body: input ? JSON.stringify(input) : undefined,
                    signal: controller.signal,
                });
            }

            clearTimeout(timeoutId);
            const totalMs = Math.round(performance.now() - startTime);
            const serviceMs = paymentMs ? totalMs - paymentMs : totalMs;

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: this.createError(
                        response.status === 429 ? 'RATE_LIMITED' : 'EXECUTION_FAILED',
                        error.message || `Service returned ${response.status}`,
                        response.status === 429 || response.status >= 500
                    ),
                    payment: paymentInfo,
                    metrics: { totalMs, paymentMs, serviceMs },
                };
            }

            const data = await response.json();

            // Record outcome for memory
            this.recordOutcome({
                timestamp: new Date(),
                serviceId: resolvedService.id,
                success: true,
                latencyMs: serviceMs,
                paymentAmount: paymentInfo?.amount,
            });

            return {
                success: true,
                data,
                payment: paymentInfo,
                metrics: { totalMs, paymentMs, serviceMs },
            };

        } catch (err) {
            clearTimeout(timeoutId);
            const totalMs = Math.round(performance.now() - startTime);

            const isTimeout = err instanceof Error && err.name === 'AbortError';
            return {
                success: false,
                error: this.createError(
                    isTimeout ? 'EXECUTION_TIMEOUT' : 'EXECUTION_FAILED',
                    isTimeout ? 'Request timed out' : (err instanceof Error ? err.message : 'Unknown error'),
                    true,
                    isTimeout ? 5000 : 1000
                ),
                metrics: { totalMs },
            };
        }
    }

    // ==========================================================================
    // WORKFLOWS - Multi-step execution with retries and fallbacks
    // ==========================================================================

    /**
     * Execute a multi-step workflow
     * 
     * @example
     * const result = await agent.executeWorkflow([
     *   { name: 'getPrice', criteria: { category: 'data.prices' } },
     *   { name: 'validate', transform: (price) => price.value > 0 ? price : null },
     *   { name: 'trade', criteria: { category: 'trading.execution' } },
     * ], { pair: 'BTC/USD' });
     */
    async executeWorkflow<TInput = unknown, TOutput = unknown>(
        steps: WorkflowStep[],
        initialInput: TInput
    ): Promise<WorkflowResult<TOutput>> {
        const startTime = performance.now();
        const stepResults: WorkflowResult['stepResults'] = [];
        let currentInput: unknown = initialInput;
        let failedSteps = 0;

        for (const step of steps) {
            const stepStart = performance.now();
            const maxRetries = step.retries || 0;
            let lastError: ExecutionError | undefined;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    let result: unknown;

                    if (step.transform) {
                        // Pure transformation step
                        result = await step.transform(currentInput as never);
                    } else {
                        // Service execution step
                        let service = step.service;
                        if (!service && step.criteria) {
                            service = await this.selectService(step.criteria) || undefined;
                        }
                        if (!service && step.serviceId) {
                            service = await this.getServiceById(step.serviceId) || undefined;
                        }

                        if (!service) {
                            throw this.createError('SERVICE_NOT_FOUND', `No service found for step: ${step.name}`, false);
                        }

                        const execResult = await this.execute(service, currentInput, { timeout: step.timeout });
                        if (!execResult.success) {
                            throw execResult.error;
                        }
                        result = execResult.data;
                    }

                    // Success
                    if (step.onSuccess) await step.onSuccess(result as never);

                    stepResults.push({
                        stepName: step.name,
                        success: true,
                        data: result,
                        durationMs: Math.round(performance.now() - stepStart),
                    });

                    currentInput = result;
                    lastError = undefined;
                    break;

                } catch (err) {
                    // Check if it's already an ExecutionError
                    if (err && typeof err === 'object' && 'code' in err && 'retryable' in err) {
                        lastError = err as ExecutionError;
                    } else {
                        lastError = this.createError('EXECUTION_FAILED', err instanceof Error ? err.message : 'Unknown', false);
                    }

                    // Try fallback if available and no retries left
                    if (attempt === maxRetries && step.fallback) {
                        try {
                            const fallbackResult = await this.executeWorkflow([step.fallback], currentInput);
                            if (fallbackResult.success) {
                                currentInput = fallbackResult.data;
                                lastError = undefined;
                                stepResults.push({
                                    stepName: `${step.name} (fallback)`,
                                    success: true,
                                    data: fallbackResult.data,
                                    durationMs: Math.round(performance.now() - stepStart),
                                });
                                break;
                            }
                        } catch {
                            // Fallback failed, continue with error
                        }
                    }
                }
            }

            if (lastError) {
                if (step.onFailure) await step.onFailure(lastError);

                stepResults.push({
                    stepName: step.name,
                    success: false,
                    error: lastError,
                    durationMs: Math.round(performance.now() - stepStart),
                });

                failedSteps++;

                // Stop workflow on non-retryable error
                if (!lastError.retryable) break;
            }
        }

        const completedSteps = stepResults.filter(r => r.success).length;
        const totalMs = Math.round(performance.now() - startTime);

        return {
            success: failedSteps === 0,
            data: currentInput as TOutput,
            stepResults,
            totalMs,
            completedSteps,
            failedSteps,
        };
    }

    // ==========================================================================
    // MEMORY - Built-in hooks for agent learning
    // ==========================================================================

    /**
     * Get agent memory interface
     */
    get memory(): AgentMemory {
        return {
            record: (outcome) => this.recordOutcome(outcome),
            getHistory: (serviceId) => serviceId
                ? this.memoryStore.filter(o => o.serviceId === serviceId)
                : [...this.memoryStore],
            getStats: () => {
                const total = this.memoryStore.length;
                const successful = this.memoryStore.filter(o => o.success).length;
                const avgLatency = total > 0
                    ? this.memoryStore.reduce((sum, o) => sum + o.latencyMs, 0) / total
                    : 0;
                return {
                    totalCalls: total,
                    successRate: total > 0 ? successful / total : 0,
                    avgLatency: Math.round(avgLatency),
                };
            },
            clear: () => { this.memoryStore = []; },
        };
    }

    /**
     * Register callback for outcomes (for external memory systems)
     */
    onOutcome(callback: (outcome: OutcomeRecord) => void): () => void {
        this.outcomeCallbacks.push(callback);
        return () => {
            const idx = this.outcomeCallbacks.indexOf(callback);
            if (idx > -1) this.outcomeCallbacks.splice(idx, 1);
        };
    }

    private outcomeCallbacks: Array<(outcome: OutcomeRecord) => void> = [];

    private recordOutcome(outcome: OutcomeRecord): void {
        this.memoryStore.push(outcome);
        // Keep last 1000 outcomes
        if (this.memoryStore.length > 1000) {
            this.memoryStore = this.memoryStore.slice(-1000);
        }
        this.outcomeCallbacks.forEach(cb => cb(outcome));
    }

    // ==========================================================================
    // HELPERS
    // ==========================================================================

    private async getServiceById(serviceId: string): Promise<SelectedService | null> {
        const response = await fetch(`${this.apiUrl}/api/services/${serviceId}`, {
            headers: this.getHeaders()
        });
        if (!response.ok) return null;

        const s = await response.json();
        return {
            id: s.id,
            name: s.name,
            endpoint: s.endpointUrl || s.endpoint_url,
            price: s.pricePerCall || '0',
            provider: s.ownerAddress || '',
            reputation: s.reputationScore || 0,
            latency: s.avgLatencyMs || 0,
            selectionReason: 'Direct lookup',
            scoreBreakdown: { reputation: 0, latency: 0, price: 0, total: 0 },
        };
    }

    private passesConstraints(
        service: { reputation: number; latency: number; price: string; provider: string; verified: boolean },
        constraints: TrustPolicy
    ): boolean {
        if (constraints.minReputation && service.reputation < constraints.minReputation) return false;
        if (constraints.maxLatency && service.latency > constraints.maxLatency) return false;
        if (constraints.maxPrice && parseFloat(service.price) > constraints.maxPrice) return false;
        if (constraints.verifiedOnly && !service.verified) return false;
        if (constraints.blacklistedProviders?.includes(service.provider)) return false;
        return true;
    }

    private scoreService(
        service: DiscoveredServiceInternal,
        constraints: TrustPolicy
    ): {
        service: DiscoveredServiceInternal;
        score: number;
        repScore: number;
        latScore: number;
        priceScore: number;
    } {
        // Normalize scores to 0-100
        const repScore = service.reputation; // Already 0-100
        const latScore = Math.max(0, 100 - (service.latency / 10)); // Lower is better
        const priceScore = Math.max(0, 100 - (parseFloat(service.price) * 100)); // Lower is better

        // Boost for preferred providers
        const preferredBoost = constraints.preferredProviders?.includes(service.provider) ? 10 : 0;

        // Weighted score
        const score = (repScore * 0.5 + latScore * 0.3 + priceScore * 0.2) + preferredBoost;

        return { service, score, repScore, latScore, priceScore };
    }

    private explainSelection(scored: { service: { reputation: number; latency: number; price: string }; score: number }): string {
        return `Highest score (${scored.score.toFixed(1)}) based on: reputation=${scored.service.reputation}, ` +
            `latency=${scored.service.latency}ms, price=$${scored.service.price}`;
    }

    private async makePayment(requirements: {
        payTo: string;
        maxAmountRequired: string;
        asset?: string;
    }): Promise<{ paymentId: string; txHash: string }> {
        if (!this.signer) throw this.createError('UNAUTHORIZED', 'Signer required', false);

        const signerAddress = await this.signer.getAddress();
        const chainId = NETWORK_CONFIG[this.network].chainId;

        // EIP-3009 authorization
        const domain = {
            name: 'USD Coin',
            version: '2',
            chainId,
            verifyingContract: requirements.asset || '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C',
        };

        const types = {
            TransferWithAuthorization: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'validAfter', type: 'uint256' },
                { name: 'validBefore', type: 'uint256' },
                { name: 'nonce', type: 'bytes32' },
            ],
        };

        const nonce = ethers.hexlify(ethers.randomBytes(32));
        const validAfter = 0;
        const validBefore = Math.floor(Date.now() / 1000) + 3600;

        const value = {
            from: signerAddress,
            to: requirements.payTo,
            value: ethers.parseUnits(requirements.maxAmountRequired, 6),
            validAfter,
            validBefore,
            nonce,
        };

        const signature = await (this.signer as ethers.Signer & {
            signTypedData: (d: typeof domain, t: typeof types, v: typeof value) => Promise<string>;
        }).signTypedData(domain, types, value);

        const response = await fetch(`${FACILITATOR_URL}/settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: signerAddress,
                to: requirements.payTo,
                value: requirements.maxAmountRequired,
                validAfter,
                validBefore,
                nonce,
                signature,
                network: this.network === 'cronos-mainnet' ? 'cronos-mainnet' : 'cronos-testnet',
            }),
        });

        if (!response.ok) {
            throw this.createError('PAYMENT_FAILED', 'Payment settlement failed', true, 5000);
        }

        const result = await response.json();
        return {
            paymentId: `pay_${result.txHash?.slice(2, 18) || Date.now()}`,
            txHash: result.txHash || '',
        };
    }

    // ==========================================================================
    // A2A DISCOVERY - Agent-to-Agent Protocol Support
    // ==========================================================================

    /**
     * Discover an agent's capabilities via their agent card
     * 
     * @example
     * const card = await agent.discoverAgentCard("https://api.service.com");
     * console.log(card.resources); // Available x402-gated resources
     */
    async discoverAgentCard(baseUrl: string): Promise<AgentCard | null> {
        const paths = ['/.well-known/agent-card.json', '/.well-known/agent.json'];

        for (const path of paths) {
            try {
                const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
                    headers: { 'Accept': 'application/json' },
                });

                if (response.ok) {
                    return await response.json();
                }
            } catch {
                continue;
            }
        }

        return null;
    }

    /**
     * Discover multiple remote agents in parallel
     * 
     * @example
     * const agents = await agent.discoverRemoteAgents([
     *   "https://perpai.relaycore.xyz",
     *   "https://rwa.relaycore.xyz"
     * ]);
     */
    async discoverRemoteAgents(urls: string[]): Promise<Array<{
        url: string;
        card: AgentCard | null;
        online: boolean;
    }>> {
        return Promise.all(
            urls.map(async (url) => {
                const card = await this.discoverAgentCard(url);
                return {
                    url,
                    card,
                    online: card !== null,
                };
            })
        );
    }

    /**
     * Get local Relay Core agent card
     */
    async getLocalAgentCard(): Promise<AgentCard> {
        const response = await fetch(`${this.apiUrl}/.well-known/agent-card.json`);
        if (!response.ok) {
            throw this.createError('SERVICE_UNAVAILABLE', 'Failed to fetch agent card', true);
        }
        return response.json();
    }

    // ==========================================================================
    // TASK ARTIFACTS - Track and audit all agent actions
    // ==========================================================================

    /**
     * Create a new task artifact
     * 
     * @example
     * const task = await agent.createTask({
     *   service_id: "perpai-quote",
     *   inputs: { pair: "BTC/USD" }
     * });
     */
    async createTask(params: {
        service_id?: string;
        session_id?: string;
        inputs: Record<string, unknown>;
    }): Promise<TaskArtifact> {
        const agentId = await this.getAddress();

        const response = await fetch(`${this.apiUrl}/api/tasks`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                agent_id: agentId,
                service_id: params.service_id,
                session_id: params.session_id,
                inputs: params.inputs,
            }),
        });

        if (!response.ok) {
            throw this.createError('EXECUTION_FAILED', 'Failed to create task', true);
        }

        return response.json();
    }

    /**
     * Get a task artifact by ID
     */
    async getTask(taskId: string): Promise<TaskArtifact | null> {
        const response = await fetch(`${this.apiUrl}/api/tasks/${taskId}`, {
            headers: this.getHeaders()
        });
        if (response.status === 404) return null;
        if (!response.ok) {
            throw this.createError('EXECUTION_FAILED', 'Failed to get task', true);
        }
        return response.json();
    }

    /**
     * Query task artifacts
     * 
     * @example
     * const tasks = await agent.getTasks({ state: 'settled', limit: 10 });
     */
    async getTasks(params?: {
        service_id?: string;
        session_id?: string;
        state?: TaskState;
        from?: Date;
        to?: Date;
        limit?: number;
    }): Promise<TaskArtifact[]> {
        const agentId = await this.getAddress();
        const queryParams = new URLSearchParams();
        queryParams.set('agent_id', agentId);

        if (params?.service_id) queryParams.set('service_id', params.service_id);
        if (params?.session_id) queryParams.set('session_id', params.session_id.toString());
        if (params?.state) queryParams.set('state', params.state);
        if (params?.from) queryParams.set('from', params.from.toISOString());
        if (params?.to) queryParams.set('to', params.to.toISOString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());

        const response = await fetch(`${this.apiUrl}/api/tasks?${queryParams}`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            throw this.createError('EXECUTION_FAILED', 'Failed to query tasks', true);
        }

        const data = await response.json();
        return data.tasks || [];
    }

    /**
     * Get task statistics
     */
    async getTaskStats(): Promise<TaskStats> {
        const agentId = await this.getAddress();
        const response = await fetch(`${this.apiUrl}/api/tasks/stats?agent_id=${agentId}`, {
            headers: this.getHeaders()
        });
        if (!response.ok) {
            throw this.createError('EXECUTION_FAILED', 'Failed to get task stats', true);
        }
        return response.json();
    }

    /**
     * Mark a task as settled (success)
     */
    async settleTask(taskId: string, outputs: Record<string, unknown>, metrics?: TaskArtifact['metrics']): Promise<TaskArtifact> {
        const response = await fetch(`${this.apiUrl}/api/tasks/${taskId}/settle`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ outputs, metrics }),
        });

        if (!response.ok) {
            throw this.createError('EXECUTION_FAILED', 'Failed to settle task', true);
        }

        return response.json();
    }

    /**
     * Mark a task as failed
     */
    async failTask(taskId: string, error: { code: string; message: string; retryable: boolean }, metrics?: TaskArtifact['metrics']): Promise<TaskArtifact> {
        const response = await fetch(`${this.apiUrl}/api/tasks/${taskId}/fail`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ error, metrics }),
        });

        if (!response.ok) {
            throw this.createError('EXECUTION_FAILED', 'Failed to fail task', true);
        }

        return response.json();
    }

    // ========================================================================
    // META-AGENT METHODS (Agent Discovery & Hiring)
    // ========================================================================

    /**
     * Discover agents based on criteria
     */
    async discoverAgents(query: {
        capability?: string;
        category?: string;
        minReputation?: number;
        maxPricePerCall?: string;
        limit?: number;
    }): Promise<Array<{
        agentId: string;
        agentName: string;
        agentUrl: string;
        reputationScore: number;
        pricePerCall: string;
        successRate: number;
        compositeScore: number;
    }>> {
        const response = await fetch(`${this.apiUrl}/api/meta-agent/discover`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(query)
        });

        if (!response.ok) {
            throw this.createError('EXECUTION_FAILED', 'Agent discovery failed', true);
        }

        const data = await response.json();
        return data.agents || [];
    }

    /**
     * Hire an agent to perform a task
     */
    async hireAgent(request: {
        agentId: string;
        resourceId: string;
        budget: string;
        task: Record<string, unknown>;
    }): Promise<{
        success: boolean;
        taskId: string;
        agentId: string;
        cost: string;
    }> {
        const agentId = await this.getAddress();

        const response = await fetch(`${this.apiUrl}/api/meta-agent/hire`, {
            method: 'POST',
            headers: {
                ...this.getHeaders(),
                'X-Agent-Id': agentId
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const error = await response.json();
            throw this.createError('EXECUTION_FAILED', error.error || 'Agent hiring failed', true);
        }

        return response.json();
    }

    /**
     * Execute a delegated task
     */
    async executeDelegation(taskId: string): Promise<{
        success: boolean;
        outcome: {
            taskId: string;
            agentId: string;
            state: string;
            outputs?: Record<string, unknown>;
            error?: { code: string; message: string };
        };
    }> {
        const response = await fetch(`${this.apiUrl}/api/meta-agent/execute/${taskId}`, {
            method: 'POST',
            headers: this.getHeaders()
        });

        if (!response.ok) {
            throw this.createError('EXECUTION_FAILED', 'Delegation execution failed', true);
        }

        return response.json();
    }

    /**
     * Get delegation status
     */
    async getDelegationStatus(taskId: string): Promise<{
        taskId: string;
        agentId: string;
        state: string;
        cost: string;
        outputs?: Record<string, unknown>;
    }> {
        const response = await fetch(`${this.apiUrl}/api/meta-agent/status/${taskId}`, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            throw this.createError('EXECUTION_FAILED', 'Failed to get delegation status', true);
        }

        const data = await response.json();
        return data.outcome;
    }

    /**
     * Fetch agent card for a specific agent
     */
    async getAgentCard(agentId: string): Promise<{
        name: string;
        description: string;
        url: string;
        network: string;
        resources: Array<{
            id: string;
            title: string;
            url: string;
        }>;
    } | null> {
        const response = await fetch(`${this.apiUrl}/api/meta-agent/agent-card/${agentId}`, {
            headers: this.getHeaders()
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.card || null;
    }

    // ========================================================================
    // SESSION MANAGEMENT (x402)
    // ========================================================================

    /**
     * Create a new x402 session
     * 
     * @returns Session ID and payment request to activate it
     */
    async createSession(params: {
        maxSpend: number;
        durationHours: number;
        authorizedAgents?: string[];
    }): Promise<{
        sessionId: string;
        paymentRequest: {
            amount: string;
            payTo: string;
            asset: string;
        };
    }> {
        const ownerAddress = await this.getAddress();

        const response = await fetch(`${this.apiUrl}/api/sessions/create`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                ownerAddress,
                maxSpend: params.maxSpend,
                durationHours: params.durationHours,
                authorizedAgents: params.authorizedAgents || []
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw this.createError('EXECUTION_FAILED', error.message || 'Failed to create session', false);
        }

        const result = await response.json();
        return {
            sessionId: result.session.session_id,
            paymentRequest: result.paymentRequest
        };
    }

    /**
     * Activate a session after paying USDC
     */
    async activateSession(sessionId: string, txHash: string, amount: string): Promise<{ success: boolean }> {
        const response = await fetch(`${this.apiUrl}/api/sessions/${sessionId}/activate`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ txHash, amount })
        });

        if (!response.ok) {
            const error = await response.json();
            throw this.createError('EXECUTION_FAILED', error.message || 'Failed to activate session', true);
        }

        return { success: true };
    }

    /**
     * Get session details
     */
    async getSession(sessionId: string): Promise<{
        id: string;
        owner: string;
        maxSpend: string;
        spent: string;
        isActive: boolean;
        expiresAt: string;
    } | null> {
        const response = await fetch(`${this.apiUrl}/api/sessions/${sessionId}`, {
            headers: this.getHeaders()
        });

        if (response.status === 404) return null;
        if (!response.ok) {
            throw this.createError('EXECUTION_FAILED', 'Failed to get session', true);
        }

        const data = await response.json();
        const session = data.session;
        return {
            id: session.session_id,
            owner: session.owner_address,
            maxSpend: session.max_spend,
            spent: session.spent,
            isActive: session.is_active,
            expiresAt: session.expires_at
        };
    }


    private createError(
        code: ErrorCode,
        message: string,
        retryable: boolean,
        retryAfterMs?: number
    ): ExecutionError {
        return { code, message, retryable, retryAfterMs };
    }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

/**
 * Create a Relay Agent instance
 * 
 * @example
 * const agent = createAgent({ wallet, network: "cronos-testnet" });
 */
export function createAgent(config: AgentConfig): RelayAgent {
    return new RelayAgent(config);
}

export default RelayAgent;
