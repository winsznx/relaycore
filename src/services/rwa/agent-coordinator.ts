/**
 * RWA Agent Coordinator
 * 
 * Production-grade multi-agent orchestration for RWA settlement.
 * Enables composable agent workflows with x402 payment coordination.
 * 
 * Philosophy: Multiple specialized agents coordinate to settle a single RWA,
 * each paid via x402, each accountable, each indexed.
 */

import { supabase } from '../../lib/supabase.js';
import logger from '../../lib/logger.js';
import { rwaStateMachineService, RWAState, AgentRole } from './state-machine.js';

export interface AgentCapability {
    role: AgentRole;
    canHandle: (state: RWAState) => boolean;
    estimatedCost: string;
    estimatedDuration: number;
}

export interface AgentAssignment {
    id: string;
    rwaId: string;
    agentAddress: string;
    agentRole: AgentRole;
    status: 'assigned' | 'active' | 'completed' | 'failed';
    assignedAt: Date;
    completedAt?: Date;
    metadata: Record<string, unknown>;
}

export interface CoordinationPlan {
    rwaId: string;
    agents: Array<{
        role: AgentRole;
        agentAddress: string;
        state: RWAState;
        cost: string;
        order: number;
    }>;
    totalCost: string;
    estimatedDuration: number;
}

export interface AgentDiscoveryQuery {
    role: AgentRole;
    minReputation?: number;
    maxCost?: string;
    capabilities?: string[];
}

export interface AgentScore {
    agentAddress: string;
    role: AgentRole;
    reputation: number;
    cost: string;
    latency: number;
    compositeScore: number;
}

export class RWAAgentCoordinator {
    private static instance: RWAAgentCoordinator;

    private constructor() { }

    static getInstance(): RWAAgentCoordinator {
        if (!RWAAgentCoordinator.instance) {
            RWAAgentCoordinator.instance = new RWAAgentCoordinator();
        }
        return RWAAgentCoordinator.instance;
    }

