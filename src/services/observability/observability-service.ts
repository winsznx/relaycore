/**
 * Observability Service - Phase 10 Implementation
 * 
 * Comprehensive monitoring and observability:
 * - Metrics collection (Prometheus-style)
 * - Health checks
 * - Request tracing
 * - Performance monitoring
 * - Alert thresholds
 */

import logger from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';

// ============================================
// INTERFACES
// ============================================

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    checks: HealthCheck[];
    version: string;
    uptime: number;
}

export interface HealthCheck {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    latencyMs: number;
    message?: string;
    lastChecked: Date;
}

export interface MetricValue {
    name: string;
    value: number;
    labels: Record<string, string>;
    timestamp: Date;
}

export interface Trace {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    serviceName: string;
    startTime: Date;
    endTime?: Date;
    durationMs?: number;
    status: 'in_progress' | 'success' | 'error';
    tags: Record<string, string>;
    logs: TraceLog[];
}

export interface TraceLog {
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    fields?: Record<string, unknown>;
}

export interface SystemMetrics {
    requestsTotal: number;
    requestsSuccessful: number;
    requestsFailed: number;
    averageLatencyMs: number;
    activeConnections: number;
    memoryUsageMb: number;
    cpuPercent: number;
    uptime: number;
}

export interface AlertThreshold {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    value: number;
    severity: 'info' | 'warning' | 'critical';
    message: string;
}

// ============================================
// METRICS COLLECTOR
// ============================================

class MetricsCollector {
    private metrics: Map<string, MetricValue[]> = new Map();
    private counters: Map<string, number> = new Map();
    private gauges: Map<string, number> = new Map();
    private histograms: Map<string, number[]> = new Map();

