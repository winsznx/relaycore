/**
 * Meta-Agent API Routes
 * Agent discovery, hiring, and delegation
 */

import express from 'express';
import { metaAgentService } from '../services/agents/meta-agent-service.js';
import logger from '../lib/logger.js';
import type { AgentDiscoveryQuery, HireAgentRequest } from '../types/meta-agent.js';

const router = express.Router();

/**
 * POST /api/meta-agent/discover
 * Discover and rank agents based on criteria
 */
router.post('/discover', async (req, res) => {
    try {
        const query: AgentDiscoveryQuery = req.body;

        const agents = await metaAgentService.discoverAgents(query);

        res.json({
            success: true,
            count: agents.length,
            agents
        });
    } catch (error) {
        logger.error('Agent discovery failed', error as Error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Discovery failed'
        });
    }
});

/**
 * POST /api/meta-agent/hire
 * Hire an agent to perform a task
 */
router.post('/hire', async (req, res) => {
    try {
        const request: HireAgentRequest = req.body;
        const metaAgentId = req.headers['x-agent-id'] as string || 'meta-agent-default';

        if (!request.agentId || !request.resourceId || !request.budget) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: agentId, resourceId, budget'
            });
        }

        const result = await metaAgentService.hireAgent(request, metaAgentId);

        res.json(result);
    } catch (error) {
        logger.error('Agent hiring failed', error as Error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Hiring failed'
        });
    }
});

/**
 * POST /api/meta-agent/execute/:taskId
 * Execute a delegated task
 */
router.post('/execute/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;

        const outcome = await metaAgentService.executeDelegation(taskId);

        res.json({
            success: outcome.state === 'settled',
            outcome
        });
    } catch (error) {
        logger.error('Delegation execution failed', error as Error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Execution failed'
        });
    }
});

/**
 * GET /api/meta-agent/status/:taskId
 * Get delegation status
 */
router.get('/status/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;

        const outcome = await metaAgentService.getDelegationStatus(taskId);

        res.json({
            success: true,
            outcome
        });
    } catch (error) {
        logger.error('Failed to get delegation status', error as Error);
        res.status(404).json({
            success: false,
            error: error instanceof Error ? error.message : 'Task not found'
        });
    }
});

/**
 * GET /api/meta-agent/agent-card/:agentId
 * Fetch agent card for a specific agent
 */
router.get('/agent-card/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;

        // Get agent endpoint URL from database
        const { supabase } = await import('../lib/supabase.js');
        const { data: agent } = await supabase
            .from('services')
            .select('endpoint_url')
            .eq('id', agentId)
            .single();

        if (!agent?.endpoint_url) {
            return res.status(404).json({
                success: false,
                error: 'Agent endpoint not found'
            });
        }

        const card = await metaAgentService.fetchAgentCard(agent.endpoint_url);

        if (!card) {
            return res.status(404).json({
                success: false,
                error: 'Agent card not found'
            });
        }

        res.json({
            success: true,
            card
        });
    } catch (error) {
        logger.error('Failed to fetch agent card', error as Error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch card'
        });
    }
});

export default router;
