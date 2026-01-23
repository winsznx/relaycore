/**
 * RWA State Indexer
 * 
 * Production-grade indexer for RWA state transitions and agent accountability.
 * Integrates with existing indexer suite and reputation system.
 * 
 * Runs as Node.js cron job in backend process.
 */

import { CronJob } from 'cron';
import { supabase } from '../../../lib/supabase.js';
import logger from '../../../lib/logger.js';

export class RWAStateIndexer {
    private job: CronJob | null = null;
    private isRunning = false;

    constructor() { }

    start() {
        this.job = new CronJob(
            '*/2 * * * *',
            async () => {
                if (this.isRunning) {
                    logger.warn('RWA state indexer already running, skipping');
                    return;
                }

                this.isRunning = true;
                try {
                    await this.run();
                } catch (error) {
                    logger.error('RWA state indexer failed', error as Error);
                } finally {
                    this.isRunning = false;
                }
            },
            null,
            true,
            'UTC'
        );

        logger.info('RWA State Indexer started (runs every 2 minutes)');
    }

    stop() {
        if (this.job) {
            this.job.stop();
            logger.info('RWA State Indexer stopped');
        }
    }

    async run() {
        logger.info('Running RWA state indexer');

        await Promise.all([
            this.indexStateTransitions(),
            this.indexAgentPerformance(),
            this.updateAgentReputation(),
            this.detectStaleStates(),
            this.aggregateMetrics()
        ]);

        logger.info('RWA state indexer completed');
    }

    /**
     * Index state transitions for observability
     */
    private async indexStateTransitions() {
        const { data: recentTransitions } = await supabase
            .from('rwa_state_transitions')
            .select('*')
            .gte('transitioned_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .order('transitioned_at', { ascending: false });

        if (!recentTransitions || recentTransitions.length === 0) {
            return;
        }

        logger.info(`Indexing ${recentTransitions.length} RWA state transitions`);

        for (const transition of recentTransitions) {
            const { data: payment } = await supabase
                .from('session_payments')
                .select('*')
                .eq('metadata->>rwaId', transition.rwa_id)
                .eq('metadata->>transition', `${transition.from_state}->${transition.to_state}`)
                .single();

            if (!payment) {
                logger.warn('Payment not found for transition', {
                    rwaId: transition.rwa_id,
                    transition: `${transition.from_state}->${transition.to_state}`
                });
                continue;
            }

            await supabase
                .from('outcomes')
                .upsert({
                    payment_id: transition.payment_hash,
                    outcome_type: 'success',
                    latency_ms: 0,
                    evidence: {
                        rwaId: transition.rwa_id,
                        fromState: transition.from_state,
                        toState: transition.to_state,
                        agentAddress: transition.agent_address,
                        agentRole: transition.agent_role,
                        proof: transition.proof
                    },
                    created_at: transition.transitioned_at
                }, {
                    onConflict: 'payment_id'
                });
        }
    }

    /**
     * Track agent performance in RWA workflows
     */
    private async indexAgentPerformance() {
        const { data: assignments } = await supabase
            .from('rwa_agent_assignments')
            .select('*')
            .eq('status', 'completed')
            .gte('completed_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

        if (!assignments || assignments.length === 0) {
            return;
        }

        logger.info(`Indexing ${assignments.length} completed RWA agent assignments`);

        for (const assignment of assignments) {
            const completionTime = new Date(assignment.completed_at).getTime() -
                new Date(assignment.assigned_at).getTime();

            await supabase
                .from('agent_performance_metrics')
                .upsert({
                    agent_address: assignment.agent_address,
                    metric_type: 'rwa_execution',
                    value: completionTime,
                    metadata: {
                        rwaId: assignment.rwa_id,
                        role: assignment.agent_role,
                        completedAt: assignment.completed_at
                    },
                    recorded_at: assignment.completed_at
                }, {
                    onConflict: 'agent_address,metric_type,recorded_at'
                });
        }
    }

    /**
     * Update agent reputation based on RWA performance
     */
    private async updateAgentReputation() {
        const { data: agents } = await supabase
            .from('rwa_agent_assignments')
            .select('agent_address')
            .eq('status', 'completed')
            .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (!agents || agents.length === 0) {
            return;
        }

        const uniqueAgents = [...new Set(agents.map(a => a.agent_address))];

        logger.info(`Updating reputation for ${uniqueAgents.length} RWA agents`);

        for (const agentAddress of uniqueAgents) {
            const { data: stats } = await supabase
                .from('rwa_agent_assignments')
                .select('status')
                .eq('agent_address', agentAddress);

            if (!stats) continue;

            const completed = stats.filter(s => s.status === 'completed').length;
            const failed = stats.filter(s => s.status === 'failed').length;
            const total = completed + failed;

            if (total === 0) continue;

            const successRate = completed / total;

            const { data: currentRep } = await supabase
                .from('reputations')
                .select('score, feedback_count')
                .eq('agent_address', agentAddress)
                .single();

            const baseScore = currentRep?.score || 50;
            const rwaBonus = successRate * 10;
            const newScore = Math.min(100, Math.max(0, baseScore + rwaBonus));

            await supabase
                .from('reputations')
                .upsert({
                    agent_address: agentAddress,
                    score: newScore,
                    feedback_count: (currentRep?.feedback_count || 0) + total,
                    successful_transactions: completed,
                    failed_transactions: failed,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'agent_address'
                });

            logger.info('Updated RWA agent reputation', {
                agentAddress,
                successRate,
                newScore
            });
        }
    }

    /**
     * Detect RWAs stuck in states
     */
    private async detectStaleStates() {
        const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: staleRWAs } = await supabase
            .from('rwa_state_machines')
            .select('*')
            .lt('updated_at', staleThreshold)
            .neq('current_state', 'settled')
            .neq('current_state', 'disputed');

        if (!staleRWAs || staleRWAs.length === 0) {
            return;
        }

        logger.warn(`Detected ${staleRWAs.length} stale RWA state machines`, {
            rwaIds: staleRWAs.map(r => r.rwa_id)
        });

        for (const rwa of staleRWAs) {
            await supabase
                .from('rwa_alerts')
                .insert({
                    rwa_id: rwa.rwa_id,
                    alert_type: 'stale_state',
                    severity: 'warning',
                    message: `RWA stuck in ${rwa.current_state} for >24h`,
                    metadata: {
                        currentState: rwa.current_state,
                        lastUpdated: rwa.updated_at
                    },
                    created_at: new Date().toISOString()
                });
        }
    }

    /**
     * Aggregate RWA metrics for analytics
     */
    private async aggregateMetrics() {
        const { data: transitions } = await supabase
            .from('rwa_state_transitions')
            .select('to_state, agent_role')
            .gte('transitioned_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (!transitions || transitions.length === 0) {
            return;
        }

        const stateCount: Record<string, number> = {};
        const roleCount: Record<string, number> = {};

        for (const t of transitions) {
            stateCount[t.to_state] = (stateCount[t.to_state] || 0) + 1;
            roleCount[t.agent_role] = (roleCount[t.agent_role] || 0) + 1;
        }

        await supabase
            .from('rwa_metrics')
            .insert({
                metric_date: new Date().toISOString().split('T')[0],
                total_transitions: transitions.length,
                state_distribution: stateCount,
                role_distribution: roleCount,
                created_at: new Date().toISOString()
            });

        logger.info('Aggregated RWA metrics', {
            totalTransitions: transitions.length,
            states: Object.keys(stateCount).length,
            roles: Object.keys(roleCount).length
        });
    }
}

export const rwaStateIndexer = new RWAStateIndexer();
