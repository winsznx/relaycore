/**
 * Observability API - Phase 10 Implementation
 * 
 * REST endpoints for monitoring:
 * - /health - Health check endpoint
 * - /metrics - Prometheus metrics
 * - /traces - Recent traces
 * - /alerts - Alert history
 */

import { Router } from 'express';
import { observability } from '../services/observability/observability-service.js';
import logger from '../lib/logger.js';

const router = Router();

// ============================================
// HEALTH ENDPOINTS
// ============================================

/**
 * GET /api/observability/health
 * Kubernetes-style health check
 */
router.get('/health', async (_req, res) => {
    try {
        const health = await observability.health.checkHealth();

        const statusCode = health.status === 'healthy' ? 200 :
            health.status === 'degraded' ? 200 : 503;

        res.status(statusCode).json(health);
    } catch (error) {
        logger.error('Health check failed', error as Error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date(),
            checks: [],
            error: (error as Error).message
        });
    }
});

/**
 * GET /api/observability/ready
 * Readiness probe
 */
router.get('/ready', async (_req, res) => {
    try {
        const health = await observability.health.checkHealth();

        if (health.status === 'unhealthy') {
            return res.status(503).json({ ready: false });
        }

        res.json({ ready: true, uptime: health.uptime });
    } catch {
        res.status(503).json({ ready: false });
    }
});

/**
 * GET /api/observability/live
 * Liveness probe
 */
router.get('/live', (_req, res) => {
    res.json({
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: observability.health.getUptimeFormatted()
    });
});

// ============================================
// METRICS ENDPOINTS
// ============================================

/**
 * GET /api/observability/metrics
 * Prometheus-format metrics
 */
router.get('/metrics', (_req, res) => {
    const metrics = observability.metrics.exportPrometheus();
    res.type('text/plain').send(metrics);
});

/**
 * GET /api/observability/metrics/json
 * JSON-format metrics summary
 */
router.get('/metrics/json', async (_req, res) => {
    try {
        const systemMetrics = await observability.getSystemMetrics();

        res.json({
            system: systemMetrics,
            histograms: {
                httpRequestDuration: observability.metrics.getHistogramStats('http_request_duration_ms'),
                mcpCallDuration: observability.metrics.getHistogramStats('mcp_call_duration_ms')
            },
            counters: {
                totalRequests: observability.metrics.getCounter('http_requests_total'),
                totalErrors: observability.metrics.getCounter('http_errors_total'),
                totalMcpCalls: observability.metrics.getCounter('mcp_calls_total'),
                totalPayments: observability.metrics.getCounter('x402_payments_total')
            }
        });
    } catch (error) {
        logger.error('Metrics export failed', error as Error);
        res.status(500).json({ error: 'Failed to export metrics' });
    }
});

// ============================================
// TRACING ENDPOINTS
// ============================================

/**
 * GET /api/observability/traces
 * Recent traces
 */
router.get('/traces', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const traces = observability.tracing.getRecentTraces(limit);
    res.json({ traces, count: traces.length });
});

/**
 * GET /api/observability/traces/slow
 * Slow traces (> threshold)
 */
router.get('/traces/slow', (req, res) => {
    const thresholdMs = parseInt(req.query.threshold as string) || 1000;
    const limit = parseInt(req.query.limit as string) || 20;
    const traces = observability.tracing.getSlowTraces(thresholdMs, limit);
    res.json({ traces, count: traces.length, thresholdMs });
});

/**
 * GET /api/observability/traces/failed
 * Failed traces
 */
router.get('/traces/failed', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const traces = observability.tracing.getFailedTraces(limit);
    res.json({ traces, count: traces.length });
});

/**
 * GET /api/observability/traces/:traceId
 * Single trace details
 */
router.get('/traces/:traceId', (req, res) => {
    const trace = observability.tracing.getTrace(req.params.traceId);

    if (!trace) {
        return res.status(404).json({ error: 'Trace not found' });
    }

    res.json({ trace });
});

// ============================================
// ALERT ENDPOINTS
// ============================================

