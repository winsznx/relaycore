/**
 * Chat Orchestrator Service
 * 
 * Implements the In-App Chat Architecture:
 * - Control plane + explainer + orchestrator
 * - NOT an executor - never sends transactions directly
 * 
 * Responsibilities:
 * 1. Intent Translation - Parse human intent into structured plans
 * 2. Explainability - Explain why agents made decisions
 * 3. Simulation - Dry-run before money moves
 * 4. Onboarding - Guide users through configuration
 * 5. Observability - Summarize trends and anomalies
 */

import { supabase, isSupabaseAvailable } from '../../lib/supabase';
import { taskStore } from '../tasks';
import logger from '../../lib/logger';
import type {
    ChatRequest,
    ChatResponse,
    ChatMode,
    ChatAction,
    SimulationResult,
} from '../../types/chat.types';

export class ChatOrchestrator {
    /**
     * Process a chat request in the specified mode
     */
    async process(request: ChatRequest): Promise<ChatResponse> {
        const startTime = performance.now();

        try {
            switch (request.mode) {
                case 'explain':
                    return await this.handleExplain(request, startTime);
                case 'simulate':
                    return await this.handleSimulate(request, startTime);
                case 'plan':
                    return await this.handlePlan(request, startTime);
                case 'observe':
                    return await this.handleObserve(request, startTime);
                default:
                    return this.errorResponse('Unknown mode', startTime, request.mode);
            }
        } catch (error) {
            logger.error('Chat orchestrator error', error as Error);
            return this.errorResponse(
                'Failed to process request',
                startTime,
                request.mode
            );
        }
    }

    /**
     * EXPLAIN mode - Explain agent decisions and system state
     */
    private async handleExplain(request: ChatRequest, startTime: number): Promise<ChatResponse> {
        const { query, context } = request;
        const sources: ChatResponse['sources'] = [];

        let content = '';
        const data: Record<string, unknown> = {};

        // Explain a specific task
        if (context?.taskId) {
            const task = await taskStore.get(context.taskId);
            if (task) {
                sources.push({ name: 'task_artifacts', type: 'database' });
                content = this.explainTask(task);
                data.task = task;
            } else {
                content = `Task ${context.taskId} not found.`;
            }
        }

        // Explain a session
        else if (context?.sessionId && isSupabaseAvailable()) {
            const { data: session } = await supabase
                .from('escrow_sessions')
                .select('*')
                .eq('session_id', context.sessionId)
                .single();

            if (session) {
                sources.push({ name: 'escrow_sessions', type: 'database' });
                content = this.explainSession(session);
                data.session = session;
            } else {
                content = `Session ${context.sessionId} not found.`;
            }
        }

        // General explanation based on query
        else {
            content = await this.generateExplanation(query, context);
            sources.push({ name: 'llm', type: 'api' });
        }

        return {
            type: 'explanation',
            content,
            data,
            sources,
            meta: {
                processingTimeMs: Math.round(performance.now() - startTime),
                mode: 'explain',
            },
        };
    }

    /**
     * SIMULATE mode - Dry-run operations before executing
     */
    private async handleSimulate(request: ChatRequest, startTime: number): Promise<ChatResponse> {
        const { query, context } = request;

        // Parse intent to determine what to simulate
        const simulation = await this.runSimulation(query, context);

        return {
            type: 'simulation',
            content: simulation.description,
            simulation,
            actions: simulation.expectedOutcome.success ? [{
                label: 'Proceed with operation',
                endpoint: '/api/execute',
                method: 'POST',
                body: { query, context },
                requiresApproval: true,
                riskLevel: simulation.risks && simulation.risks.length > 0 ? 'medium' : 'low',
            }] : undefined,
            meta: {
                processingTimeMs: Math.round(performance.now() - startTime),
                mode: 'simulate',
            },
        };
    }

    /**
     * PLAN mode - Create execution plans for user approval
     */
    private async handlePlan(request: ChatRequest, startTime: number): Promise<ChatResponse> {
        const { query, context } = request;

        const actions = await this.generatePlan(query, context);

        return {
            type: 'plan',
            content: `I've created a plan with ${actions.length} step(s). Review each action below and approve to proceed.`,
            actions,
            meta: {
                processingTimeMs: Math.round(performance.now() - startTime),
                mode: 'plan',
            },
        };
    }

