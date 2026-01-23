/**
 * Relay Core - Service SDK
 * 
 * For service providers to expose services, handle payments, prove delivery,
 * and track reputation on the Relay Core platform.
 * 
 * Design Principles:
 * - Explicit service definition (first-class metadata)
 * - Payment-first thinking (not hidden magic)
 * - Delivery proof is sacred
 * - Built-in observability
 * - Runtime-agnostic
 * 
 * @example Quickstart (10 minutes)
 * ```ts
 * const service = defineService({
 *   name: "price-feed",
 *   category: "data.prices",
 *   price: "0.01",
 *   inputSchema: { type: "object", properties: { pair: { type: "string" } } },
 *   outputSchema: { type: "object", properties: { price: { type: "number" } } },
 * });
 * 
 * const provider = new RelayService({ wallet, network: "cronos-testnet" });
 * await provider.register(service);
 * 
 * // In your request handler:
 * provider.onPaymentReceived(async (ctx) => {
 *   const result = await getPrice(ctx.input);
 *   ctx.deliver({ result, proof: hash(result) });
 * });
 * ```
 */

import { ethers } from 'ethers';

// ============================================================================
// TYPES - Clear, descriptive names
// ============================================================================

/** Network configuration */
export type Network = 'cronos-mainnet' | 'cronos-testnet' | 'cronos-zkevm';

/** Service provider configuration */
export interface ServiceConfig {
    /** Connected wallet for signing */
    wallet: ethers.Signer;
    /** Target network */
    network?: Network;
    /** API endpoint (defaults to production) */
    apiUrl?: string;
}

/** Service definition - first-class metadata */
export interface ServiceDefinition {
    /** Unique service name */
    name: string;
    /** Human-readable description */
    description?: string;
    /** Service category (e.g., "data.prices", "trading.execution", "ai.inference") */
    category: string;
    /** Price per call in USDC (e.g., "0.01") */
    price: string;
    /** Service endpoint URL */
    endpoint?: string;
    /** Input JSON schema */
    inputSchema?: JsonSchema;
    /** Output JSON schema */
    outputSchema?: JsonSchema;
    /** Input type name for discovery (e.g., "PriceQuery") */
    inputType?: string;
    /** Output type name for discovery (e.g., "PriceData") */
    outputType?: string;
    /** Searchable tags */
    tags?: string[];
    /** Declared capabilities */
    capabilities?: string[];
    /** Version string */
    version?: string;
}

/** JSON Schema type */
export interface JsonSchema {
    type: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    description?: string;
    [key: string]: unknown;
}

/** Registered service (after registration) */
export interface RegisteredService extends ServiceDefinition {
    id: string;
    ownerAddress: string;
    registeredAt: Date;
    isActive: boolean;
}

/** Payment context passed to handlers */
export interface PaymentContext<TInput = unknown> {
    /** Unique payment ID */
    paymentId: string;
    /** Transaction hash */
    txHash: string;
    /** Amount paid in USDC */
    amount: string;
    /** Payer's wallet address */
    payerAddress: string;
    /** Parsed input from request */
    input: TInput;
    /** Timestamp of payment */
    timestamp: Date;
    /** Deliver result with proof */
    deliver: <TOutput>(output: DeliveryProof<TOutput>) => Promise<void>;
    /** Report failure with reason */
    fail: (reason: string, retryable?: boolean) => Promise<void>;
}

/** Delivery proof - the heart of the system */
export interface DeliveryProof<T = unknown> {
    /** The actual result data */
    result: T;
    /** Hash of the result for verification */
    proof?: string;
    /** Additional evidence (receipts, signatures, etc.) */
    evidence?: Record<string, unknown>;
    /** Execution latency in ms */
    latencyMs?: number;
}

/** Payment status */
export type PaymentStatus = 'pending' | 'received' | 'settled' | 'failed' | 'timeout';

/** Payment event */
export interface PaymentEvent {
    paymentId: string;
    status: PaymentStatus;
    txHash?: string;
    amount?: string;
    payerAddress?: string;
    timestamp: Date;
    error?: string;
}

