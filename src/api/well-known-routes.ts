import { Router } from 'express';
import { wellKnownService } from '../services/well-known/well-known.service';
import logger from '../lib/logger';

const router = Router();

router.get('/agent-card.json', async (_req, res) => {
    try {
        const agentCard = await wellKnownService.getAgentCard();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json(agentCard);
    } catch (error) {
        logger.error('Failed to generate agent card', error as Error);
        res.status(500).json({ error: 'Failed to generate agent card' });
    }
});

router.get('/agent.json', async (_req, res) => {
    try {
        const agentCard = await wellKnownService.getAgentCard();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json(agentCard);
    } catch (error) {
        logger.error('Failed to generate agent card', error as Error);
        res.status(500).json({ error: 'Failed to generate agent card' });
    }
});

export default router;
