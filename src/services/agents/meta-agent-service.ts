/**
 * Meta-Agent Service
 * Agent discovery, evaluation, hiring, and delegation
 *
 * Uses REAL x402/EIP-3009 payments via Facilitator SDK
 */

import { supabase } from '../../lib/supabase.js';
import logger from '../../lib/logger.js';
import { ethers } from 'ethers';
import { Facilitator, type PaymentRequirements, CronosNetwork } from '@crypto.com/facilitator-client';
import { escrowPaymentHelper } from '../escrow/escrow-payment-helper.js';
import { SessionManager } from '../session/session-manager.js';
import type {
    AgentCard,
    AgentDiscoveryQuery,
    AgentScore,
    HireAgentRequest,
    HireAgentResult,
    DelegationOutcome
} from '../../types/meta-agent.js';

export class MetaAgentService {
    private sessionManager: SessionManager;
    private facilitator: Facilitator;
    private network: CronosNetwork;
    private relayWallet: ethers.Wallet | null = null;

    constructor() {
        this.sessionManager = new SessionManager(supabase);
        this.network = (process.env.CRONOS_NETWORK || 'cronos-testnet') as CronosNetwork;
        this.facilitator = new Facilitator({ network: this.network });

        // Initialize Relay wallet for signing x402 payments
        const relayPrivateKey = process.env.RELAY_PRIVATE_KEY;
        if (relayPrivateKey) {
            const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            this.relayWallet = new ethers.Wallet(relayPrivateKey, provider);
            logger.info('MetaAgentService initialized with x402 Facilitator', {
                network: this.network,
                relayWallet: this.relayWallet.address
            });
        } else {
            logger.warn('RELAY_PRIVATE_KEY not set - x402 agent payments will fail');
        }
    }
    /**
     * Discover agents based on criteria
     */
    async discoverAgents(query: AgentDiscoveryQuery): Promise<AgentScore[]> {
        logger.info('Discovering agents', query);

        let dbQuery = supabase
            .from('services')
            .select(`
                id,
                name,
                endpoint_url,
                owner_address,
                category,
                price_per_call,
                is_active,
                reputations (
                    reputation_score,
                    successful_payments,
                    total_payments,
                    avg_latency_ms
                )
            `)
            .eq('is_active', query.isActive !== false);

        if (query.category) {
            dbQuery = dbQuery.eq('category', query.category);
        }

        if (query.maxPricePerCall) {
            dbQuery = dbQuery.lte('price_per_call', query.maxPricePerCall);
        }

        const { data: services, error } = await dbQuery.limit(query.limit || 20);

        if (error) {
            logger.error('Failed to discover agents', error);
            throw new Error(`Discovery failed: ${error.message}`);
        }

        if (!services || services.length === 0) {
            return [];
        }

        // Score and rank agents
        const scoredAgents: AgentScore[] = [];

        for (const service of services) {
            const rep = Array.isArray(service.reputations) ? service.reputations[0] : service.reputations;

            // Use default values if no reputation record exists
            const reputationScore = rep?.reputation_score || 80; // Default to good score for new agents
            const totalPayments = rep?.total_payments || 0;
            const successfulPayments = rep?.successful_payments || 0;
            const successRate = totalPayments > 0
                ? (successfulPayments / totalPayments) * 100
                : 100; // Default to 100% for new agents

            // Apply reputation filter
            if (query.minReputation && reputationScore < query.minReputation) {
                continue;
            }

            // Fetch agent card if endpoint available
            let card: AgentCard | undefined;
            if (service.endpoint_url) {
                try {
                    card = await this.fetchAgentCard(service.endpoint_url);

                    // Filter by capability if specified
                    if (query.capability && card) {
                        const hasCapability = card.resources.some(r =>
                            r.id.includes(query.capability!) ||
                            r.title.toLowerCase().includes(query.capability!.toLowerCase())
                        );
                        if (!hasCapability) continue;
                    }
                } catch (error) {
                    logger.warn('Failed to fetch agent card', {
                        agentId: service.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // Calculate composite score (0-100)
            const weights = {
                reputation: 0.4,
                successRate: 0.3,
                price: 0.2,
                latency: 0.1
            };

            const priceScore = Math.max(0, 100 - (parseFloat(service.price_per_call || '0') * 100));
            const latencyScore = Math.max(0, 100 - ((rep?.avg_latency_ms || 200) / 10)); // Default to 200ms for new agents

            const compositeScore =
                reputationScore * weights.reputation +
                successRate * weights.successRate +
                priceScore * weights.price +
                latencyScore * weights.latency;

            scoredAgents.push({
                agentId: service.id,
                agentName: service.name,
                agentUrl: service.endpoint_url || '',
                ownerAddress: service.owner_address,
                reputationScore,
                pricePerCall: service.price_per_call || '0',
                successRate,
                avgLatencyMs: rep?.avg_latency_ms || 0,
                compositeScore: Math.round(compositeScore * 10) / 10,
                card
            });
        }

        // Sort by composite score (best first)
        scoredAgents.sort((a, b) => b.compositeScore - a.compositeScore);

        logger.info('Agents discovered', { count: scoredAgents.length });
        return scoredAgents;
    }

    /**
     * Fetch agent card from /.well-known/agent-card.json
     */
    async fetchAgentCard(baseUrl: string): Promise<AgentCard | undefined> {
        const urls = [
            `${baseUrl}/.well-known/agent-card.json`,
            `${baseUrl}/.well-known/agent.json`
        ];

        for (const url of urls) {
            try {
                const response = await fetch(url, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(5000)
                });

                if (response.ok) {
                    const card = await response.json();
                    return card as AgentCard;
                }
            } catch (error) {
                // Try next URL
                continue;
            }
        }

        return undefined;
    }

    /**
     * Hire an agent to perform a task
     */
    async hireAgent(request: HireAgentRequest, metaAgentId: string): Promise<HireAgentResult> {
        logger.info('Hiring agent', { agentId: request.agentId, metaAgentId });

        // Get agent details
        const { data: agent, error: agentError } = await supabase
            .from('services')
            .select('*')
            .eq('id', request.agentId)
            .single();

        if (agentError || !agent) {
            throw new Error(`Agent not found: ${request.agentId}`);
        }

        // Economic reasoning: Check if cost is within budget
        const cost = parseFloat(agent.price_per_call || '0');
        const budget = parseFloat(request.budget);

        if (cost > budget) {
            throw new Error(`Cost ${cost} exceeds budget ${budget}`);
        }

        // Use service endpoint directly (no agent card required)
        const resourceUrl = request.resourceId || agent.endpoint_url;

        if (!resourceUrl) {
            throw new Error(`No endpoint URL found for agent ${request.agentId}`);
        }

        logger.info('Using agent endpoint', {
            agentId: request.agentId,
            endpoint: resourceUrl,
            cost
        });

        // Check for active session first (off-chain, gasless)
        const activeSession = await this.sessionManager.getActiveSession(metaAgentId);
        let paymentResult: { method: string; txHash?: string; escrowSessionId?: number };

        if (activeSession) {
            // Use session-based payment (gasless x402)
            logger.info('Using session for payment', { sessionId: activeSession.session_id });

            const budgetCheck = await this.sessionManager.checkBudget(
                activeSession.session_id,
                cost.toString()
            );

            if (!budgetCheck.canAfford) {
                throw new Error(`Session budget exceeded: ${budgetCheck.reason}`);
            }

            // Payment will be made via x402 (gasless) and recorded in session
            paymentResult = {
                method: 'session',
                escrowSessionId: activeSession.session_id
            };
        } else {
            // Fall back to escrow or direct payment
            const executionId = `hire_${request.agentId}_${Date.now()}`;
            paymentResult = await escrowPaymentHelper.payWithEscrowOrDirect(
                metaAgentId,
                agent.owner_address,
                cost.toString(),
                executionId
            );
        }

        // Create task artifact for the delegation
        const { data: task, error: taskError } = await supabase
            .from('task_artifacts')
            .insert({
                agent_id: metaAgentId,
                service_id: request.agentId,
                state: 'pending',
                inputs: {
                    delegatedTo: request.agentId,
                    resource: request.resourceId,
                    task: request.task,
                    budget: request.budget,
                    paymentMethod: paymentResult.method,
                    paymentTxHash: paymentResult.txHash,
                    escrowSessionId: paymentResult.escrowSessionId
                },
                outputs: {},
                retries: 0
            })
            .select()
            .single();

        if (taskError || !task) {
            throw new Error(`Failed to create task: ${taskError?.message}`);
        }

        logger.info('Agent hired', {
            taskId: task.task_id,
            agentId: request.agentId,
            cost: agent.price_per_call,
            paymentMethod: paymentResult.method,
            escrowSessionId: paymentResult.escrowSessionId
        });

        // Record payment in session if using session-based payment
        if (paymentResult.method === 'session' && paymentResult.escrowSessionId) {
            await this.sessionManager.recordPayment(paymentResult.escrowSessionId, {
                agentAddress: agent.owner_address,
                agentName: agent.name,
                amount: cost.toString(),
                txHash: paymentResult.txHash,
                paymentMethod: 'x402',
                metadata: {
                    taskId: task.task_id,
                    agentId: request.agentId,
                    resource: request.resourceId,
                    task: request.task
                }
            });
            logger.info('Session payment recorded', {
                sessionId: paymentResult.escrowSessionId,
                amount: cost
            });
        }

        return {
            success: true,
            taskId: task.task_id,
            agentId: request.agentId,
            cost: agent.price_per_call || '0',
            estimatedCompletion: new Date(Date.now() + 30000).toISOString(), // 30s estimate
            paymentMethod: paymentResult.method,
            paymentTxHash: paymentResult.txHash,
            escrowSessionId: paymentResult.escrowSessionId
        };
    }

    /**
     * Execute delegated task with x402 payment
     */
    async executeDelegation(taskId: string): Promise<DelegationOutcome> {
        const startTime = performance.now();
        logger.info('Executing delegation', { taskId });

        // Get task details
        const { data: task, error: taskError } = await supabase
            .from('task_artifacts')
            .select('*')
            .eq('task_id', taskId)
            .single();

        if (taskError || !task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        // Get agent details
        const { data: agent, error: agentError } = await supabase
            .from('services')
            .select('*')
            .eq('id', task.service_id)
            .single();

        if (agentError || !agent) {
            throw new Error(`Agent not found: ${task.service_id}`);
        }

        try {
            // Use service endpoint directly (no agent card required)
            const resourceUrl = task.inputs.resource || agent.endpoint_url;

            if (!resourceUrl) {
                throw new Error(`No endpoint URL found for agent ${task.service_id}`);
            }

            logger.info('Executing task on agent endpoint', {
                taskId,
                endpoint: resourceUrl
            });

            const paymentStart = performance.now();

            // Make initial request (expect 402)
            const initialResponse = await fetch(resourceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task.inputs.task)
            });

            let paymentId: string | undefined;

            let paymentHeader: string | undefined;
            let txHash: string | undefined;

            if (initialResponse.status === 402) {
                // Parse x402 payment requirements from response
                const paymentData = await initialResponse.json().catch(() => ({}));
                const paymentRequirements = paymentData.paymentRequirements;

                if (!paymentRequirements && !this.relayWallet) {
                    throw new Error('Payment required but no Relay wallet configured');
                }

                logger.info('x402 payment required', { taskId, agentId: task.service_id });

                // Execute REAL x402 payment via Facilitator
                if (this.relayWallet) {
                    try {
                        const cost = agent.price_per_call || '0.01';
                        const amountInBaseUnits = ethers.parseUnits(cost, 6).toString();

                        // Generate EIP-3009 payment header (Relay signs authorization)
                        paymentHeader = await this.facilitator.generatePaymentHeader({
                            to: agent.owner_address,
                            value: amountInBaseUnits,
                            signer: this.relayWallet,
                            validBefore: Math.floor(Date.now() / 1000) + 300
                        });

                        // Build payment requirements if not provided by agent
                        const finalRequirements: PaymentRequirements = paymentRequirements || this.facilitator.generatePaymentRequirements({
                            payTo: agent.owner_address,
                            maxAmountRequired: amountInBaseUnits,
                            resource: resourceUrl,
                            description: `Agent invocation: ${agent.name}`
                        });

                        // Build verify request
                        const verifyRequest = this.facilitator.buildVerifyRequest(paymentHeader, finalRequirements);

                        // Verify EIP-3009 authorization
                        const verifyResult = await this.facilitator.verifyPayment(verifyRequest);
                        if (!verifyResult.isValid) {
                            throw new Error('x402 payment verification failed');
                        }

                        // Settle on-chain via Facilitator (GASLESS!)
                        logger.info('Settling x402 payment via Facilitator', {
                            to: agent.owner_address,
                            amount: cost
                        });
                        const settleResult = await this.facilitator.settlePayment(verifyRequest);
                        txHash = settleResult.txHash;
                        paymentId = `x402_${txHash}`;

                        logger.info('x402 payment settled', { taskId, txHash, paymentId });

                        // Record payment in database
                        await supabase.from('payments').insert({
                            payment_id: paymentId,
                            service_id: task.service_id,
                            from_address: this.relayWallet.address.toLowerCase(),
                            to_address: agent.owner_address.toLowerCase(),
                            amount: cost,
                            token_address: process.env.USDC_TOKEN_ADDRESS || '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
                            tx_hash: txHash,
                            status: 'settled',
                            timestamp: new Date().toISOString()
                        });

                        // Record in on_chain_transactions for explorer
                        await supabase.from('on_chain_transactions').insert({
                            tx_hash: txHash,
                            from_address: this.relayWallet.address.toLowerCase(),
                            to_address: agent.owner_address.toLowerCase(),
                            value: cost,
                            type: 'agent_payment',
                            status: 'success',
                            timestamp: new Date().toISOString()
                        });

                    } catch (paymentError) {
                        logger.error('x402 payment failed', paymentError as Error);
                        throw new Error(`x402 payment failed: ${paymentError instanceof Error ? paymentError.message : 'Unknown'}`);
                    }
                }

                // Update task with payment ID
                await supabase
                    .from('task_artifacts')
                    .update({ payment_id: paymentId, payment_tx_hash: txHash })
                    .eq('task_id', taskId);
            }

            const paymentMs = Math.round(performance.now() - paymentStart);
            const executionStart = performance.now();

            // Execute the actual request with x402 payment proof
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (paymentHeader) {
                headers['X-Payment'] = paymentHeader;
            }
            if (paymentId) {
                headers['X-Payment-Id'] = paymentId;
            }

            const execResponse = await fetch(resourceUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(task.inputs.task)
            });

            if (!execResponse.ok) {
                throw new Error(`Agent execution failed: ${execResponse.statusText}`);
            }

            const result = await execResponse.json();
            const executionMs = Math.round(performance.now() - executionStart);
            const totalMs = Math.round(performance.now() - startTime);

            // Update task as settled
            await supabase
                .from('task_artifacts')
                .update({
                    state: 'settled',
                    outputs: result,
                    completed_at: new Date().toISOString(),
                    metrics: {
                        total_ms: totalMs,
                        payment_ms: paymentMs,
                        execution_ms: executionMs
                    }
                })
                .eq('task_id', taskId);

            // Record outcome with real txHash
            if (paymentId) {
                await supabase
                    .from('outcomes')
                    .insert({
                        payment_id: paymentId,
                        outcome_type: 'delivered',
                        latency_ms: totalMs,
                        evidence: { taskId, result, txHash }
                    });
            }

            logger.info('Delegation completed with x402 payment', {
                taskId,
                totalMs,
                txHash,
                paymentMethod: txHash ? 'x402_eip3009' : 'none'
            });

            return {
                taskId,
                agentId: task.service_id,
                state: 'settled',
                paymentId,
                paymentTxHash: txHash,
                cost: agent.price_per_call || '0',
                outputs: result,
                metrics: {
                    total_ms: totalMs,
                    payment_ms: paymentMs,
                    execution_ms: executionMs
                }
            };
        } catch (error) {
            logger.error('Delegation failed', error as Error, { taskId });

            // Update task as failed
            await supabase
                .from('task_artifacts')
                .update({
                    state: 'failed',
                    error: {
                        code: 'DELEGATION_FAILED',
                        message: error instanceof Error ? error.message : String(error),
                        retryable: true
                    }
                })
                .eq('task_id', taskId);

            return {
                taskId,
                agentId: task.service_id,
                state: 'failed',
                cost: agent.price_per_call || '0',
                error: {
                    code: 'DELEGATION_FAILED',
                    message: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    /**
     * Get delegation status
     */
    async getDelegationStatus(taskId: string): Promise<DelegationOutcome> {
        const { data: task, error } = await supabase
            .from('task_artifacts')
            .select('*')
            .eq('task_id', taskId)
            .single();

        if (error || !task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        const { data: agent } = await supabase
            .from('services')
            .select('price_per_call')
            .eq('id', task.service_id)
            .single();

        return {
            taskId: task.task_id,
            agentId: task.service_id,
            state: task.state,
            paymentId: task.payment_id,
            cost: agent?.price_per_call || '0',
            outputs: task.outputs,
            error: task.error,
            metrics: task.metrics
        };
    }
}

export const metaAgentService = new MetaAgentService();
