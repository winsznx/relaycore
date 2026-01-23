import { Router } from 'express';
import { taskStore } from '../services/tasks';
import logger from '../lib/logger';
import type { TaskQuery } from '../types/task-artifact';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const query: TaskQuery = {
            agent_id: req.query.agent_id as string,
            service_id: req.query.service_id as string,
            session_id: req.query.session_id as string | undefined,
            state: req.query.state as TaskQuery['state'],
            limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
            offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        };

        if (req.query.from) query.from = new Date(req.query.from as string);
        if (req.query.to) query.to = new Date(req.query.to as string);

        const tasks = await taskStore.query(query);
        res.json({ tasks, count: tasks.length });
    } catch (error) {
        logger.error('Failed to query tasks', error as Error);
        res.status(500).json({ error: 'Failed to query tasks' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const agentId = req.query.agent_id as string | undefined;
        const stats = await taskStore.getStats(agentId);
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get task stats', error as Error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

router.get('/:taskId', async (req, res) => {
    try {
        const task = await taskStore.get(req.params.taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        logger.error('Failed to get task', error as Error);
        res.status(500).json({ error: 'Failed to get task' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { agent_id, service_id, session_id, inputs } = req.body;

        if (!agent_id) {
            return res.status(400).json({ error: 'agent_id is required' });
        }

        const task = await taskStore.create({
            agent_id,
            service_id,
            session_id,
            inputs: inputs || {},
        });

        res.status(201).json(task);
    } catch (error) {
        logger.error('Failed to create task', error as Error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

router.patch('/:taskId', async (req, res) => {
    try {
        const { state, payment_id, facilitator_tx, outputs, error, metrics } = req.body;

        const task = await taskStore.update(req.params.taskId, {
            state,
            payment_id,
            facilitator_tx,
            outputs,
            error,
            metrics,
        });

        res.json(task);
    } catch (error) {
        logger.error('Failed to update task', error as Error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

router.post('/:taskId/settle', async (req, res) => {
    try {
        const { outputs, metrics } = req.body;
        const task = await taskStore.markSettled(req.params.taskId, outputs || {}, metrics);
        res.json(task);
    } catch (error) {
        logger.error('Failed to settle task', error as Error);
        res.status(500).json({ error: 'Failed to settle task' });
    }
});

router.post('/:taskId/fail', async (req, res) => {
    try {
        const { error: taskError, metrics } = req.body;

        if (!taskError?.code || !taskError?.message) {
            return res.status(400).json({ error: 'error.code and error.message are required' });
        }

        const task = await taskStore.markFailed(req.params.taskId, taskError, metrics);
        res.json(task);
    } catch (error) {
        logger.error('Failed to fail task', error as Error);
        res.status(500).json({ error: 'Failed to mark task as failed' });
    }
});

export default router;