    /**
     * Increment a counter metric
     */
    incrementCounter(name: string, labels: Record<string, string> = {}, delta: number = 1): void {
        const key = this.makeKey(name, labels);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + delta);
    }

    /**
     * Set a gauge metric
     */
    setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
        const key = this.makeKey(name, labels);
        this.gauges.set(key, value);
    }

    /**
     * Record a histogram observation
     */
    observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
        const key = this.makeKey(name, labels);
        const values = this.histograms.get(key) || [];
        values.push(value);
        // Keep only last 1000 observations
        if (values.length > 1000) values.shift();
        this.histograms.set(key, values);
    }

    /**
     * Get counter value
     */
    getCounter(name: string, labels: Record<string, string> = {}): number {
        const key = this.makeKey(name, labels);
        return this.counters.get(key) || 0;
    }

    /**
     * Get gauge value
     */
    getGauge(name: string, labels: Record<string, string> = {}): number {
        const key = this.makeKey(name, labels);
        return this.gauges.get(key) || 0;
    }

    /**
     * Get histogram statistics
     */
    getHistogramStats(name: string, labels: Record<string, string> = {}): {
        count: number;
        sum: number;
        avg: number;
        min: number;
        max: number;
        p50: number;
        p95: number;
        p99: number;
    } {
        const key = this.makeKey(name, labels);
        const values = this.histograms.get(key) || [];

        if (values.length === 0) {
            return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
        }

        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);

        return {
            count: values.length,
            sum,
            avg: sum / values.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
        };
    }

    /**
     * Export all metrics in Prometheus format
     */
    exportPrometheus(): string {
        const lines: string[] = [];

        // Counters
        for (const [key, value] of this.counters) {
            const { name, labels } = this.parseKey(key);
            const labelStr = this.formatLabels(labels);
            lines.push(`# TYPE ${name} counter`);
            lines.push(`${name}${labelStr} ${value}`);
        }

        // Gauges
        for (const [key, value] of this.gauges) {
            const { name, labels } = this.parseKey(key);
            const labelStr = this.formatLabels(labels);
            lines.push(`# TYPE ${name} gauge`);
            lines.push(`${name}${labelStr} ${value}`);
        }

        // Histograms
        for (const [key] of this.histograms) {
            const { name, labels } = this.parseKey(key);
            const labelStr = this.formatLabels(labels);
            const stats = this.getHistogramStats(name, labels);
            lines.push(`# TYPE ${name} histogram`);
            lines.push(`${name}_count${labelStr} ${stats.count}`);
            lines.push(`${name}_sum${labelStr} ${stats.sum}`);
            lines.push(`${name}_avg${labelStr} ${stats.avg}`);
        }

        return lines.join('\n');
    }

    /**
     * Reset all metrics
     */
    reset(): void {
        this.metrics.clear();
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
    }

    private makeKey(name: string, labels: Record<string, string>): string {
        const labelParts = Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`);
        return `${name}{${labelParts.join(',')}}`;
    }

    private parseKey(key: string): { name: string; labels: Record<string, string> } {
        const match = key.match(/^([^{]+)\{([^}]*)\}$/);
        if (!match) return { name: key, labels: {} };

        const name = match[1];
        const labels: Record<string, string> = {};
        if (match[2]) {
            match[2].split(',').forEach(pair => {
                const [k, v] = pair.split('=');
                if (k && v) labels[k] = v;
            });
        }
        return { name, labels };
    }

    private formatLabels(labels: Record<string, string>): string {
        const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
        return pairs.length > 0 ? `{${pairs.join(',')}}` : '';
    }
}

// ============================================
// TRACING SERVICE
// ============================================

class TracingService {
    private traces: Map<string, Trace> = new Map();
    private maxTraces = 1000;

    /**
     * Start a new trace span
     */
    startSpan(
        operationName: string,
        serviceName: string,
        parentSpanId?: string,
        tags: Record<string, string> = {}
    ): Trace {
        const trace: Trace = {
            traceId: this.generateId(),
            spanId: this.generateId(),
            parentSpanId,
            operationName,
            serviceName,
            startTime: new Date(),
            status: 'in_progress',
            tags,
            logs: []
        };

        this.traces.set(trace.traceId, trace);

        // Cleanup old traces
        if (this.traces.size > this.maxTraces) {
            const oldestKey = this.traces.keys().next().value;
            if (oldestKey) this.traces.delete(oldestKey);
        }

        return trace;
    }

    /**
     * End a trace span
     */
    endSpan(traceId: string, status: 'success' | 'error' = 'success'): void {
        const trace = this.traces.get(traceId);
        if (trace) {
            trace.endTime = new Date();
            trace.durationMs = trace.endTime.getTime() - trace.startTime.getTime();
            trace.status = status;
        }
    }

    /**
     * Add log to trace
     */
    addLog(traceId: string, level: TraceLog['level'], message: string, fields?: Record<string, unknown>): void {
        const trace = this.traces.get(traceId);
        if (trace) {
            trace.logs.push({
                timestamp: new Date(),
                level,
                message,
                fields
            });
        }
    }

    /**
     * Get trace by ID
     */
    getTrace(traceId: string): Trace | undefined {
        return this.traces.get(traceId);
    }

    /**
     * Get recent traces
     */
    getRecentTraces(limit: number = 50): Trace[] {
        return Array.from(this.traces.values())
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
            .slice(0, limit);
    }

    /**
     * Get slow traces (> thresholdMs)
     */
    getSlowTraces(thresholdMs: number, limit: number = 20): Trace[] {
        return Array.from(this.traces.values())
            .filter(t => t.durationMs && t.durationMs > thresholdMs)
            .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
            .slice(0, limit);
    }

    /**
     * Get failed traces
     */
    getFailedTraces(limit: number = 20): Trace[] {
        return Array.from(this.traces.values())
            .filter(t => t.status === 'error')
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
            .slice(0, limit);
    }

    private generateId(): string {
        return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }
}

// ============================================
// HEALTH CHECK SERVICE
// ============================================

class HealthCheckService {
    private startTime = Date.now();
    private version = process.env.APP_VERSION || '1.0.0';

    /**
     * Run all health checks
     */
    async checkHealth(): Promise<HealthStatus> {
        const checks: HealthCheck[] = [];

        // Database check
        checks.push(await this.checkDatabase());

        // Blockchain RPC check
        checks.push(await this.checkBlockchainRpc());

        // MCP Server check
        checks.push(await this.checkMcpServer());

        // Determine overall status
        const failedCritical = checks.filter(c => c.status === 'fail').length;
        const warnings = checks.filter(c => c.status === 'warn').length;

        let status: HealthStatus['status'] = 'healthy';
        if (failedCritical > 0) status = 'unhealthy';
        else if (warnings > 0) status = 'degraded';

        return {
            status,
            timestamp: new Date(),
            checks,
            version: this.version,
            uptime: Date.now() - this.startTime
        };
    }

    /**
     * Check database connectivity
     */
    private async checkDatabase(): Promise<HealthCheck> {
        const start = Date.now();
        try {
            const { error } = await supabase.from('services').select('id').limit(1);
            const latency = Date.now() - start;

            if (error) {
                return {
                    name: 'database',
                    status: 'fail',
                    latencyMs: latency,
                    message: error.message,
                    lastChecked: new Date()
                };
            }

            return {
                name: 'database',
                status: latency > 1000 ? 'warn' : 'pass',
                latencyMs: latency,
                message: latency > 1000 ? 'High latency' : undefined,
                lastChecked: new Date()
            };
        } catch (error) {
            return {
                name: 'database',
                status: 'fail',
                latencyMs: Date.now() - start,
                message: (error as Error).message,
                lastChecked: new Date()
            };
        }
    }

    /**
     * Check blockchain RPC
     */
    private async checkBlockchainRpc(): Promise<HealthCheck> {
        const start = Date.now();
        const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';

        try {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_blockNumber',
                    params: [],
                    id: 1
                }),
                signal: AbortSignal.timeout(5000)
            });

            const latency = Date.now() - start;

            if (!response.ok) {
                return {
                    name: 'blockchain_rpc',
                    status: 'fail',
                    latencyMs: latency,
                    message: `HTTP ${response.status}`,
                    lastChecked: new Date()
                };
            }

            return {
                name: 'blockchain_rpc',
                status: latency > 2000 ? 'warn' : 'pass',
                latencyMs: latency,
                message: latency > 2000 ? 'High RPC latency' : undefined,
                lastChecked: new Date()
            };
        } catch (error) {
            return {
                name: 'blockchain_rpc',
                status: 'fail',
                latencyMs: Date.now() - start,
                message: (error as Error).message,
                lastChecked: new Date()
            };
        }
    }

    /**
     * Check MCP server (if running)
     */
    private async checkMcpServer(): Promise<HealthCheck> {
        const start = Date.now();
        const mcpPort = process.env.MCP_PORT || 3002;

        try {
            const response = await fetch(`http://localhost:${mcpPort}/health`, {
                signal: AbortSignal.timeout(3000)
            });

            const latency = Date.now() - start;

            return {
                name: 'mcp_server',
                status: response.ok ? 'pass' : 'warn',
                latencyMs: latency,
                message: response.ok ? undefined : 'MCP server not responding',
                lastChecked: new Date()
            };
        } catch {
            // MCP server might not have a health endpoint
            return {
                name: 'mcp_server',
                status: 'warn',
                latencyMs: Date.now() - start,
                message: 'MCP server health check unavailable',
                lastChecked: new Date()
            };
        }
    }

    /**
     * Get uptime in human readable format
     */
    getUptimeFormatted(): string {
        const ms = Date.now() - this.startTime;
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
}

