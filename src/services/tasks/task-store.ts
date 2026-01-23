/**
 * Task Store Service
 * 
 * Manages TaskArtifact persistence and querying.
 * Every MCP tool call, API request, and agent action creates a task.
 */

import { supabase } from '../../lib/supabase';
import logger from '../../lib/logger';
import type {
    TaskArtifact,
    TaskState,
    CreateTaskInput,
    UpdateTaskInput,
    TaskQuery,
    TaskStats
} from '../../types/task-artifact';

function generateTaskId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `task_${timestamp}_${random}`;
}

export class TaskStore {
    async create(input: CreateTaskInput): Promise<TaskArtifact> {
        const now = new Date().toISOString();
        const task: TaskArtifact = {
            task_id: generateTaskId(),
            agent_id: input.agent_id,
            service_id: input.service_id,
            session_id: input.session_id,
            state: 'pending',
            retries: 0,
            timestamps: {
                created: now,
                updated: now,
            },
            inputs: input.inputs,
            outputs: {},
        };

        const { error } = await supabase
            .from('task_artifacts')
            .insert({
                task_id: task.task_id,
                agent_id: task.agent_id,
                service_id: task.service_id,
                session_id: task.session_id,
                state: task.state,
                retries: task.retries,
                inputs: task.inputs,
                outputs: task.outputs,
                created_at: now,
                updated_at: now,
            });

        if (error) {
            logger.error('Failed to create task artifact', error);
            throw new Error(`Failed to create task: ${error.message}`);
        }

        logger.info('Task artifact created', { task_id: task.task_id, agent_id: task.agent_id });
        return task;
    }

    async update(taskId: string, updates: UpdateTaskInput): Promise<TaskArtifact> {
        const now = new Date().toISOString();

        const updateData: Record<string, unknown> = {
            updated_at: now,
        };

        if (updates.state) {
            updateData.state = updates.state;
            if (updates.state === 'settled' || updates.state === 'failed') {
                updateData.completed_at = now;
            }
        }
        if (updates.payment_id) updateData.payment_id = updates.payment_id;
        if (updates.facilitator_tx) updateData.facilitator_tx = updates.facilitator_tx;
        if (updates.outputs) updateData.outputs = updates.outputs;
        if (updates.error) updateData.error = updates.error;
        if (updates.metrics) updateData.metrics = updates.metrics;

        const { data, error } = await supabase
            .from('task_artifacts')
            .update(updateData)
            .eq('task_id', taskId)
            .select()
            .single();

        if (error) {
            logger.error('Failed to update task artifact', error, { task_id: taskId });
            throw new Error(`Failed to update task: ${error.message}`);
        }

        logger.info('Task artifact updated', { task_id: taskId, state: updates.state });
        return this.mapRow(data);
    }

    async get(taskId: string): Promise<TaskArtifact | null> {
        const { data, error } = await supabase
            .from('task_artifacts')
            .select('*')
            .eq('task_id', taskId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            logger.error('Failed to get task artifact', error, { task_id: taskId });
            throw new Error(`Failed to get task: ${error.message}`);
        }

        return this.mapRow(data);
    }

    async query(query: TaskQuery): Promise<TaskArtifact[]> {
        let builder = supabase
            .from('task_artifacts')
            .select('*')
            .order('created_at', { ascending: false });

        if (query.agent_id) builder = builder.eq('agent_id', query.agent_id);
        if (query.service_id) builder = builder.eq('service_id', query.service_id);
        if (query.session_id) builder = builder.eq('session_id', query.session_id);
        if (query.state) builder = builder.eq('state', query.state);
        if (query.from) builder = builder.gte('created_at', query.from.toISOString());
        if (query.to) builder = builder.lte('created_at', query.to.toISOString());

        builder = builder.limit(query.limit || 100);
        if (query.offset) builder = builder.range(query.offset, query.offset + (query.limit || 100) - 1);

        const { data, error } = await builder;

        if (error) {
            logger.error('Failed to query task artifacts', error);
            throw new Error(`Failed to query tasks: ${error.message}`);
        }

        return (data || []).map(row => this.mapRow(row));
    }

    async getStats(agentId?: string): Promise<TaskStats> {
        let builder = supabase
            .from('task_artifacts')
            .select('state, metrics');

        if (agentId) builder = builder.eq('agent_id', agentId);

        const { data, error } = await builder;

        if (error) {
            logger.error('Failed to get task stats', error);
            throw new Error(`Failed to get stats: ${error.message}`);
        }

        const rows = data || [];
        const total = rows.length;
        const pending = rows.filter(r => r.state === 'pending').length;
        const settled = rows.filter(r => r.state === 'settled').length;
        const failed = rows.filter(r => r.state === 'failed').length;

        const durations = rows
            .filter(r => r.metrics?.total_ms)
            .map(r => (r.metrics as TaskArtifact['metrics'])?.total_ms || 0);

        const avgDuration = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;

        return {
            total,
            pending,
            settled,
            failed,
            success_rate: total > 0 ? settled / total : 0,
            avg_duration_ms: Math.round(avgDuration),
        };
    }

    async incrementRetries(taskId: string): Promise<void> {
        const { error } = await supabase
            .rpc('increment_task_retries', { p_task_id: taskId });

        if (error) {
            logger.warn('Failed to increment retries', { task_id: taskId, error: error.message });
        }
    }

    async markSettled(taskId: string, outputs: Record<string, unknown>, metrics?: TaskArtifact['metrics']): Promise<TaskArtifact> {
        return this.update(taskId, {
            state: 'settled',
            outputs,
            metrics,
        });
    }

    async markFailed(taskId: string, error: TaskArtifact['error'], metrics?: TaskArtifact['metrics']): Promise<TaskArtifact> {
        return this.update(taskId, {
            state: 'failed',
            error,
            metrics,
        });
    }

    private mapRow(row: Record<string, unknown>): TaskArtifact {
        return {
            task_id: row.task_id as string,
            agent_id: row.agent_id as string,
            service_id: row.service_id as string | undefined,
            session_id: row.session_id as string | undefined,
            state: row.state as TaskState,
            payment_id: row.payment_id as string | undefined,
            facilitator_tx: row.facilitator_tx as string | undefined,
            retries: (row.retries as number) || 0,
            timestamps: {
                created: row.created_at as string,
                updated: row.updated_at as string,
                completed: row.completed_at as string | undefined,
            },
            inputs: (row.inputs as Record<string, unknown>) || {},
            outputs: (row.outputs as Record<string, unknown>) || {},
            error: row.error as TaskArtifact['error'],
            metrics: row.metrics as TaskArtifact['metrics'],
        };
    }
}

export const taskStore = new TaskStore();
