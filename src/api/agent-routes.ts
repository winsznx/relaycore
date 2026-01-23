/**
 * Agent Invocation API
 * 
 * Production-grade agent execution with:
 * - x402 payment enforcement
 * - Transaction recording
 * - Metrics tracking
 * - Graph indexing
 */

import { Router } from 'express';
import { agentRegistry } from '../services/agents/registry';
import { supabase } from '../lib/supabase';
import logger from '../lib/logger';
import { ethers } from 'ethers';

const router = Router();

/**
 * POST /api/agents/:agentId/invoke
 * 
 * Invoke an agent with payment verification
 */
router.post('/:agentId/invoke', async (req, res) => {
    const startTime = Date.now();
    const { agentId } = req.params;
    const { input, paymentHeader, userAddress } = req.body;

    try {
        // Get agent from registry
        const agent = agentRegistry.get(agentId);
        if (!agent) {
            return res.status(404).json({
                error: 'Agent not found',
                agentId
            });
        }

        // Get service record for payment tracking
        const { data: service } = await supabase
            .from('services')
            .select('id, name, price_per_call, owner_address')
            .eq('name', agent.config.name)
            .single();

        if (!service) {
            logger.error('Service record not found for agent', { agentId, name: agent.config.name });
            return res.status(500).json({ error: 'Service configuration error' });
        }

        const requiresPayment = agent.config.permissions.requires_payment;
        const paymentAmount = agent.config.permissions.payment_amount || '0';
        let paymentId: string | null = null;
        let txHash: string | null = null;

        // Verify payment if required
        if (requiresPayment && parseFloat(paymentAmount) > 0) {
            if (!paymentHeader) {
                return res.status(402).json({
                    error: 'Payment required',
                    amount: paymentAmount,
                    asset: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0', // USDC
                    payTo: service.owner_address
                });
            }

            // Parse x402 payment header
            const payment = parsePaymentHeader(paymentHeader);
            if (!payment) {
                return res.status(400).json({ error: 'Invalid payment header' });
            }

            // Verify payment amount
            if (parseFloat(payment.amount) < parseFloat(paymentAmount)) {
                return res.status(402).json({
                    error: 'Insufficient payment',
                    required: paymentAmount,
                    provided: payment.amount
                });
            }

            // Verify payment on-chain
            const isValid = await verifyPaymentOnChain(payment);
            if (!isValid) {
                return res.status(402).json({ error: 'Payment verification failed' });
            }

            paymentId = payment.paymentId;
            txHash = payment.txHash;

            // Record payment
            await recordPayment({
                paymentId,
                serviceId: service.id,
                fromAddress: userAddress || payment.from,
                toAddress: service.owner_address,
                amount: payment.amount,
                txHash,
                status: 'settled'
            });
        }

        // Execute agent
        logger.info('Executing agent', {
            agentId,
            requiresPayment,
            paymentAmount,
            paymentId
        });

        const result = await agent.handler(input);
        const executionTime = Date.now() - startTime;

        // Record invocation
        await recordInvocation({
            serviceId: service.id,
            agentId,
            input,
            output: result,
            userAddress,
            paymentId,
            txHash,
            executionTime,
            status: 'success'
        });

        // Update metrics
        await updateServiceMetrics(service.id, executionTime, true);

        res.json({
            result,
            metadata: {
                agentId,
                executionTime,
                paymentId,
                txHash
            }
        });

    } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error('Agent invocation failed', error as Error);

        // Record failed invocation
        if (agentId) {
            const { data: service } = await supabase
                .from('services')
                .select('id')
                .eq('name', agentId)
                .single();

            if (service) {
                await recordInvocation({
                    serviceId: service.id,
                    agentId,
                    input: req.body.input,
                    output: null,
                    userAddress: req.body.userAddress,
                    paymentId: null,
                    txHash: null,
                    executionTime,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                await updateServiceMetrics(service.id, executionTime, false);
            }
        }

        res.status(500).json({
            error: 'Agent execution failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/agents/:agentId
 * 
 * Get agent details
 */
router.get('/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const agent = agentRegistry.get(agentId);

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        res.json({
            id: agent.config.id,
            name: agent.config.name,
            description: agent.config.description,
            type: agent.config.agent_type,
            modes: agent.config.interaction_modes,
            inputSchema: agent.config.input_schema,
            outputSchema: agent.config.output_schema,
            permissions: agent.config.permissions,
            metadata: agent.config.metadata
        });
    } catch (error) {
        logger.error('Agent detail fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch agent details' });
    }
});

/**
 * GET /api/agents
 * 
 * List all registered agents
 */
router.get('/', async (req, res) => {
    try {
        const agents = agentRegistry.list().map(agent => ({
            id: agent.config.id,
            name: agent.config.name,
            description: agent.config.description,
            type: agent.config.agent_type,
            modes: agent.config.interaction_modes,
            requiresPayment: agent.config.permissions.requires_payment,
            paymentAmount: agent.config.permissions.payment_amount,
            categories: agent.config.metadata.categories,
            tags: agent.config.metadata.tags
        }));

        res.json({ agents });
    } catch (error) {
        logger.error('Agent list fetch failed', error as Error);
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

// Helper functions

function parsePaymentHeader(header: string): {
    paymentId: string;
    from: string;
    amount: string;
    txHash: string;
} | null {
    try {
        const parts = header.split(';').map(p => p.trim());
        const data: Record<string, string> = {};

        for (const part of parts) {
            const [key, value] = part.split('=');
            if (key && value) {
                data[key.trim()] = value.trim().replace(/"/g, '');
            }
        }

        if (!data.payment_id || !data.from || !data.amount || !data.tx_hash) {
            return null;
        }

        return {
            paymentId: data.payment_id,
            from: data.from,
            amount: data.amount,
            txHash: data.tx_hash
        };
    } catch {
        return null;
    }
}

async function verifyPaymentOnChain(payment: {
    txHash: string;
    from: string;
    amount: string;
}): Promise<boolean> {
    try {
        const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        const receipt = await provider.getTransactionReceipt(payment.txHash);
        if (!receipt || receipt.status !== 1) {
            return false;
        }

        // Additional verification can be added here
        return true;
    } catch (error) {
        logger.error('Payment verification failed', error as Error);
        return false;
    }
}

async function recordPayment(payment: {
    paymentId: string;
    serviceId: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    txHash: string;
    status: string;
}) {
    try {
        await supabase.from('payments').insert({
            payment_id: payment.paymentId,
            service_id: payment.serviceId,
            from_address: payment.fromAddress.toLowerCase(),
            to_address: payment.toAddress.toLowerCase(),
            amount: payment.amount,
            token_address: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0', // USDC
            tx_hash: payment.txHash,
            status: payment.status,
            timestamp: new Date().toISOString()
        });

        logger.info('Payment recorded', {
            paymentId: payment.paymentId,
            serviceId: payment.serviceId,
            amount: payment.amount
        });
    } catch (error) {
        logger.error('Failed to record payment', error as Error);
    }
}

async function recordInvocation(invocation: {
    serviceId: string;
    agentId: string;
    input: unknown;
    output: unknown;
    userAddress?: string;
    paymentId: string | null;
    txHash: string | null;
    executionTime: number;
    status: string;
    error?: string;
}) {
    try {
        await supabase.from('agent_invocations').insert({
            service_id: invocation.serviceId,
            agent_id: invocation.agentId,
            input: invocation.input,
            output: invocation.output,
            user_address: invocation.userAddress?.toLowerCase(),
            payment_id: invocation.paymentId,
            tx_hash: invocation.txHash,
            execution_time_ms: invocation.executionTime,
            status: invocation.status,
            error_message: invocation.error,
            created_at: new Date().toISOString()
        });

        logger.info('Invocation recorded', {
            serviceId: invocation.serviceId,
            agentId: invocation.agentId,
            status: invocation.status,
            executionTime: invocation.executionTime
        });
    } catch (error) {
        logger.error('Failed to record invocation', error as Error);
    }
}

async function updateServiceMetrics(
    serviceId: string,
    executionTime: number,
    success: boolean
) {
    try {
        // Get current reputation
        const { data: rep } = await supabase
            .from('reputations')
            .select('*')
            .eq('service_id', serviceId)
            .single();

        if (!rep) {
            logger.warn('No reputation record found', { serviceId });
            return;
        }

        const totalPayments = rep.total_payments + 1;
        const successfulPayments = rep.successful_payments + (success ? 1 : 0);
        const failedPayments = rep.failed_payments + (success ? 0 : 1);

        // Calculate new average latency
        const currentAvg = rep.avg_latency_ms || 0;
        const newAvg = ((currentAvg * rep.total_payments) + executionTime) / totalPayments;

        // Calculate new reputation score
        const successRate = successfulPayments / totalPayments;
        const latencyScore = Math.max(0, 100 - (newAvg / 10)); // Penalize high latency
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

        logger.info('Service metrics updated', {
            serviceId,
            totalPayments,
            successRate: (successRate * 100).toFixed(2),
            avgLatency: Math.round(newAvg),
            reputationScore
        });
    } catch (error) {
        logger.error('Failed to update service metrics', error as Error);
    }
}

export default router;