// ============================================
// ALERT MANAGER
// ============================================

class AlertManager {
    private thresholds: AlertThreshold[] = [];
    private alertHistory: { alert: AlertThreshold; value: number; timestamp: Date }[] = [];

    constructor() {
        // Default thresholds
        this.addThreshold({
            metric: 'request_latency_p95',
            operator: 'gt',
            value: 5000,
            severity: 'warning',
            message: 'P95 latency exceeds 5 seconds'
        });

        this.addThreshold({
            metric: 'error_rate',
            operator: 'gt',
            value: 0.05,
            severity: 'critical',
            message: 'Error rate exceeds 5%'
        });

        this.addThreshold({
            metric: 'memory_usage_mb',
            operator: 'gt',
            value: 1024,
            severity: 'warning',
            message: 'Memory usage exceeds 1GB'
        });
    }

    /**
     * Add alert threshold
     */
    addThreshold(threshold: AlertThreshold): void {
        this.thresholds.push(threshold);
    }

    /**
     * Check value against thresholds
     */
    checkThresholds(metric: string, value: number): AlertThreshold[] {
        const triggered: AlertThreshold[] = [];

        for (const threshold of this.thresholds) {
            if (threshold.metric !== metric) continue;

            let isTriggered = false;
            switch (threshold.operator) {
                case 'gt': isTriggered = value > threshold.value; break;
                case 'lt': isTriggered = value < threshold.value; break;
                case 'eq': isTriggered = value === threshold.value; break;
                case 'gte': isTriggered = value >= threshold.value; break;
                case 'lte': isTriggered = value <= threshold.value; break;
            }

            if (isTriggered) {
                triggered.push(threshold);
                this.alertHistory.push({ alert: threshold, value, timestamp: new Date() });

                // Log alert
                if (threshold.severity === 'critical') {
                    logger.error('Alert triggered', new Error(threshold.message), { metric, value });
                } else {
                    logger.warn('Alert triggered', { metric, value, message: threshold.message });
                }
            }
        }

        return triggered;
    }

