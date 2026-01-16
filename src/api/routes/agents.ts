/**
 * Agent API Routes
 * 
 * Express routes for agent discovery and invocation.
 * 
 * Endpoints:
 * - GET  /api/agents              - List/search agents
 * - GET  /api/agents/:id          - Get agent details
 * - POST /api/agents/:id/invoke   - Invoke an agent (x402 enabled)
 * - GET  /api/agents/:id/metrics  - Get agent metrics
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { agentRegistry } from '../../services/agents/registry';
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

        res.json({ agent });
    } catch (error) {
        logger.error('Failed to get agent', error as Error);
        res.status(500).json({ error: 'Failed to get agent' });
    }
});

// ============================================
// POST /api/agents/:id/invoke - Invoke agent
// ============================================

router.post('/:id/invoke', async (req: Request, res: Response) => {
    const startTime = performance.now();
    const id = req.params.id as string;

    try {
        // Get agent to check if it exists and requires payment
        const agent = agentRegistry.get(id);

        if (!agent) {
            return res.status(404).json({ error: `Agent not found: ${id}` });
        }

        // Check x402 payment if required
        const paymentId = req.headers['x-payment-id'] as string | undefined;

        if (agent.permissions.requires_payment && !paymentId) {
            // Return 402 Payment Required
            const validUntil = new Date();
            validUntil.setMinutes(validUntil.getMinutes() + 10);

            return res.status(402).json({
                status: 'payment_required',
                agent_id: id,
                amount: agent.permissions.payment_amount || '10000',
                token: 'USDC',
                tokenAddress: process.env.USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
                recipient: agent.owner,
                network: 'cronos_testnet',
                chainId: 338,
                resource: `/api/agents/${id}/invoke`,
                validUntil: validUntil.toISOString(),
            });
        }

        // If payment required and provided, verify it
        if (agent.permissions.requires_payment && paymentId) {
            // TODO: Verify payment on-chain
            // For now, we trust the payment ID is valid
            logger.info('Payment ID provided for agent invocation', {
                agentId: id,
                paymentId,
            });
        }

        // Invoke the agent
        const callerAddress = req.headers['x-wallet-address'];
        const correlationId = req.headers['x-correlation-id'];

        const result = await agentRegistry.invoke({
            agent_id: id,
            input: req.body,
            caller_address: typeof callerAddress === 'string' ? callerAddress : undefined,
            payment_id: paymentId,
            correlation_id: typeof correlationId === 'string' ? correlationId : undefined,
        });

        // If payment required response (shouldn't happen here but handle it)
        if ('status' in result && result.status === 'payment_required') {
            return res.status(402).json(result);
        }

        // Return result
        const executionTimeMs = Math.round(performance.now() - startTime);

        res.json({
            ...result,
            executionTimeMs,
        });
    } catch (error) {
        logger.error('Agent invocation failed', error as Error, { agentId: id });
        res.status(500).json({
            success: false,
            error: (error as Error).message,
            execution_time_ms: Math.round(performance.now() - startTime),
        });
    }
});

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
// GET /api/agents/:id/schema - Get input/output schema
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
