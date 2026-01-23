/**
 * RWA State Machine - Core Logic
 * 
 * Production-grade state machine for agent-mediated RWA settlement.
 * Every state transition requires x402 payment and agent authorization.
 * 
 * Philosophy: RWAs are not assets you trade — they are processes agents settle.
 */

import { supabase } from '../../lib/supabase.js';
import logger, { PerformanceTracker } from '../../lib/logger.js';

export enum RWAState {
    CREATED = 'created',
    VERIFIED = 'verified',
    ESCROWED = 'escrowed',
    IN_PROCESS = 'in_process',
    FULFILLED = 'fulfilled',
    SETTLED = 'settled',
    DISPUTED = 'disputed'
}

export enum AgentRole {
    VERIFIER = 'verifier',
    ESCROW_MANAGER = 'escrow_manager',
    EXECUTOR = 'executor',
    DELIVERY_CONFIRMER = 'delivery_confirmer',
    SETTLER = 'settler',
    AUDITOR = 'auditor'
}

export interface RWAStateMachine {
    id: string;
    rwaId: string;
    currentState: RWAState;
    previousState: RWAState | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface StateTransition {
    id: string;
    rwaId: string;
    fromState: RWAState;
    toState: RWAState;
    agentAddress: string;
    agentRole: AgentRole;
    paymentHash: string;
    proof: Record<string, unknown>;
    transitionedAt: Date;
}

export interface TransitionRequest {
    rwaId: string;
    toState: RWAState;
    agentAddress: string;
    agentRole: AgentRole;
    sessionId: number;
    proof?: Record<string, unknown>;
}

export interface TransitionResult {
    success: boolean;
    rwaId: string;
    fromState: RWAState;
    toState: RWAState;
    paymentHash: string;
    transitionId: string;
    error?: string;
}

const VALID_TRANSITIONS: Record<RWAState, RWAState[]> = {
    [RWAState.CREATED]: [RWAState.VERIFIED, RWAState.DISPUTED],
    [RWAState.VERIFIED]: [RWAState.ESCROWED, RWAState.DISPUTED],
    [RWAState.ESCROWED]: [RWAState.IN_PROCESS, RWAState.DISPUTED],
    [RWAState.IN_PROCESS]: [RWAState.FULFILLED, RWAState.DISPUTED],
    [RWAState.FULFILLED]: [RWAState.SETTLED, RWAState.DISPUTED],
    [RWAState.SETTLED]: [],
    [RWAState.DISPUTED]: [RWAState.CREATED]
};

const TRANSITION_COSTS: Record<string, string> = {
    'created->verified': '0.10',
    'verified->escrowed': '0.50',
    'escrowed->in_process': '0.20',
    'in_process->fulfilled': '0.30',
    'fulfilled->settled': '1.00',
    'settled->audit': '0.15'
};

const REQUIRED_ROLES: Record<string, AgentRole> = {
    'created->verified': AgentRole.VERIFIER,
    'verified->escrowed': AgentRole.ESCROW_MANAGER,
    'escrowed->in_process': AgentRole.EXECUTOR,
    'in_process->fulfilled': AgentRole.DELIVERY_CONFIRMER,
    'fulfilled->settled': AgentRole.SETTLER,
    'settled->audit': AgentRole.AUDITOR
};

export class RWAStateMachineService {
    private static instance: RWAStateMachineService;

    private constructor() { }

    static getInstance(): RWAStateMachineService {
        if (!RWAStateMachineService.instance) {
            RWAStateMachineService.instance = new RWAStateMachineService();
        }
        return RWAStateMachineService.instance;
    }

    async createStateMachine(
        rwaId: string,
        metadata: Record<string, unknown>
    ): Promise<RWAStateMachine> {
        const { data, error } = await supabase
            .from('rwa_state_machines')
            .insert({
                rwa_id: rwaId,
                current_state: RWAState.CREATED,
                previous_state: null,
                metadata,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            logger.error('Failed to create state machine', error);
            throw new Error(`State machine creation failed: ${error.message}`);
        }

        logger.info('RWA state machine created', { rwaId, state: RWAState.CREATED });

        return {
            id: data.id,
            rwaId: data.rwa_id,
            currentState: data.current_state,
            previousState: data.previous_state,
            metadata: data.metadata,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at)
        };
    }

