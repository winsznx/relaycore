/**
 * RWA State Machine API Routes
 * 
 * Production-grade endpoints for agent-mediated RWA settlement.
 * Every transition enforced by x402 payments.
 */

import { Router } from 'express';
import { rwaStateMachineService, RWAState, AgentRole } from '../services/rwa/state-machine.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * GET /api/rwa/state-machines
 * List all RWA state machines
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await (await import('../lib/supabase.js')).supabase
            .from('rwa_state_machines')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            throw new Error(error.message);
        }

        res.json({
            stateMachines: data || []
        });
    } catch (error) {
        logger.error('Failed to list state machines', error as Error);
        res.status(500).json({
            error: (error as Error).message
        });
    }
});

/**
 * POST /api/rwa/state-machine/create
 * Create new RWA state machine
 */
router.post('/create', async (req, res) => {
    try {
        const { rwaId, metadata } = req.body;

        if (!rwaId) {
            return res.status(400).json({ error: 'rwaId required' });
        }

        const stateMachine = await rwaStateMachineService.createStateMachine(
            rwaId,
            metadata || {}
        );

        logger.info('RWA state machine created via API', { rwaId });

        res.json({
            success: true,
            stateMachine: {
                id: stateMachine.id,
                rwaId: stateMachine.rwaId,
                currentState: stateMachine.currentState,
                metadata: stateMachine.metadata,
                createdAt: stateMachine.createdAt
            }
        });
    } catch (error) {
        logger.error('State machine creation failed', error as Error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

/**
 * POST /api/rwa/state-machine/:rwaId/transition
 * Trigger state transition with x402 payment
 * 
 * Flow:
 * 1. Request without payment -> 402 Payment Required
 * 2. Client pays via Facilitator
 * 3. Request with payment header -> Verify & Execute
 */
router.post('/:rwaId/transition', async (req, res) => {
    try {
        const { rwaId } = req.params;
        const { toState, agentAddress, agentRole, paymentHeader, paymentRequirements } = req.body;

        if (!toState || !agentAddress || !agentRole) {
            return res.status(400).json({
                error: 'toState, agentAddress, and agentRole required'
            });
        }

        if (!Object.values(RWAState).includes(toState)) {
            return res.status(400).json({
                error: `Invalid state: ${toState}`
            });
        }

        if (!Object.values(AgentRole).includes(agentRole)) {
            return res.status(400).json({
                error: `Invalid agent role: ${agentRole}`
            });
        }

        const stateMachine = await rwaStateMachineService.getStateMachine(rwaId);

        if (!stateMachine) {
            return res.status(404).json({
                error: 'State machine not found'
            });
        }

        if (!rwaStateMachineService.isValidTransition(stateMachine.currentState, toState)) {
            return res.status(400).json({
                error: `Invalid transition: ${stateMachine.currentState} -> ${toState}`
            });
        }

        const cost = rwaStateMachineService.getTransitionCost(stateMachine.currentState, toState);

        if (!paymentHeader || !paymentRequirements) {
            const { rwaPaymentService } = await import('../services/rwa/rwa-payment-service.js');

            const challenge = rwaPaymentService.generatePaymentChallenge({
                rwaId,
                fromState: stateMachine.currentState,
                toState,
                agentAddress,
                agentRole,
                cost,
                resourceUrl: `/api/rwa/state-machine/${rwaId}/transition`
            });

            res.setHeader('WWW-Authenticate', challenge.wwwAuthenticate);
            return res.status(402).json({
                error: 'Payment Required',
                message: challenge.message,
                paymentRequirements: challenge.paymentRequirements
            });
        }

        const { rwaPaymentService } = await import('../services/rwa/rwa-payment-service.js');

        const paymentResult = await rwaPaymentService.verifyAndSettlePayment({
            paymentHeader,
            paymentRequirements,
            rwaId,
            fromState: stateMachine.currentState,
            toState,
            agentAddress,
            agentRole
        });

        if (!paymentResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Payment verification failed'
            });
        }

        const { data: transition, error: transitionError } = await (await import('../lib/supabase.js')).supabase
            .from('rwa_state_transitions')
            .insert({
                rwa_id: rwaId,
                from_state: stateMachine.currentState,
                to_state: toState,
                agent_address: agentAddress,
                agent_role: agentRole,
                payment_hash: paymentResult.txHash,
                proof: { paymentId: paymentResult.paymentId, txHash: paymentResult.txHash },
                transitioned_at: new Date().toISOString()
            })
            .select()
            .single();

        if (transitionError) {
            logger.error('State transition failed', transitionError);
            return res.status(500).json({
                success: false,
                error: 'Transition recording failed'
            });
        }

        await (await import('../lib/supabase.js')).supabase
            .from('rwa_state_machines')
            .update({
                current_state: toState,
                previous_state: stateMachine.currentState,
                updated_at: new Date().toISOString()
            })
            .eq('rwa_id', rwaId);

        logger.info('RWA state transition via x402', {
            rwaId,
            from: stateMachine.currentState,
            to: toState,
            agent: agentAddress,
            txHash: paymentResult.txHash
        });

        res.json({
            success: true,
            transition: {
                rwaId,
                fromState: stateMachine.currentState,
                toState,
                paymentHash: paymentResult.txHash,
                transitionId: transition.id,
                txHash: paymentResult.txHash
            }
        });
    } catch (error) {
        logger.error('State transition failed', error as Error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

/**
 * GET /api/rwa/state-machine/:rwaId/state
 * Get current state of RWA
 */
router.get('/:rwaId/state', async (req, res) => {
    try {
        const { rwaId } = req.params;

        const stateMachine = await rwaStateMachineService.getStateMachine(rwaId);

        if (!stateMachine) {
            return res.status(404).json({
                error: 'State machine not found'
            });
        }

        res.json({
            rwaId: stateMachine.rwaId,
            currentState: stateMachine.currentState,
            previousState: stateMachine.previousState,
            metadata: stateMachine.metadata,
            updatedAt: stateMachine.updatedAt
        });
    } catch (error) {
        logger.error('State query failed', error as Error);
        res.status(500).json({
            error: (error as Error).message
        });
    }
});

/**
 * GET /api/rwa/state-machine/:rwaId/history
 * Get transition history for RWA
 */
router.get('/:rwaId/history', async (req, res) => {
    try {
        const { rwaId } = req.params;

        const history = await rwaStateMachineService.getTransitionHistory(rwaId);

        res.json({
            rwaId,
            transitions: history.map(t => ({
                id: t.id,
                fromState: t.fromState,
                toState: t.toState,
                agentAddress: t.agentAddress,
                agentRole: t.agentRole,
                paymentHash: t.paymentHash,
                proof: t.proof,
                transitionedAt: t.transitionedAt
            }))
        });
    } catch (error) {
        logger.error('History query failed', error as Error);
        res.status(500).json({
            error: (error as Error).message
        });
    }
});

/**
 * GET /api/rwa/state-machine/:rwaId/next-states
 * Get valid next states for current state
 */
router.get('/:rwaId/next-states', async (req, res) => {
    try {
        const { rwaId } = req.params;

        const stateMachine = await rwaStateMachineService.getStateMachine(rwaId);

        if (!stateMachine) {
            return res.status(404).json({
                error: 'State machine not found'
            });
        }

        const validTransitions: Record<RWAState, RWAState[]> = {
            [RWAState.CREATED]: [RWAState.VERIFIED, RWAState.DISPUTED],
            [RWAState.VERIFIED]: [RWAState.ESCROWED, RWAState.DISPUTED],
            [RWAState.ESCROWED]: [RWAState.IN_PROCESS, RWAState.DISPUTED],
            [RWAState.IN_PROCESS]: [RWAState.FULFILLED, RWAState.DISPUTED],
            [RWAState.FULFILLED]: [RWAState.SETTLED, RWAState.DISPUTED],
            [RWAState.SETTLED]: [],
            [RWAState.DISPUTED]: [RWAState.CREATED]
        };

        const nextStates = validTransitions[stateMachine.currentState] || [];

        const statesWithCosts = nextStates.map(state => ({
            state,
            cost: rwaStateMachineService.getTransitionCost(stateMachine.currentState, state),
            requiredRole: rwaStateMachineService.getRequiredRole(stateMachine.currentState, state)
        }));

        res.json({
            rwaId,
            currentState: stateMachine.currentState,
            nextStates: statesWithCosts
        });
    } catch (error) {
        logger.error('Next states query failed', error as Error);
        res.status(500).json({
            error: (error as Error).message
        });
    }
});

export default router;
