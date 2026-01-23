/**
 * Agent Registry Service
 * 
 * Central registry for managing agents in the Relay Core ecosystem.
 * Handles registration, invocation, discovery, and metrics tracking.
 * 
 * Features:
 * - In-memory agent registration with database persistence
 * - x402 payment enforcement
 * - Metrics collection and reputation scoring
 * - Discovery with filtering and pagination
 */

import { supabase } from '../../lib/supabase';
import logger from '../../lib/logger';
import { recordAgentPayment } from './agent-service-linker';
import type {
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
} from '../../types/agent';

// ============================================
// AGENT HANDLER TYPE
// ============================================

type AgentHandler = (input: Record<string, unknown>) => Promise<unknown>;

interface InternalAgent {
    registration: AgentRegistration;
    handler: AgentHandler;
    registered_at: Date;
}

// ============================================
// AGENT REGISTRY CLASS
// ============================================

class AgentRegistry {
    private agents: Map<string, InternalAgent> = new Map();
    private metricsBuffer: AgentInvocationMetrics[] = [];
    private metricsFlushInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.metricsFlushInterval = setInterval(() => {
            this.flushMetrics().catch(err => {
                logger.error('Failed to flush agent metrics', err instanceof Error ? err : new Error(String(err)));
            });
        }, 30000);
    }

    /**
     * Register an agent with its handler function
     */
    register(
        registration: AgentRegistration,
        handler: AgentHandler
    ): RegisteredAgent {
        // Validate ID format (namespace.name)
        if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(registration.id)) {
            throw new Error(`Invalid agent ID format: ${registration.id}. Must be namespace.name (lowercase alphanumeric)`);
        }

        // Check for duplicates
        if (this.agents.has(registration.id)) {
            throw new Error(`Agent ${registration.id} is already registered`);
        }

        // Store in memory
        const internalAgent: InternalAgent = {
            registration,
            handler,
            registered_at: new Date(),
        };

        this.agents.set(registration.id, internalAgent);

        // Persist to database (async, non-blocking)
        this.persistAgent(registration).catch(err => {
            const error = err instanceof Error ? err : new Error(String(err));
            logger.error('Failed to persist agent registration', error, { agentId: registration.id });
        });

        logger.info('Agent registered', {
            id: registration.id,
            name: registration.name,
            type: registration.agent_type,
            modes: registration.interaction_modes,
        });

        return this.toRegisteredAgent(internalAgent);
    }

    /**
     * Get agent by ID
     */
    get(agentId: string): RegisteredAgent | null {
        const agent = this.agents.get(agentId);
        if (!agent) {
            return null;
        }
        return this.toRegisteredAgent(agent);
    }

    /**
     * Check if agent exists
     */
    has(agentId: string): boolean {
        return this.agents.has(agentId);
    }

    /**
     * Invoke an agent
     */
    async invoke(request: AgentInvokeRequest): Promise<AgentInvokeResult | AgentPaymentRequired> {
        const startTime = performance.now();

        // Get agent
        const agent = this.agents.get(request.agent_id);
        if (!agent) {
            return {
                success: false,
                agent_id: request.agent_id,
                error: `Agent not found: ${request.agent_id}`,
                error_code: 'AGENT_NOT_FOUND',
                execution_time_ms: Math.round(performance.now() - startTime),
                timestamp: new Date(),
                correlation_id: request.correlation_id,
            };
        }

        const { registration, handler } = agent;

        // Check payment requirement
        if (registration.permissions.requires_payment && !request.payment_id) {
            return this.createPaymentRequired(registration, request);
        }

        // Validate input against schema (basic validation)
        const validationError = this.validateInput(request.input, registration.input_schema);
        if (validationError) {
            return {
                success: false,
                agent_id: request.agent_id,
                error: validationError,
                error_code: 'INVALID_INPUT',
                execution_time_ms: Math.round(performance.now() - startTime),
                timestamp: new Date(),
                correlation_id: request.correlation_id,
            };
        }

        // Execute the handler
        try {
            const result = await handler(request.input);
            const executionTimeMs = Math.round(performance.now() - startTime);

            // Record metrics
            this.recordMetrics({
                agent_id: request.agent_id,
                timestamp: new Date(),
                latency_ms: executionTimeMs,
                success: true,
                payment_settled: !!request.payment_id,
                payment_amount: registration.permissions.payment_amount,
                caller_address: request.caller_address,
                correlation_id: request.correlation_id,
            });

            // Link agent invocation to marketplace service reputation
            if (request.payment_id) {
                recordAgentPayment({
                    agentName: registration.name,
                    agentId: request.agent_id,
                    paymentId: request.payment_id,
                    payerAddress: request.caller_address || '0x0',
                    amount: registration.permissions.payment_amount || '0',
                    latencyMs: executionTimeMs,
                    success: true,
                }).catch(err => {
                    logger.warn('Failed to record agent payment for marketplace', err as Error);
                });
            }

            logger.info('Agent invoked successfully', {
                agentId: request.agent_id,
                executionTimeMs,
            });

            return {
                success: true,
                agent_id: request.agent_id,
                result,
                execution_time_ms: executionTimeMs,
                timestamp: new Date(),
                correlation_id: request.correlation_id,
            };
        } catch (error) {
            const executionTimeMs = Math.round(performance.now() - startTime);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Record metrics
            this.recordMetrics({
                agent_id: request.agent_id,
                timestamp: new Date(),
                latency_ms: executionTimeMs,
                success: false,
                error_type: error instanceof Error ? error.name : 'UnknownError',
                payment_settled: !!request.payment_id,
                caller_address: request.caller_address,
                correlation_id: request.correlation_id,
            });

            // Link failed invocation to marketplace service reputation
            if (request.payment_id) {
                recordAgentPayment({
                    agentName: registration.name,
                    agentId: request.agent_id,
                    paymentId: request.payment_id,
                    payerAddress: request.caller_address || '0x0',
                    amount: registration.permissions.payment_amount || '0',
                    latencyMs: executionTimeMs,
                    success: false,
                }).catch(err => {
                    logger.warn('Failed to record agent payment for marketplace', err as Error);
                });
            }

            const errorObj = error instanceof Error ? error : new Error(errorMessage);
            logger.error('Agent invocation failed', errorObj, { agentId: request.agent_id });

            return {
                success: false,
                agent_id: request.agent_id,
                error: errorMessage,
                error_code: 'EXECUTION_ERROR',
                execution_time_ms: executionTimeMs,
                timestamp: new Date(),
                correlation_id: request.correlation_id,
            };
        }
    }

    /**
     * List agents with filtering
     */
    async list(filters: AgentFilters = {}): Promise<AgentListResponse> {
        let agents = Array.from(this.agents.values());

        // Apply filters
        if (filters.agent_type) {
            agents = agents.filter(a => a.registration.agent_type === filters.agent_type);
        }

        if (filters.interaction_mode) {
            agents = agents.filter(a =>
                a.registration.interaction_modes.includes(filters.interaction_mode!)
            );
        }

        if (filters.category) {
            agents = agents.filter(a =>
                a.registration.metadata.categories.includes(filters.category!)
            );
        }

        if (filters.query) {
            const query = filters.query.toLowerCase();
            agents = agents.filter(a =>
                a.registration.name.toLowerCase().includes(query) ||
                a.registration.description.toLowerCase().includes(query)
            );
        }

        // Get metrics from database for sorting
        const metricsMap = await this.getAgentMetricsMap();

        // Convert to summaries with metrics
        let summaries: AgentSummary[] = agents.map(a => {
            const metrics = metricsMap.get(a.registration.id) || {
                reputation_score: 50,
                total_invocations: 0,
                success_rate: 0,
                avg_latency_ms: 0,
            };

            return {
                id: a.registration.id,
                name: a.registration.name,
                description: a.registration.description,
                agent_type: a.registration.agent_type,
                interaction_modes: a.registration.interaction_modes,
                reputation_score: metrics.reputation_score,
                is_verified: a.registration.id.startsWith('relaycore.'),
                total_invocations: metrics.total_invocations,
                success_rate: metrics.success_rate,
                avg_latency_ms: metrics.avg_latency_ms,
                price_usdc: a.registration.permissions.payment_amount
                    ? parseInt(a.registration.permissions.payment_amount) / 1e6
                    : null,
                categories: a.registration.metadata.categories,
            };
        });

        // Apply reputation filter
        if (filters.min_reputation !== undefined) {
            summaries = summaries.filter(s => s.reputation_score >= filters.min_reputation!);
        }

        if (filters.verified_only) {
            summaries = summaries.filter(s => s.is_verified);
        }

        // Sort
        const sortField = filters.sort_by || 'reputation';
        const sortOrder = filters.sort_order || 'desc';
        const sortMultiplier = sortOrder === 'desc' ? -1 : 1;

        summaries.sort((a, b) => {
            switch (sortField) {
                case 'reputation':
                    return (a.reputation_score - b.reputation_score) * sortMultiplier;
                case 'invocations':
                    return (a.total_invocations - b.total_invocations) * sortMultiplier;
                case 'latency':
                    return (a.avg_latency_ms - b.avg_latency_ms) * sortMultiplier;
                default:
                    return 0;
            }
        });

        // Paginate
        const total = summaries.length;
        const limit = filters.limit || 20;
        const offset = filters.offset || 0;
        const page = Math.floor(offset / limit) + 1;

        summaries = summaries.slice(offset, offset + limit);

        return {
            agents: summaries,
            total,
            page,
            page_size: limit,
        };
    }

    /**
     * Get detailed metrics for an agent
     */
    async getMetrics(agentId: string, periodDays: number = 7): Promise<AgentDetailedMetrics | null> {
        if (!this.has(agentId)) {
            return null;
        }

        const from = new Date();
        from.setDate(from.getDate() - periodDays);

        const { data: metricsData } = await supabase
            .from('agent_metrics')
            .select('*')
            .eq('agent_id', agentId)
            .gte('timestamp', from.toISOString())
            .order('timestamp', { ascending: true });

        const metrics = metricsData || [];

        if (metrics.length === 0) {
            return {
                agent_id: agentId,
                period: { from, to: new Date() },
                totals: {
                    invocations: 0,
                    successful: 0,
                    failed: 0,
                    success_rate: 0,
                },
                latency: {
                    avg_ms: 0,
                    median_ms: 0,
                    p95_ms: 0,
                    p99_ms: 0,
                },
                payments: {
                    total_amount: '0',
                    total_count: 0,
                    unique_payers: 0,
                },
                time_series: [],
            };
        }

        // Calculate totals
        const successful = metrics.filter(m => m.success).length;
        const failed = metrics.length - successful;

        // Calculate latency percentiles
        const latencies = metrics.map(m => m.latency_ms).sort((a, b) => a - b);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const medianLatency = latencies[Math.floor(latencies.length / 2)];
        const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
        const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

        // Calculate payments
        const paymentsWithAmount = metrics.filter(m => m.payment_settled && m.payment_amount);
        const totalAmount = paymentsWithAmount.reduce(
            (sum, m) => sum + BigInt(m.payment_amount || '0'),
            BigInt(0)
        );
        const uniquePayers = new Set(metrics.filter(m => m.caller_address).map(m => m.caller_address)).size;

        // Build time series (daily aggregates)
        const dailyBuckets = new Map<string, { invocations: number; latencies: number[]; successful: number }>();
        for (const m of metrics) {
            const day = new Date(m.timestamp).toISOString().split('T')[0];
            if (!dailyBuckets.has(day)) {
                dailyBuckets.set(day, { invocations: 0, latencies: [], successful: 0 });
            }
            const bucket = dailyBuckets.get(day)!;
            bucket.invocations++;
            bucket.latencies.push(m.latency_ms);
            if (m.success) bucket.successful++;
        }

        const timeSeries = Array.from(dailyBuckets.entries()).map(([date, data]) => ({
            timestamp: new Date(date),
            invocations: data.invocations,
            avg_latency_ms: Math.round(data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length),
            success_rate: data.successful / data.invocations,
        }));

        return {
            agent_id: agentId,
            period: { from, to: new Date() },
            totals: {
                invocations: metrics.length,
                successful,
                failed,
                success_rate: successful / metrics.length,
            },
            latency: {
                avg_ms: Math.round(avgLatency),
                median_ms: Math.round(medianLatency),
                p95_ms: Math.round(p95Latency),
                p99_ms: Math.round(p99Latency),
            },
            payments: {
                total_amount: totalAmount.toString(),
                total_count: paymentsWithAmount.length,
                unique_payers: uniquePayers,
            },
            time_series: timeSeries,
        };
    }

    /**
     * Unregister an agent (for testing/cleanup)
     */
    unregister(agentId: string): boolean {
        return this.agents.delete(agentId);
    }

    /**
     * Get all registered agent IDs
     */
    getAgentIds(): string[] {
        return Array.from(this.agents.keys());
    }

    // ============================================
    // PRIVATE METHODS
    // ============================================

    private toRegisteredAgent(internal: InternalAgent): RegisteredAgent {
        return {
            ...internal.registration,
            registered_at: internal.registered_at,
            is_active: true,
            is_verified: internal.registration.id.startsWith('relaycore.'),
            reputation_score: 50, // Default, will be updated from DB
            total_invocations: 0,
            successful_invocations: 0,
            avg_latency_ms: 0,
        };
    }

    private createPaymentRequired(
        registration: AgentRegistration,
        _request: AgentInvokeRequest
    ): AgentPaymentRequired {
        const validUntil = new Date();
        validUntil.setMinutes(validUntil.getMinutes() + 10);

        return {
            status: 'payment_required',
            agent_id: registration.id,
            x402: {
                amount: registration.permissions.payment_amount || '10000',
                token: 'USDC',
                token_address: process.env.USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
                recipient: registration.owner,
                network: 'cronos_testnet',
                chain_id: 338,
                resource: `/api/agents/${registration.id}/invoke`,
                valid_until: validUntil.toISOString(),
            },
        };
    }

    private validateInput(input: Record<string, unknown>, schema: AgentRegistration['input_schema']): string | null {
        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in input)) {
                    return `Missing required field: ${field}`;
                }
            }
        }

        if (schema.properties) {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                if (key in input) {
                    const value = input[key];
                    const propType = propSchema.type;

                    // Basic type checking
                    if (propType === 'string' && typeof value !== 'string') {
                        return `Field ${key} must be a string`;
                    }
                    if (propType === 'number' && typeof value !== 'number') {
                        return `Field ${key} must be a number`;
                    }
                    if (propType === 'boolean' && typeof value !== 'boolean') {
                        return `Field ${key} must be a boolean`;
                    }
                    if (propType === 'array' && !Array.isArray(value)) {
                        return `Field ${key} must be an array`;
                    }

                    // Enum validation
                    if (propSchema.enum && !propSchema.enum.includes(value as string)) {
                        return `Field ${key} must be one of: ${propSchema.enum.join(', ')}`;
                    }

                    // Range validation
                    if (propSchema.minimum !== undefined && (value as number) < propSchema.minimum) {
                        return `Field ${key} must be >= ${propSchema.minimum}`;
                    }
                    if (propSchema.maximum !== undefined && (value as number) > propSchema.maximum) {
                        return `Field ${key} must be <= ${propSchema.maximum}`;
                    }
                }
            }
        }

        return null;
    }

    private recordMetrics(metrics: AgentInvocationMetrics): void {
        this.metricsBuffer.push(metrics);

        if (this.metricsBuffer.length >= 100) {
            this.flushMetrics().catch(err => {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error('Failed to flush agent metrics', error);
            });
        }
    }

    private async flushMetrics(): Promise<void> {
        if (this.metricsBuffer.length === 0) {
            return;
        }

        const toFlush = [...this.metricsBuffer];
        this.metricsBuffer = [];

        try {
            await supabase.from('agent_metrics').insert(
                toFlush.map(m => ({
                    agent_id: m.agent_id,
                    timestamp: m.timestamp.toISOString(),
                    latency_ms: m.latency_ms,
                    success: m.success,
                    error_type: m.error_type,
                    payment_settled: m.payment_settled,
                    payment_amount: m.payment_amount,
                    caller_address: m.caller_address,
                    correlation_id: m.correlation_id,
                }))
            );
        } catch (error) {
            // Re-add failed metrics to buffer
            this.metricsBuffer.unshift(...toFlush);
            throw error;
        }
    }

    private async persistAgent(registration: AgentRegistration): Promise<void> {
        // Skip persistence if running in browser
        if (typeof window !== 'undefined') {
            return; // In-memory registration only for frontend
        }

        await supabase.from('agents').upsert({
            id: registration.id,
            owner: registration.owner,
            name: registration.name,
            description: registration.description,
            agent_type: registration.agent_type,
            interaction_modes: registration.interaction_modes,
            input_schema: registration.input_schema,
            output_schema: registration.output_schema,
            permissions: registration.permissions,
            metadata: registration.metadata,
            is_active: true,
            registered_at: new Date().toISOString(),
        });
    }

    private async getAgentMetricsMap(): Promise<Map<string, {
        reputation_score: number;
        total_invocations: number;
        success_rate: number;
        avg_latency_ms: number;
    }>> {
        const map = new Map();

        // Get aggregated metrics from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data } = await supabase.rpc('get_agent_metrics_summary', {
            since_date: thirtyDaysAgo.toISOString(),
        });

        if (data) {
            for (const row of data) {
                map.set(row.agent_id, {
                    reputation_score: this.calculateReputation(row),
                    total_invocations: row.total_invocations,
                    success_rate: row.success_rate,
                    avg_latency_ms: row.avg_latency_ms,
                });
            }
        }

        return map;
    }

    private calculateReputation(metrics: {
        success_rate: number;
        avg_latency_ms: number;
        total_invocations: number;
    }): number {
        // Weighted reputation score
        const weights = {
            success_rate: 0.40,
            latency: 0.25,
            volume: 0.20,
            consistency: 0.15,
        };

        // Success rate score (0-100)
        const successScore = metrics.success_rate * 100;

        // Latency score (lower is better, max 100)
        const latencyScore = Math.max(0, 100 - (metrics.avg_latency_ms / 50)); // 50ms = 99 score, 5000ms = 0

        // Volume score (log scale)
        const volumeScore = Math.min(100, Math.log10(metrics.total_invocations + 1) * 25);

        // Consistency (placeholder - would need time series data)
        const consistencyScore = 75;

        const score =
            successScore * weights.success_rate +
            latencyScore * weights.latency +
            volumeScore * weights.volume +
            consistencyScore * weights.consistency;

        return Math.round(Math.min(100, Math.max(0, score)));
    }

    /**
     * Cleanup on shutdown
     */
    async shutdown(): Promise<void> {
        if (this.metricsFlushInterval) {
            clearInterval(this.metricsFlushInterval);
        }
        await this.flushMetrics();
    }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const agentRegistry = new AgentRegistry();

export { AgentRegistry };