/** Outcome types for reputation tracking */
export type OutcomeType = 'delivered' | 'failed' | 'partial' | 'timeout';

/** Outcome record */
export interface OutcomeRecord {
    paymentId: string;
    outcomeType: OutcomeType;
    latencyMs: number;
    proofHash?: string;
    evidence?: Record<string, unknown>;
    timestamp: Date;
}

/** Service metrics */
export interface ServiceMetrics {
    timestamp: Date;
    reputationScore: number;
    successRate: number;
    avgLatencyMs: number;
    totalCalls: number;
    totalPayments: number;
    totalRevenue: string;
}

/** Provider reputation */
export interface ProviderReputation {
    reputationScore: number;
    successRate: number;
    totalDeliveries: number;
    avgLatencyMs: number;
    trend: 'improving' | 'stable' | 'declining';
    rank?: number;
    percentile?: number;
}

/** x402 payment requirements (for 402 responses) */
export interface PaymentRequirements {
    x402Version: number;
    paymentRequirements: {
        scheme: 'exact';
        network: string;
        payTo: string;
        asset: string;
        maxAmountRequired: string;
        maxTimeoutSeconds: number;
        resource?: string;
        description?: string;
    };
}

/** Observability/logging interface */
export interface ServiceLogger {
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, error?: Error, data?: Record<string, unknown>): void;
    metric(name: string, value: number, tags?: Record<string, string>): void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Define a service with typed schema
 * 
 * @example
 * const myService = defineService({
 *   name: "price-feed",
 *   category: "data.prices",
 *   price: "0.01",
 *   inputSchema: { type: "object", properties: { pair: { type: "string" } } },
 *   outputSchema: { type: "object", properties: { price: { type: "number" } } },
 * });
 */
export function defineService(definition: ServiceDefinition): ServiceDefinition {
    // Validate required fields
    if (!definition.name) throw new Error('Service name is required');
    if (!definition.category) throw new Error('Service category is required');
    if (!definition.price) throw new Error('Service price is required');

    // Normalize price format
    const normalizedPrice = definition.price.replace('$', '').replace(' USDC', '');

    return {
        ...definition,
        price: normalizedPrice,
        tags: definition.tags || [],
        capabilities: definition.capabilities || [],
        version: definition.version || '1.0.0',
    };
}

/**
 * Create a hash of data for delivery proof
 * 
 * @example
 * const proof = hashProof(result);
 * ctx.deliver({ result, proof });
 */