    async getStateMachine(rwaId: string): Promise<RWAStateMachine | null> {
        const { data, error } = await supabase
            .from('rwa_state_machines')
            .select('*')
            .eq('rwa_id', rwaId)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            id: data.id,
            rwaId: data.rwa_id,
            currentState: data.current_state,
            previousState: data.previous_state,
            metadata: data.metadata,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at)
        };
    }

    isValidTransition(fromState: RWAState, toState: RWAState): boolean {
        const validNextStates = VALID_TRANSITIONS[fromState];
        return validNextStates.includes(toState);
    }

    getTransitionCost(fromState: RWAState, toState: RWAState): string {
        const key = `${fromState}->${toState}`;
        return TRANSITION_COSTS[key] || '0.00';
    }

    getRequiredRole(fromState: RWAState, toState: RWAState): AgentRole | null {
        const key = `${fromState}->${toState}`;
        return REQUIRED_ROLES[key] || null;
    }

    async transition(request: TransitionRequest): Promise<TransitionResult> {
        const perf = new PerformanceTracker();
        perf.start('rwa_transition');

        const contextLogger = logger.withContext({
            rwaId: request.rwaId,
            toState: request.toState,
            agentAddress: request.agentAddress,
            agentRole: request.agentRole
        });

        contextLogger.info('RWA transition requested');

        const stateMachine = await this.getStateMachine(request.rwaId);

        if (!stateMachine) {
            contextLogger.error('State machine not found');
            return {
                success: false,
                rwaId: request.rwaId,
                fromState: RWAState.CREATED,
                toState: request.toState,
                paymentHash: '',
                transitionId: '',
                error: 'State machine not found'
            };
        }

        if (!this.isValidTransition(stateMachine.currentState, request.toState)) {
            contextLogger.warn('Invalid transition attempted', {
                fromState: stateMachine.currentState,
                toState: request.toState
            });
            return {
                success: false,
                rwaId: request.rwaId,
                fromState: stateMachine.currentState,
                toState: request.toState,
                paymentHash: '',
                transitionId: '',
                error: `Invalid transition: ${stateMachine.currentState} -> ${request.toState}`
            };
        }

        const requiredRole = this.getRequiredRole(stateMachine.currentState, request.toState);
        if (requiredRole && request.agentRole !== requiredRole) {
            contextLogger.warn('Invalid agent role', {
                required: requiredRole,
                provided: request.agentRole
            });
            return {
                success: false,
                rwaId: request.rwaId,
                fromState: stateMachine.currentState,
                toState: request.toState,
                paymentHash: '',
                transitionId: '',
                error: `Invalid agent role: expected ${requiredRole}, got ${request.agentRole}`
            };
        }

        const cost = this.getTransitionCost(stateMachine.currentState, request.toState);
        const costNum = parseFloat(cost);

        perf.start('session_budget_check');
        const { data: session } = await supabase
            .from('escrow_sessions')
            .select('deposited, released')
            .eq('session_id', request.sessionId)
            .single();
        perf.end('session_budget_check');

        if (!session) {
            contextLogger.error('Session not found', undefined, { sessionId: request.sessionId });
            return {
                success: false,
                rwaId: request.rwaId,
                fromState: stateMachine.currentState,
                toState: request.toState,
                paymentHash: '',
                transitionId: '',
                error: 'Session not found'
            };
        }

        const remaining = parseFloat(session.deposited) - parseFloat(session.released);
        if (remaining < costNum) {
            contextLogger.warn('Insufficient session budget', {
                remaining,
                required: costNum
            });
            return {
                success: false,
                rwaId: request.rwaId,
                fromState: stateMachine.currentState,
                toState: request.toState,
                paymentHash: '',
                transitionId: '',
                error: `Insufficient session budget: ${remaining} < ${costNum}`
            };
        }

        const paymentId = `rwa_transition_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        perf.start('record_payment');
        await supabase
            .from('session_payments')
            .insert({
                session_id: request.sessionId,
                agent_address: request.agentAddress,
                agent_name: `RWA ${request.agentRole}`,
                amount: cost,
                payment_method: 'x402',
                metadata: {
                    rwaId: request.rwaId,
                    transition: `${stateMachine.currentState}->${request.toState}`,
                    role: request.agentRole,
                    type: 'rwa_state_transition'
                }
            });

        await supabase
            .from('escrow_sessions')
            .update({
                released: (parseFloat(session.released) + costNum).toString()
            })
            .eq('session_id', request.sessionId);
        perf.end('record_payment');

        perf.start('record_transition');
        const { data: transition, error: transitionError } = await supabase
            .from('rwa_state_transitions')
            .insert({
                rwa_id: request.rwaId,
                from_state: stateMachine.currentState,
                to_state: request.toState,
                agent_address: request.agentAddress,
                agent_role: request.agentRole,
                payment_hash: paymentId,
                proof: request.proof || {},
                transitioned_at: new Date().toISOString()
            })
            .select()
            .single();

        if (transitionError) {
            contextLogger.error('Failed to record transition', transitionError);
            throw new Error(`Transition recording failed: ${transitionError.message}`);
        }

        await supabase
            .from('rwa_state_machines')
            .update({
                current_state: request.toState,
                previous_state: stateMachine.currentState,
                updated_at: new Date().toISOString()
            })
            .eq('rwa_id', request.rwaId);
        perf.end('record_transition');

        const totalDuration = perf.end('rwa_transition');

        contextLogger.info('RWA state transition completed', {
            fromState: stateMachine.currentState,
            toState: request.toState,
            cost,
            paymentId,
            durationMs: totalDuration
        });

        return {
            success: true,
            rwaId: request.rwaId,
            fromState: stateMachine.currentState,
            toState: request.toState,
            paymentHash: paymentId,
            transitionId: transition.id
        };
    }

    async getTransitionHistory(rwaId: string): Promise<StateTransition[]> {
        const { data, error } = await supabase
            .from('rwa_state_transitions')
            .select('*')
            .eq('rwa_id', rwaId)
            .order('transitioned_at', { ascending: false });

        if (error || !data) {
            return [];
        }

        return data.map(t => ({
            id: t.id,
            rwaId: t.rwa_id,
            fromState: t.from_state,
            toState: t.to_state,
            agentAddress: t.agent_address,
            agentRole: t.agent_role,
            paymentHash: t.payment_hash,
            proof: t.proof,
            transitionedAt: new Date(t.transitioned_at)
        }));
    }
}

export const rwaStateMachineService = RWAStateMachineService.getInstance();