    /**
     * Discover agents capable of handling specific role
     */
    async discoverAgents(query: AgentDiscoveryQuery): Promise<AgentScore[]> {
        logger.info('Discovering agents for RWA coordination', { role: query.role });

        let dbQuery = supabase
            .from('services')
            .select(`
                id,
                name,
                endpoint_url,
                owner_address,
                price_per_call,
                metadata
            `)
            .eq('category', 'rwa')
            .eq('status', 'active');

        if (query.maxCost) {
            dbQuery = dbQuery.lte('price_per_call', query.maxCost);
        }

        const { data: services, error } = await dbQuery;

        if (error || !services) {
            logger.error('Agent discovery failed', error);
            return [];
        }

        const agentsWithReputation = await Promise.all(
            services.map(async (service) => {
                const { data: reputation } = await supabase
                    .from('reputations')
                    .select('score, feedback_count')
                    .eq('agent_address', service.owner_address)
                    .single();

                const reputationScore = reputation?.score || 50;
                const feedbackCount = reputation?.feedback_count || 0;

                if (query.minReputation && reputationScore < query.minReputation) {
                    return null;
                }

                const { data: outcomes } = await supabase
                    .from('outcomes')
                    .select('latency_ms')
                    .eq('payment_id', service.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                const avgLatency = outcomes && outcomes.length > 0
                    ? outcomes.reduce((sum, o) => sum + (o.latency_ms || 0), 0) / outcomes.length
                    : 5000;

                const priceNum = parseFloat(service.price_per_call || '0');
                const normalizedReputation = reputationScore / 100;
                const normalizedPrice = Math.max(0, 1 - (priceNum / 10));
                const normalizedLatency = Math.max(0, 1 - (avgLatency / 10000));

                const compositeScore =
                    (normalizedReputation * 0.4) +
                    (normalizedPrice * 0.3) +
                    (normalizedLatency * 0.2) +
                    (Math.min(feedbackCount / 100, 1) * 0.1);

                return {
                    agentAddress: service.owner_address,
                    role: query.role,
                    reputation: reputationScore,
                    cost: service.price_per_call,
                    latency: avgLatency,
                    compositeScore
                };
            })
        );

        const validAgents = agentsWithReputation
            .filter((a): a is AgentScore => a !== null)
            .sort((a, b) => b.compositeScore - a.compositeScore);

        logger.info('Agent discovery complete', {
            role: query.role,
            found: validAgents.length
        });

        return validAgents;
    }

    /**
     * Assign agent to RWA role
     */
    async assignAgent(
        rwaId: string,
        agentAddress: string,
        role: AgentRole,
        metadata: Record<string, unknown> = {}
    ): Promise<AgentAssignment> {
        const { data, error } = await supabase
            .from('rwa_agent_assignments')
            .insert({
                rwa_id: rwaId,
                agent_address: agentAddress,
                agent_role: role,
                status: 'assigned',
                metadata,
                assigned_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            logger.error('Agent assignment failed', error);
            throw new Error(`Failed to assign agent: ${error.message}`);
        }

        logger.info('Agent assigned to RWA', {
            rwaId,
            agentAddress,
            role
        });

        return {
            id: data.id,
            rwaId: data.rwa_id,
            agentAddress: data.agent_address,
            agentRole: data.agent_role,
            status: data.status,
            assignedAt: new Date(data.assigned_at),
            metadata: data.metadata
        };
    }

    /**
     * Create coordination plan for RWA lifecycle
     */
    async createCoordinationPlan(
        rwaId: string,
        sessionId: number
    ): Promise<CoordinationPlan> {
        logger.info('Creating coordination plan', { rwaId });

        const stateMachine = await rwaStateMachineService.getStateMachine(rwaId);
        if (!stateMachine) {
            throw new Error('State machine not found');
        }

        const roleSequence: Array<{ role: AgentRole; state: RWAState }> = [
            { role: AgentRole.VERIFIER, state: RWAState.VERIFIED },
            { role: AgentRole.ESCROW_MANAGER, state: RWAState.ESCROWED },
            { role: AgentRole.EXECUTOR, state: RWAState.IN_PROCESS },
            { role: AgentRole.DELIVERY_CONFIRMER, state: RWAState.FULFILLED },
            { role: AgentRole.SETTLER, state: RWAState.SETTLED }
        ];

        const agents: CoordinationPlan['agents'] = [];
        let totalCost = 0;
        let estimatedDuration = 0;

        for (let i = 0; i < roleSequence.length; i++) {
            const { role, state } = roleSequence[i];

            const discovered = await this.discoverAgents({
                role,
                minReputation: 70
            });

            if (discovered.length === 0) {
                throw new Error(`No agents found for role: ${role}`);
            }

            const bestAgent = discovered[0];

            const cost = rwaStateMachineService.getTransitionCost(
                i === 0 ? RWAState.CREATED : roleSequence[i - 1].state,
                state
            );

            agents.push({
                role,
                agentAddress: bestAgent.agentAddress,
                state,
                cost,
                order: i + 1
            });

            totalCost += parseFloat(cost);
            estimatedDuration += bestAgent.latency;

            await this.assignAgent(rwaId, bestAgent.agentAddress, role, {
                order: i + 1,
                targetState: state,
                estimatedCost: cost
            });
        }

        const plan: CoordinationPlan = {
            rwaId,
            agents,
            totalCost: totalCost.toFixed(4),
            estimatedDuration
        };

        logger.info('Coordination plan created', {
            rwaId,
            agentCount: agents.length,
            totalCost: plan.totalCost,
            estimatedDuration
        });

        return plan;
    }

    /**
     * Execute coordination plan (orchestrate all agents)
     */
    async executeCoordinationPlan(
        rwaId: string,
        sessionId: number
    ): Promise<{
        success: boolean;
        completedTransitions: number;
        failedAt?: RWAState;
        error?: string;
    }> {
        logger.info('Executing coordination plan', { rwaId });

        const { data: assignments } = await supabase
            .from('rwa_agent_assignments')
            .select('*')
            .eq('rwa_id', rwaId)
            .eq('status', 'assigned')
            .order('metadata->order', { ascending: true });

        if (!assignments || assignments.length === 0) {
            return {
                success: false,
                completedTransitions: 0,
                error: 'No agent assignments found'
            };
        }

        let completedTransitions = 0;

        for (const assignment of assignments) {
            try {
                await supabase
                    .from('rwa_agent_assignments')
                    .update({ status: 'active' })
                    .eq('id', assignment.id);

                const targetState = assignment.metadata.targetState as RWAState;

                const result = await rwaStateMachineService.transition({
                    rwaId,
                    toState: targetState,
                    agentAddress: assignment.agent_address,
                    agentRole: assignment.agent_role,
                    sessionId,
                    proof: {
                        automated: true,
                        coordinationPlan: true,
                        timestamp: Date.now()
                    }
                });

                if (!result.success) {
                    await supabase
                        .from('rwa_agent_assignments')
                        .update({ status: 'failed' })
                        .eq('id', assignment.id);

                    return {
                        success: false,
                        completedTransitions,
                        failedAt: targetState,
                        error: result.error
                    };
                }

                await supabase
                    .from('rwa_agent_assignments')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', assignment.id);

                completedTransitions++;

                logger.info('Agent transition completed', {
                    rwaId,
                    agent: assignment.agent_address,
                    role: assignment.agent_role,
                    state: targetState
                });

            } catch (error) {
                logger.error('Agent execution failed', error as Error, {
                    rwaId,
                    agent: assignment.agent_address
                });

                await supabase
                    .from('rwa_agent_assignments')
                    .update({ status: 'failed' })
                    .eq('id', assignment.id);

                return {
                    success: false,
                    completedTransitions,
                    error: (error as Error).message
                };
            }
        }

        logger.info('Coordination plan executed successfully', {
            rwaId,
            completedTransitions
        });

        return {
            success: true,
            completedTransitions
        };
    }

    /**
     * Get agent assignments for RWA
     */
    async getAssignments(rwaId: string): Promise<AgentAssignment[]> {
        const { data, error } = await supabase
            .from('rwa_agent_assignments')
            .select('*')
            .eq('rwa_id', rwaId)
            .order('assigned_at', { ascending: true });

        if (error || !data) {
            return [];
        }

        return data.map(a => ({
            id: a.id,
            rwaId: a.rwa_id,
            agentAddress: a.agent_address,
            agentRole: a.agent_role,
            status: a.status,
            assignedAt: new Date(a.assigned_at),
            completedAt: a.completed_at ? new Date(a.completed_at) : undefined,
            metadata: a.metadata
        }));
    }
}

export const rwaAgentCoordinator = RWAAgentCoordinator.getInstance();
