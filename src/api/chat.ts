/**
 * Chat API Endpoint
 * 
 * Handles AI chat requests from the frontend
 */

import express from 'express';
import { chatWithAgent } from '../services/claude/claude-agent.js';

const router = express.Router();

router.post('/chat', async (req, res) => {
    try {
        const { message, walletAddress, conversationHistory } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        const response = await chatWithAgent(message, {
            walletAddress,
            conversationHistory: conversationHistory || [],
        });

        res.json(response);
    } catch (error: any) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