export function hashProof(data: unknown): string {
    const json = JSON.stringify(data);
    // Simple hash for demo - in production use crypto.subtle or ethers.keccak256
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
        const char = json.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `0x${Math.abs(hash).toString(16).padStart(16, '0')}`;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

const NETWORK_CONFIG: Record<Network, { apiUrl: string; chainId: number; asset: string }> = {
    'cronos-mainnet': {
        apiUrl: 'https://api.relaycore.xyz',
        chainId: 25,
        asset: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C', // USDC.e
    },
    'cronos-testnet': {
        apiUrl: 'https://testnet-api.relaycore.xyz',
        chainId: 338,
        asset: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C',
    },
    'cronos-zkevm': {
        apiUrl: 'https://zkevm-api.relaycore.xyz',
        chainId: 388,
        asset: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C',
    },
};

/**
 * Relay Service SDK
 * 
 * The main entry point for service providers on Relay Core.
 */
export class RelayService {
    private signer: ethers.Signer;
    private address: string = '';
    private network: Network;
    private apiUrl: string;
    private registeredServices: Map<string, RegisteredService> = new Map();
    private outcomes: OutcomeRecord[] = [];
    private logger: ServiceLogger;

    // Event handlers
    private paymentReceivedHandlers: Array<(ctx: PaymentContext) => Promise<void>> = [];
    private paymentTimeoutHandlers: Array<(event: PaymentEvent) => Promise<void>> = [];
    private paymentFailedHandlers: Array<(event: PaymentEvent) => Promise<void>> = [];

    constructor(config: ServiceConfig) {
        this.signer = config.wallet;
        this.network = config.network || 'cronos-mainnet';
        this.apiUrl = config.apiUrl || NETWORK_CONFIG[this.network].apiUrl;

        // Get address
        config.wallet.getAddress().then(addr => {
            this.address = addr.toLowerCase();
        });

        // Default console logger
        this.logger = {
            info: (msg, data) => console.log(`[RelayService] ${msg}`, data || ''),
            warn: (msg, data) => console.warn(`[RelayService] ${msg}`, data || ''),
            error: (msg, err, data) => console.error(`[RelayService] ${msg}`, err, data || ''),
            metric: (name, value, tags) => console.log(`[Metric] ${name}=${value}`, tags || ''),
        };
    }

    // ==========================================================================
    // CONFIGURATION
    // ==========================================================================

    /**
     * Set custom logger for observability
     */
    setLogger(logger: ServiceLogger): void {
        this.logger = logger;
    }

    /**
     * Get provider wallet address
     */
    async getAddress(): Promise<string> {
        if (!this.address) {
            this.address = (await this.signer.getAddress()).toLowerCase();
        }
        return this.address;
    }

    // ==========================================================================
    // SERVICE REGISTRATION - Explicit, first-class
    // ==========================================================================

    /**
     * Register a service on Relay Core
     * 
     * @example
     * const registered = await provider.register(defineService({
     *   name: "price-feed",
     *   category: "data.prices",
     *   price: "0.01",
     * }));
     * 
     * console.log(`Service ID: ${registered.id}`);
     */
    async register(service: ServiceDefinition): Promise<RegisteredService> {
        const ownerAddress = await this.getAddress();

        this.logger.info('Registering service', { name: service.name, category: service.category });

        const response = await fetch(`${this.apiUrl}/api/services`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: service.name,
                description: service.description || `${service.name} service`,
                category: service.category,
                endpointUrl: service.endpoint,
                pricePerCall: service.price,
                ownerAddress,
                inputSchema: service.inputSchema,
                outputSchema: service.outputSchema,
                inputType: service.inputType,
                outputType: service.outputType,
                tags: service.tags,
                capabilities: service.capabilities,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            this.logger.error('Registration failed', new Error(error.error || 'Unknown'));
            throw new Error(`Failed to register service: ${error.error || response.statusText}`);
        }

        const data = await response.json();

        const registered: RegisteredService = {
            ...service,
            id: data.id,
            ownerAddress,
            registeredAt: new Date(),
            isActive: true,
        };

        this.registeredServices.set(data.id, registered);
        this.logger.info('Service registered', { id: data.id, name: service.name });

        return registered;
    }

    /**
     * Update an existing service
     */
    async update(serviceId: string, updates: Partial<ServiceDefinition>): Promise<void> {
        this.logger.info('Updating service', { id: serviceId, updates });

        const response = await fetch(`${this.apiUrl}/api/services/${serviceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: updates.name,
                description: updates.description,
                category: updates.category,
                endpointUrl: updates.endpoint,
                pricePerCall: updates.price,
                inputSchema: updates.inputSchema,
                outputSchema: updates.outputSchema,
                inputType: updates.inputType,
                outputType: updates.outputType,
                tags: updates.tags,
                capabilities: updates.capabilities,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to update service: ${response.statusText}`);
        }

        // Update local cache
        const existing = this.registeredServices.get(serviceId);
        if (existing) {
            this.registeredServices.set(serviceId, { ...existing, ...updates });
        }

        this.logger.info('Service updated', { id: serviceId });
    }

    /**
     * Deactivate a service
     */
    async deactivate(serviceId: string): Promise<void> {
        await this.update(serviceId, { endpoint: undefined } as never);

        const existing = this.registeredServices.get(serviceId);
        if (existing) {
            existing.isActive = false;
        }

        this.logger.info('Service deactivated', { id: serviceId });
    }

    /**
     * Get all registered services for this provider
     */
    async getMyServices(): Promise<RegisteredService[]> {
        const ownerAddress = await this.getAddress();

        const response = await fetch(
            `${this.apiUrl}/api/services?ownerAddress=${ownerAddress}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch services');
        }

        const data = await response.json();
        return (data.services || []).map((s: Record<string, unknown>) => ({
            id: s.id as string,
            name: s.name as string,
            description: s.description as string,
            category: s.category as string,
            price: s.pricePerCall as string,
            endpoint: s.endpointUrl as string,
            ownerAddress: s.ownerAddress as string,
            registeredAt: new Date(s.createdAt as string),
            isActive: s.isActive as boolean ?? true,
        }));
    }

    // ==========================================================================
    // PAYMENT HANDLING - Explicit, not magic
    // ==========================================================================

    /**
     * Generate x402 payment requirements for a 402 response
     * 
     * Use this when building your service's payment-required response.
     * 
     * @example Express.js middleware
     * ```ts
     * app.use('/api/price', (req, res, next) => {
     *   const paymentId = req.headers['x-payment-id'];
     *   
     *   if (!paymentId) {
     *     const requirements = provider.createPaymentRequired({
     *       amount: "0.01",
     *       resource: "/api/price",
     *       description: "Price feed access",
     *     });
     *     return res.status(402).json(requirements);
     *   }
     *   
     *   next();
     * });
     * ```
     */
    async createPaymentRequired(params: {
        amount: string;
        resource?: string;
        description?: string;
        timeoutSeconds?: number;
    }): Promise<PaymentRequirements> {
        const payTo = await this.getAddress();
        const config = NETWORK_CONFIG[this.network];

        return {
            x402Version: 1,
            paymentRequirements: {
                scheme: 'exact',
                network: this.network === 'cronos-mainnet' ? 'cronos-mainnet' : 'cronos-testnet',
                payTo,
                asset: config.asset,
                maxAmountRequired: params.amount,
                maxTimeoutSeconds: params.timeoutSeconds || 60,
                resource: params.resource,
                description: params.description,
            },
        };
    }

    /**
     * Verify a payment was made
     * 
     * @example
     * const { verified, amount, payerAddress } = await provider.verifyPayment(paymentId);
     * if (!verified) {
     *   return res.status(402).json({ error: 'Payment not verified' });
     * }
     */
    async verifyPayment(paymentId: string): Promise<{
        verified: boolean;
        status: PaymentStatus;
        amount?: string;
        payerAddress?: string;
        txHash?: string;
    }> {
        const response = await fetch(`${this.apiUrl}/api/payments/${paymentId}`);

        if (!response.ok) {
            return { verified: false, status: 'failed' };
        }

        const data = await response.json();
        const payment = data.payment;

        return {
            verified: payment?.status === 'settled',
            status: payment?.status || 'pending',
            amount: payment?.amount,
            payerAddress: payment?.payerAddress,
            txHash: payment?.txHash,
        };
    }

    /**
     * Register handler for payment received events
     * 
     * @example
     * provider.onPaymentReceived(async (ctx) => {
     *   const result = await processRequest(ctx.input);
     *   ctx.deliver({
     *     result,
     *     proof: hashProof(result),
     *     latencyMs: Date.now() - ctx.timestamp.getTime(),
     *   });
     * });
     */
    onPaymentReceived(handler: (ctx: PaymentContext) => Promise<void>): () => void {
        this.paymentReceivedHandlers.push(handler);
        return () => {
            const idx = this.paymentReceivedHandlers.indexOf(handler);
            if (idx > -1) this.paymentReceivedHandlers.splice(idx, 1);
        };
    }

    /**
     * Register handler for payment timeout events
     */
    onPaymentTimeout(handler: (event: PaymentEvent) => Promise<void>): () => void {
        this.paymentTimeoutHandlers.push(handler);
        return () => {
            const idx = this.paymentTimeoutHandlers.indexOf(handler);
            if (idx > -1) this.paymentTimeoutHandlers.splice(idx, 1);
        };
    }

    /**
     * Register handler for payment failed events
     */
    onPaymentFailed(handler: (event: PaymentEvent) => Promise<void>): () => void {
        this.paymentFailedHandlers.push(handler);
        return () => {
            const idx = this.paymentFailedHandlers.indexOf(handler);
            if (idx > -1) this.paymentFailedHandlers.splice(idx, 1);
        };
    }

    /**
     * Process a verified payment and trigger handlers
     * 
     * Call this from your request handler after verifying payment.
     */
    async processPayment<TInput = unknown>(params: {
        paymentId: string;
        txHash: string;
        amount: string;
        payerAddress: string;
        input: TInput;
    }): Promise<void> {
        const ctx: PaymentContext<TInput> = {
            paymentId: params.paymentId,
            txHash: params.txHash,
            amount: params.amount,
            payerAddress: params.payerAddress,
            input: params.input,
            timestamp: new Date(),
            deliver: async (output) => this.recordDelivery(params.paymentId, output),
            fail: async (reason, retryable) => this.recordFailure(params.paymentId, reason, retryable),
        };

        this.logger.info('Processing payment', { paymentId: params.paymentId, amount: params.amount });

        for (const handler of this.paymentReceivedHandlers) {
            try {
                await handler(ctx as PaymentContext);
            } catch (error) {
                this.logger.error('Payment handler error', error instanceof Error ? error : new Error(String(error)));
                await ctx.fail(error instanceof Error ? error.message : 'Handler error', true);
            }
        }
    }

    // ==========================================================================
    // DELIVERY PROOF - Sacred
    // ==========================================================================

    /**
     * Record a successful delivery
     * 
     * Called automatically by ctx.deliver() or can be called directly.
     */
    async recordDelivery<T>(paymentId: string, output: DeliveryProof<T>): Promise<void> {
        const outcome: OutcomeRecord = {
            paymentId,
            outcomeType: 'delivered',
            latencyMs: output.latencyMs || 0,
            proofHash: output.proof,
            evidence: output.evidence,
            timestamp: new Date(),
        };

        this.outcomes.push(outcome);
        this.logger.info('Delivery recorded', { paymentId, proof: output.proof });
        this.logger.metric('delivery.success', 1, { paymentId });
        this.logger.metric('delivery.latency', output.latencyMs || 0, { paymentId });

        // Report to API
        await this.reportOutcome(outcome);
    }

    /**
     * Record a failure
     * 
     * Called automatically by ctx.fail() or can be called directly.
     */
    async recordFailure(paymentId: string, reason: string, retryable?: boolean): Promise<void> {
        const outcome: OutcomeRecord = {
            paymentId,
            outcomeType: retryable ? 'partial' : 'failed',
            latencyMs: 0,
            evidence: { reason, retryable },
            timestamp: new Date(),
        };

        this.outcomes.push(outcome);
        this.logger.warn('Failure recorded', { paymentId, reason, retryable });
        this.logger.metric('delivery.failure', 1, { paymentId, reason });

        await this.reportOutcome(outcome);
    }

    private async reportOutcome(outcome: OutcomeRecord): Promise<void> {
        try {
            await fetch(`${this.apiUrl}/api/outcomes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentId: outcome.paymentId,
                    outcomeType: outcome.outcomeType,
                    latencyMs: outcome.latencyMs,
                    proofHash: outcome.proofHash,
                    evidence: outcome.evidence,
                }),
            });
        } catch (error) {
            this.logger.error('Failed to report outcome', error instanceof Error ? error : new Error(String(error)));
        }
    }

    // ==========================================================================
    // OBSERVABILITY - Built-in, not afterthought
    // ==========================================================================

    /**
     * Get current reputation
     */
    async getReputation(): Promise<ProviderReputation> {
        const ownerAddress = await this.getAddress();

        const response = await fetch(
            `${this.apiUrl}/api/services?ownerAddress=${ownerAddress}&limit=1`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch reputation');
        }

        const data = await response.json();
        const service = data.services?.[0];

        if (!service) {
            return {
                reputationScore: 0,
                successRate: 0,
                totalDeliveries: 0,
                avgLatencyMs: 0,
                trend: 'stable',
            };
        }

        return {
            reputationScore: service.reputationScore || 0,
            successRate: service.successRate || 0,
            totalDeliveries: service.totalPayments || 0,
            avgLatencyMs: service.avgLatencyMs || 0,
            trend: service.trend || 'stable',
            rank: service.rank,
            percentile: service.percentile,
        };
    }

    /**
     * Get service metrics history
     */
    async getMetrics(serviceId: string, options: {
        from?: Date;
        to?: Date;
        interval?: '1h' | '1d' | '7d';
    } = {}): Promise<ServiceMetrics[]> {
        const params = new URLSearchParams();
        if (options.from) params.set('from', options.from.toISOString());
        if (options.to) params.set('to', options.to.toISOString());
        if (options.interval) params.set('interval', options.interval);

        const response = await fetch(
            `${this.apiUrl}/api/services/${serviceId}/metrics?${params}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch metrics');
        }

        const data = await response.json();
        return (data.data || []).map((m: Record<string, unknown>) => ({
            timestamp: new Date(m.timestamp as string),
            reputationScore: m.reputationScore as number || 0,
            successRate: m.successRate as number || 0,
            avgLatencyMs: m.avgLatencyMs as number || 0,
            totalCalls: m.totalCalls as number || 0,
            totalPayments: m.totalPayments as number || 0,
            totalRevenue: m.totalRevenue as string || '0',
        }));
    }

    /**
     * Get local outcome stats (in-memory)
     */
    getLocalStats(): {
        totalOutcomes: number;
        deliveries: number;
        failures: number;
        successRate: number;
        avgLatencyMs: number;
    } {
        const deliveries = this.outcomes.filter(o => o.outcomeType === 'delivered').length;
        const failures = this.outcomes.filter(o => o.outcomeType === 'failed').length;
        const total = this.outcomes.length;
        const avgLatency = total > 0
            ? this.outcomes.reduce((sum, o) => sum + o.latencyMs, 0) / total
            : 0;

        return {
            totalOutcomes: total,
            deliveries,
            failures,
            successRate: total > 0 ? deliveries / total : 0,
            avgLatencyMs: Math.round(avgLatency),
        };
    }

    /**
     * Get recent outcomes
     */
    getRecentOutcomes(limit: number = 10): OutcomeRecord[] {
        return this.outcomes.slice(-limit);
    }
}

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

/**
 * Create Express middleware for x402 payment handling
 * 
 * @example
 * const paymentMiddleware = createPaymentMiddleware(provider, {
 *   amount: "0.01",
 *   description: "API access",
 * });
 * 
 * app.use('/api/protected', paymentMiddleware, (req, res) => {
 *   res.json({ data: 'protected data' });
 * });
 */
export function createPaymentMiddleware(
    provider: RelayService,
    options: {
        amount: string;
        description?: string;
        timeoutSeconds?: number;
    }
) {
    return async (req: { headers: Record<string, string | undefined> }, res: {
        status: (code: number) => { json: (data: unknown) => void };
    }, next: () => void) => {
        const paymentId = req.headers['x-payment-id'];
        const paymentTx = req.headers['x-payment'];

        if (!paymentId || !paymentTx) {
            const requirements = await provider.createPaymentRequired({
                amount: options.amount,
                description: options.description,
                timeoutSeconds: options.timeoutSeconds,
            });
            return res.status(402).json(requirements);
        }

        // Verify payment
        const verification = await provider.verifyPayment(paymentId);

        if (!verification.verified) {
            return res.status(402).json({
                error: 'Payment not verified',
                status: verification.status,
            });
        }

        next();
    };
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

/**
 * Create a Relay Service instance
 * 
 * @example
 * const provider = createService({ wallet, network: "cronos-testnet" });
 */
export function createService(config: ServiceConfig): RelayService {
    return new RelayService(config);
}

export default RelayService;
