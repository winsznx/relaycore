/**
 * RWA Agent Coordination API Routes
 * 
 * Production-grade endpoints for multi-agent RWA orchestration.
 */

import { Router } from 'express';
import { rwaAgentCoordinator } from '../services/rwa/agent-coordinator.js';
import { AgentRole } from '../services/rwa/state-machine.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * POST /api/rwa/coordination/discover
 * Discover agents for specific role
 */
router.post('/discover', async (req, res) => {
    try {
        const { role, minReputation, maxCost, capabilities } = req.body;

        if (!role) {
            return res.status(400).json({ error: 'role required' });
        }

        if (!Object.values(AgentRole).includes(role)) {
            return res.status(400).json({ error: `Invalid role: ${role}` });
        }

        const agents = await rwaAgentCoordinator.discoverAgents({
            role,
            minReputation,
            maxCost,
            capabilities
        });

        res.json({
            role,
            agents: agents.map(a => ({
                agentAddress: a.agentAddress,
                reputation: a.reputation,
                cost: a.cost,
                latency: a.latency,
                score: a.compositeScore
            }))
        });
    } catch (error) {
        logger.error('Agent discovery failed', error as Error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/rwa/coordination/:rwaId/assign
 * Assign agent to RWA role
 */
router.post('/:rwaId/assign', async (req, res) => {
    try {
        const { rwaId } = req.params;
        const { agentAddress, role, metadata } = req.body;

        if (!agentAddress || !role) {
            return res.status(400).json({ error: 'agentAddress and role required' });
        }

        if (!Object.values(AgentRole).includes(role)) {
            return res.status(400).json({ error: `Invalid role: ${role}` });
        }

        const assignment = await rwaAgentCoordinator.assignAgent(
            rwaId,
            agentAddress,
            role,
            metadata || {}
        );

        res.json({
            success: true,
            assignment: {
                id: assignment.id,
                rwaId: assignment.rwaId,
                agentAddress: assignment.agentAddress,
                role: assignment.agentRole,
                status: assignment.status,
                assignedAt: assignment.assignedAt
            }
        });
    } catch (error) {
        logger.error('Agent assignment failed', error as Error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/rwa/coordination/:rwaId/plan
 * Create coordination plan for RWA
 */
router.post('/:rwaId/plan', async (req, res) => {
    try {
        const { rwaId } = req.params;
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId required' });
        }

        const plan = await rwaAgentCoordinator.createCoordinationPlan(
            rwaId,
            parseInt(sessionId)
        );

        res.json({
            success: true,
            plan: {
                rwaId: plan.rwaId,
                agents: plan.agents,
                totalCost: plan.totalCost,
                estimatedDuration: plan.estimatedDuration
            }
        });
    } catch (error) {
        logger.error('Coordination plan creation failed', error as Error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/rwa/coordination/:rwaId/execute
 * Execute coordination plan (orchestrate all agents)
 */
router.post('/:rwaId/execute', async (req, res) => {
    try {
        const { rwaId } = req.params;
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId required' });
        }

        const result = await rwaAgentCoordinator.executeCoordinationPlan(
            rwaId,
            parseInt(sessionId)
        );

        if (!result.success) {
            return res.status(400).json({
                success: false,
                completedTransitions: result.completedTransitions,
                failedAt: result.failedAt,
                error: result.error
            });
        }

        res.json({
            success: true,
            completedTransitions: result.completedTransitions
        });
    } catch (error) {
        logger.error('Coordination execution failed', error as Error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/rwa/coordination/:rwaId/assignments
 * Get agent assignments for RWA
 */
router.get('/:rwaId/assignments', async (req, res) => {
    try {
        const { rwaId } = req.params;

        const assignments = await rwaAgentCoordinator.getAssignments(rwaId);

        res.json({
            rwaId,
            assignments: assignments.map(a => ({
                id: a.id,
                agentAddress: a.agentAddress,
                role: a.agentRole,
                status: a.status,
                assignedAt: a.assignedAt,
                completedAt: a.completedAt,
                metadata: a.metadata
            }))
        });
    } catch (error) {
        logger.error('Assignments query failed', error as Error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