    /**
     * OBSERVE mode - Summarize trends and system state
     */
    private async handleObserve(request: ChatRequest, startTime: number): Promise<ChatResponse> {
        const { context } = request;
        const sources: ChatResponse['sources'] = [];
        const data: Record<string, unknown> = {};

        // Get task stats
        const taskStats = await taskStore.getStats(context?.agentId);
        sources.push({ name: 'task_artifacts', type: 'database' });
        data.taskStats = taskStats;

        // Get session stats if available
        if (isSupabaseAvailable()) {
            const { data: sessions } = await supabase
                .from('escrow_sessions')
                .select('is_active')
                .eq('owner_address', context?.walletAddress || '');

            if (sessions) {
                const sessionStats = {
                    total: sessions.length,
                    active: sessions.filter(s => s.is_active).length,
                    closed: sessions.filter(s => !s.is_active).length,
                };
                data.sessionStats = sessionStats;
                sources.push({ name: 'escrow_sessions', type: 'database' });
            }
        }

        const content = this.formatObservation(data);

        return {
            type: 'observation',
            content,
            data,
            sources,
            meta: {
                processingTimeMs: Math.round(performance.now() - startTime),
                mode: 'observe',
            },
        };
    }

    // Helper methods

    private explainTask(task: Record<string, unknown>): string {
        return `Task ${task.task_id}:
- State: ${task.state}
- Agent: ${task.agent_id}
- Created: ${task.timestamps && typeof task.timestamps === 'object' ? (task.timestamps as Record<string, string>).created : 'unknown'}
- Retries: ${task.retries || 0}
${task.error ? `- Error: ${JSON.stringify(task.error)}` : ''}`;
    }

    private explainSession(session: Record<string, unknown>): string {
        const remaining = parseFloat(String(session.deposited || 0)) - parseFloat(String(session.released || 0));
        return `Session ${session.session_id}:
- Owner: ${session.owner_address}
- Active: ${session.is_active ? 'Yes' : 'No'}
- Deposited: ${session.deposited} USDC
- Released: ${session.released} USDC
- Remaining: ${remaining.toFixed(2)} USDC
- Expires: ${session.expiry}`;
    }

    private async generateExplanation(query: string, context?: ChatRequest['context']): Promise<string> {
        // In production, this would call an LLM
        return `Based on your query "${query}", here's what I found:

The system is operating normally. ${context?.walletAddress ? `Your wallet ${context.walletAddress.slice(0, 8)}...${context.walletAddress.slice(-6)} is connected.` : 'No wallet connected.'}

For detailed explanations, please specify:
- A task ID (taskId) to explain a specific operation
- A session ID (sessionId) to explain an escrow session`;
    }

    private async runSimulation(query: string, context?: ChatRequest['context']): Promise<SimulationResult> {
        // Parse intent and simulate
        // In production, this would simulate the actual operation

        return {
            description: `Simulation for: "${query}"

This would execute the following:
1. Parse your intent
2. Select appropriate service
3. Execute with payment (if required)

No actual transactions will be made during simulation.`,
            expectedOutcome: {
                success: true,
                estimatedResult: {
                    status: 'simulated',
                    walletConnected: !!context?.walletAddress,
                },
            },
            risks: [],
            confirmations: [
                'This operation may require USDC payment',
                'Ensure your wallet has sufficient balance',
            ],
            estimatedFees: {
                gas: '~0.001 CRO',
                payment: 'Varies by service',
            },
        };
    }

    private async generatePlan(query: string, context?: ChatRequest['context']): Promise<ChatAction[]> {
        // In production, this would use intent classification
        // to determine what actions to propose

        return [{
            label: 'Get price quote',
            endpoint: '/api/prices',
            method: 'GET',
            body: { query },
            requiresApproval: false,
            riskLevel: 'low',
        }];
    }

    private formatObservation(data: Record<string, unknown>): string {
        const taskStats = data.taskStats as { total: number; pending: number; settled: number; failed: number; success_rate: number } | undefined;
        const sessionStats = data.sessionStats as { total: number; active: number; closed: number } | undefined;

        let content = 'System Observation:\n\n';

        if (taskStats) {
            content += `Tasks:
- Total: ${taskStats.total}
- Pending: ${taskStats.pending}
- Settled: ${taskStats.settled}
- Failed: ${taskStats.failed}
- Success Rate: ${(taskStats.success_rate * 100).toFixed(1)}%\n\n`;
        }

        if (sessionStats) {
            content += `Sessions:
- Total: ${sessionStats.total}
- Active: ${sessionStats.active}
- Closed: ${sessionStats.closed}\n`;
        }

        return content;
    }

    private errorResponse(message: string, startTime: number, mode: ChatMode): ChatResponse {
        return {
            type: 'error',
            content: message,
            meta: {
                processingTimeMs: Math.round(performance.now() - startTime),
                mode,
            },
        };
    }
}

export const chatOrchestrator = new ChatOrchestrator();