/**
 * GET /api/observability/alerts
 * Alert history
 */
router.get('/alerts', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = observability.alerts.getAlertHistory(limit);
    res.json({ alerts, count: alerts.length });
});

/**
 * POST /api/observability/alerts/clear
 * Clear alert history
 */
router.post('/alerts/clear', (_req, res) => {
    observability.alerts.clearHistory();
    res.json({ success: true, message: 'Alert history cleared' });
});

// ============================================
// DEBUG ENDPOINTS
// ============================================

/**
 * GET /api/observability/debug/info
 * Debug information
 */
router.get('/debug/info', (_req, res) => {
    res.json({
        node: {
            version: process.version,
            platform: process.platform,
            arch: process.arch
        },
        memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
            external: Math.round(process.memoryUsage().external / 1024 / 1024) + ' MB'
        },
        uptime: observability.health.getUptimeFormatted(),
        environment: process.env.NODE_ENV || 'development'
    });
});

/**
 * GET /api/observability/indexers
 * Indexer status and stats
 */
router.get('/indexers', async (_req, res) => {
    try {
        // Get indexer state from database
        const { supabase } = await import('../lib/supabase.js');
        const { data: indexerStates } = await supabase
            .from('indexer_state')
            .select('*')
            .order('updated_at', { ascending: false });

        const indexers = [
            { name: 'Transaction Indexer', key: 'transaction_indexer', schedule: 'Every 1 min' },
            { name: 'Escrow Session Indexer', key: 'escrow_session_indexer', schedule: 'Every 2 min' },
            { name: 'Payment Indexer', key: 'payment_indexer', schedule: 'Every 5 min' },
            { name: 'Agent Indexer', key: 'agent_indexer', schedule: 'Every 15 min' },
            { name: 'Feedback Indexer', key: 'feedback_indexer', schedule: 'Every 15 min' },
            { name: 'USDC Transfer Indexer', key: 'usdc_transfer_indexer', schedule: 'Every 30 sec' },
            { name: 'RWA State Indexer', key: 'rwa_state_indexer', schedule: 'Every 2 min' },
            { name: 'Reputation Calculator', key: 'reputation_calculator', schedule: 'Daily 1:00 AM' }
        ];

        const indexerStatus = indexers.map(indexer => {
            const state = indexerStates?.find(s => s.indexer_name === indexer.key);
            return {
                name: indexer.name,
                schedule: indexer.schedule,
                lastBlock: state?.last_block || 0,
                lastRun: state?.updated_at || null,
                status: state ? 'active' : 'pending'
            };
        });

        res.json({ indexers: indexerStatus });
    } catch (error) {
        logger.error('Failed to get indexer status', error as Error);
        res.status(500).json({ error: 'Failed to get indexer status' });
    }
});

/**
 * GET /api/observability/connections
 * Connection status for RPC and DB
 */
router.get('/connections', async (_req, res) => {
    try {
        const connections = [];

        // Check RPC
        try {
            const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
            const rpcRes = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
                signal: AbortSignal.timeout(5000)
            });
            const rpcData = await rpcRes.json() as { result?: string };
            connections.push({
                name: 'Cronos RPC',
                status: 'connected',
                latestBlock: rpcData.result ? parseInt(rpcData.result, 16) : 0
            });
        } catch (error) {
            connections.push({
                name: 'Cronos RPC',
                status: 'disconnected',
                error: (error as Error).message
            });
        }

        // Check Supabase
        try {
            const { supabase } = await import('../lib/supabase.js');
            const start = Date.now();
            await supabase.from('services').select('count').limit(1);
            connections.push({
                name: 'Supabase DB',
                status: 'connected',
                latencyMs: Date.now() - start
            });
        } catch (error) {
            connections.push({
                name: 'Supabase DB',
                status: 'disconnected',
                error: (error as Error).message
            });
        }

        res.json({ connections });
    } catch (error) {
        logger.error('Failed to get connection status', error as Error);
        res.status(500).json({ error: 'Failed to get connection status' });
    }
});

export default router;
