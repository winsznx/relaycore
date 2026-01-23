/**
 * Agent API Routes
 * 
 * Production-grade agent execution with:
 * - x402 payment enforcement
 * - Transaction recording
 * - Metrics tracking
 * - Invocation history
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { agentRegistry } from '../../services/agents/registry';
import { supabase } from '../../lib/supabase';
import logger from '../../lib/logger';
import type { AgentFilters } from '../../types/agent';

const router = Router();

// ============================================
// GET /api/agents - List agents with filters
// ============================================

router.get('/', async (req: Request, res: Response) => {
    try {
        const filters: AgentFilters = {
            agent_type: req.query.agent_type as AgentFilters['agent_type'],
            interaction_mode: req.query.interaction_mode as AgentFilters['interaction_mode'],
            category: req.query.category as string,
            min_reputation: req.query.min_reputation ? Number(req.query.min_reputation) : undefined,
            verified_only: req.query.verified_only === 'true',
            query: req.query.q as string,
            sort_by: req.query.sort_by as AgentFilters['sort_by'],
            sort_order: req.query.sort_order as AgentFilters['sort_order'],
            limit: req.query.limit ? Number(req.query.limit) : 20,
            offset: req.query.offset ? Number(req.query.offset) : 0,
        };

        const result = await agentRegistry.list(filters);

        res.json(result);
    } catch (error) {
        logger.error('Failed to list agents', error as Error);
        res.status(500).json({ error: 'Failed to list agents' });
    }
});

// ============================================
// GET /api/agents/:id - Get agent details
// ============================================

router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const agent = agentRegistry.get(id);

        if (!agent) {
            return res.status(404).json({ error: `Agent not found: ${id}` });
        }

        res.json({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            type: agent.agent_type,
            modes: agent.interaction_modes,
            inputSchema: agent.input_schema,
            outputSchema: agent.output_schema,
            permissions: agent.permissions,
            metadata: agent.metadata,
            reputation_score: agent.reputation_score,
            total_invocations: agent.total_invocations
        });
    } catch (error) {
        logger.error('Failed to get agent', error as Error);
        res.status(500).json({ error: 'Failed to get agent' });
    }
});

// ============================================
// POST /api/agents/:id/invoke - Invoke agent
// WITH FULL TRACKING
// ============================================

router.post('/:id/invoke', async (req: Request, res: Response) => {
    const startTime = performance.now();
    const id = req.params.id as string;
    let serviceId: string | null = null;

    try {
        const agent = agentRegistry.get(id);

        if (!agent) {
            return res.status(404).json({ error: `Agent not found: ${id}` });
        }

        // Get service record for tracking
        const { data: service } = await supabase
            .from('services')
            .select('id, name, price_per_call, owner_address')
            .eq('name', agent.name)
            .single();

        if (service) {
            serviceId = service.id;
        }

        const paymentId = req.headers['x-payment-id'] as string | undefined;
        const callerAddress = req.headers['x-wallet-address'] as string | undefined;

        if (agent.permissions.requires_payment && !paymentId) {
            const validUntil = new Date();
            validUntil.setMinutes(validUntil.getMinutes() + 10);

            return res.status(402).json({
                status: 'payment_required',
                agent_id: id,
                amount: agent.permissions.payment_amount || '10000',
                token: 'USDC',
                tokenAddress: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
                recipient: agent.owner,
                network: 'cronos_testnet',
                chainId: 338,
                resource: `/api/agents/${id}/invoke`,
                validUntil: validUntil.toISOString(),
            });
        }

        let txHash: string | null = null;

        if (agent.permissions.requires_payment && paymentId) {
            const { isEntitled } = await import('../../lib/x402/x402-middleware.js');
            if (!isEntitled(paymentId)) {
                return res.status(402).json({
                    error: 'Payment not verified',
                    paymentId,
                });
            }

            // Record payment
            if (serviceId && callerAddress) {
                const paymentAmount = agent.permissions.payment_amount || '0';
                await supabase.from('payments').insert({
                    payment_id: paymentId,
                    service_id: serviceId,
                    from_address: callerAddress.toLowerCase(),
                    to_address: agent.owner.toLowerCase(),
                    amount: paymentAmount,
                    token_address: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
                    tx_hash: paymentId,
                    status: 'settled',
                    timestamp: new Date().toISOString()
                });
                txHash = paymentId;
            }
        }

        // Invoke agent
        const correlationId = req.headers['x-correlation-id'];
        const result = await agentRegistry.invoke({
            agent_id: id,
            input: req.body,
            caller_address: callerAddress,
            payment_id: paymentId,
            correlation_id: typeof correlationId === 'string' ? correlationId : undefined,
        });

        if ('status' in result && result.status === 'payment_required') {
            return res.status(402).json(result);
        }

        const executionTimeMs = Math.round(performance.now() - startTime);

        // Record invocation
        if (serviceId) {
            await supabase.from('agent_invocations').insert({
                service_id: serviceId,
                agent_id: id,
                input: req.body,
                output: result,
                user_address: callerAddress?.toLowerCase(),
                payment_id: paymentId || null,
                tx_hash: txHash,
                execution_time_ms: executionTimeMs,
                status: 'success'
            });

            await updateServiceMetrics(serviceId, executionTimeMs, true);
        }

        res.json({
            ...result,
            executionTimeMs,
        });
    } catch (error) {
        const executionTimeMs = Math.round(performance.now() - startTime);
        logger.error('Agent invocation failed', error as Error, { agentId: id });

        // Record failed invocation
        if (serviceId) {
            await supabase.from('agent_invocations').insert({
                service_id: serviceId,
                agent_id: id,
                input: req.body,
                output: null,
                user_address: req.headers['x-wallet-address'] as string | undefined,
                payment_id: req.headers['x-payment-id'] as string | undefined,
                tx_hash: null,
                execution_time_ms: executionTimeMs,
                status: 'failed',
                error_message: (error as Error).message
            });

            await updateServiceMetrics(serviceId, executionTimeMs, false);
        }

        res.status(500).json({
            success: false,
            error: (error as Error).message,
            execution_time_ms: executionTimeMs,
        });
    }
});

// Helper: Update service metrics
async function updateServiceMetrics(
    serviceId: string,
    executionTime: number,
    success: boolean
) {
    try {
        const { data: rep } = await supabase
            .from('reputations')
            .select('*')
            .eq('service_id', serviceId)
            .single();

        if (!rep) return;

        const totalPayments = rep.total_payments + 1;
        const successfulPayments = rep.successful_payments + (success ? 1 : 0);
        const failedPayments = rep.failed_payments + (success ? 0 : 1);

        const currentAvg = rep.avg_latency_ms || 0;
        const newAvg = ((currentAvg * rep.total_payments) + executionTime) / totalPayments;

        const successRate = successfulPayments / totalPayments;
        const latencyScore = Math.max(0, 100 - (newAvg / 10));
        const reputationScore = Math.round((successRate * 70) + (latencyScore * 0.3));

        await supabase
            .from('reputations')
            .update({
                total_payments: totalPayments,
                successful_payments: successfulPayments,
                failed_payments: failedPayments,
                avg_latency_ms: Math.round(newAvg),
                success_rate: successRate * 100,
                reputation_score: Math.min(100, Math.max(0, reputationScore))
            })
            .eq('service_id', serviceId);

        logger.info('Metrics updated', {
            serviceId,
            totalPayments,
            successRate: (successRate * 100).toFixed(2),
            reputationScore
        });
    } catch (error) {
        logger.error('Failed to update metrics', error as Error);
    }
}

// ============================================
// GET /api/agents/:id/metrics - Get metrics
// ============================================

router.get('/:id/metrics', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const periodDays = req.query.period ? Number(req.query.period) : 7;

        const metrics = await agentRegistry.getMetrics(id, periodDays);

        if (!metrics) {
            return res.status(404).json({ error: `Agent not found: ${id}` });
        }

        res.json({ metrics });
    } catch (error) {
        logger.error('Failed to get agent metrics', error as Error);
        res.status(500).json({ error: 'Failed to get agent metrics' });
    }
});

// ============================================
// GET /api/agents/:id/schema - Get schema
// ============================================

router.get('/:id/schema', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const agent = agentRegistry.get(id);

        if (!agent) {
            return res.status(404).json({ error: `Agent not found: ${id}` });
        }

        res.json({
            agent_id: id,
            input_schema: agent.input_schema,
            output_schema: agent.output_schema,
        });
    } catch (error) {
        logger.error('Failed to get agent schema', error as Error);
        res.status(500).json({ error: 'Failed to get agent schema' });
    }
});

export default router;