    /**
     * Get alert history
     */
    getAlertHistory(limit: number = 50): typeof this.alertHistory {
        return this.alertHistory.slice(-limit);
    }

    /**
     * Clear alert history
     */
    clearHistory(): void {
        this.alertHistory = [];
    }
}

// ============================================
// OBSERVABILITY SERVICE (FACADE)
// ============================================

export class ObservabilityService {
    private static instance: ObservabilityService;

    public metrics: MetricsCollector;
    public tracing: TracingService;
    public health: HealthCheckService;
    public alerts: AlertManager;

    private constructor() {
        this.metrics = new MetricsCollector();
        this.tracing = new TracingService();
        this.health = new HealthCheckService();
        this.alerts = new AlertManager();

        // Initialize default metrics
        this.initDefaultMetrics();
    }

    static getInstance(): ObservabilityService {
        if (!ObservabilityService.instance) {
            ObservabilityService.instance = new ObservabilityService();
        }
        return ObservabilityService.instance;
    }

    /**
     * Initialize default metric counters
     */
    private initDefaultMetrics(): void {
        this.metrics.setGauge('app_info', 1, {
            version: process.env.APP_VERSION || '1.0.0',
            node_version: process.version
        });
    }

    /**
     * Track HTTP request
     */
    trackRequest(method: string, path: string, statusCode: number, durationMs: number): void {
        const labels = { method, path: this.normalizePath(path) };

        this.metrics.incrementCounter('http_requests_total', { ...labels, status: String(statusCode) });
        this.metrics.observeHistogram('http_request_duration_ms', durationMs, labels);

        if (statusCode >= 400) {
            this.metrics.incrementCounter('http_errors_total', labels);
        }

        // Check latency alerts
        const stats = this.metrics.getHistogramStats('http_request_duration_ms', labels);
        this.alerts.checkThresholds('request_latency_p95', stats.p95);
    }

    /**
     * Track MCP tool call
     */
    trackMcpCall(toolName: string, success: boolean, durationMs: number): void {
        const labels = { tool: toolName };

        this.metrics.incrementCounter('mcp_calls_total', { ...labels, success: String(success) });
        this.metrics.observeHistogram('mcp_call_duration_ms', durationMs, labels);

        if (!success) {
            this.metrics.incrementCounter('mcp_errors_total', labels);
        }
    }

    /**
     * Track x402 payment
     */
    trackPayment(status: 'success' | 'failed' | 'pending', amountUsd: number): void {
        this.metrics.incrementCounter('x402_payments_total', { status });
        if (status === 'success') {
            this.metrics.incrementCounter('x402_volume_usd', {}, amountUsd);
        }
    }

    /**
     * Track escrow session event
     */
    trackEscrowEvent(eventType: string, _sessionId: string): void {
        this.metrics.incrementCounter('escrow_events_total', { event_type: eventType });
    }

    /**
     * Get system metrics summary
     */
    async getSystemMetrics(): Promise<SystemMetrics> {
        const requestStats = this.metrics.getHistogramStats('http_request_duration_ms');
        const successfulRequests = this.metrics.getCounter('http_requests_total', { status: '200' });
        const failedRequests = this.metrics.getCounter('http_errors_total');

        return {
            requestsTotal: requestStats.count,
            requestsSuccessful: successfulRequests,
            requestsFailed: failedRequests,
            averageLatencyMs: requestStats.avg,
            activeConnections: this.metrics.getGauge('active_connections'),
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
            cpuPercent: 0, // Would need os.cpus() for accurate CPU
            uptime: Date.now() - this.health['startTime']
        };
    }

    /**
     * Normalize path for metrics (remove IDs)
     */
    private normalizePath(path: string): string {
        return path
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
            .replace(/\/\d+/g, '/:id')
            .replace(/\/0x[a-fA-F0-9]+/g, '/:address');
    }
}

// Export singleton
export const observability = ObservabilityService.getInstance();
