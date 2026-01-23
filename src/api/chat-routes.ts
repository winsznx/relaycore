/**
 * Claude Chat API Route
 * 
 * REST endpoint for AI chat interactions
 * Uses LangGraph for proper state management and tool orchestration
 */

import { Router, type Request, type Response } from 'express';
import { processChat } from '../services/chat/index.js';
import logger from '../lib/logger.js';

const router = Router();

interface ChatRequest {
    message: string;
    walletAddress?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    sessionId?: string;
    agentId?: string;
    taskId?: string;
}

/**
 * POST /api/chat
 * Main chat endpoint using LangGraph
 */
router.post('/', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
        const { message, walletAddress, sessionId, agentId, taskId } = req.body as ChatRequest;

        // Validate request
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Message is required',
            });
        }

        // Limit message length
        if (message.length > 10000) {
            return res.status(400).json({
                success: false,
                error: 'Message too long. Maximum 10000 characters.',
            });
        }

        logger.info('Chat request', {
            messageLength: message.length,
            hasWallet: !!walletAddress,
            sessionId,
        });

        // Process through LangGraph
        const result = await processChat(message, {
            walletAddress,
            sessionId,
            agentId,
            taskId,
        });

        const processingTimeMs = Date.now() - startTime;

        logger.info('Chat response sent', {
            sessionId: sessionId || 'default',
            processingTimeMs,
            toolCallsCount: result.toolCalls?.length || 0,
            requiresApproval: result.requiresApproval,
            hasError: !!result.error,
        });

        res.json({
            success: !result.error,
            message: result.response,
            toolCalls: result.toolCalls,
            requiresApproval: result.requiresApproval,
            approvalActions: result.approvalActions,
            sessionId: sessionId || 'default',
            processingTimeMs,
            error: result.error,
        });
    } catch (error) {
        logger.error('Chat error', error as Error);

        res.status(500).json({
            success: false,
            error: 'Failed to process chat request',
            processingTimeMs: Date.now() - startTime,
        });
    }
});

/**
 * GET /api/chat/health
 * Health check for Claude integration
 */
router.get('/health', async (_req: Request, res: Response) => {
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

    res.json({
        status: hasApiKey ? 'healthy' : 'degraded',
        claudeConfigured: hasApiKey,
        timestamp: new Date().toISOString(),
    });
});

/**
 * POST /api/chat/stream
 * Streaming chat endpoint (Server-Sent Events)
 * TODO: Implement streaming support in LangGraph
 */
router.post('/stream', async (req: Request, res: Response) => {
    const { message, walletAddress, sessionId, agentId, taskId } = req.body as ChatRequest;

    // Validate
    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        // Process through LangGraph (non-streaming for now)
        const result = await processChat(message, {
            walletAddress,
            sessionId,
            agentId,
            taskId,
        });

        // Send tool calls if any
        if (result.toolCalls) {
            res.write(`event: tool_calls\n`);
            res.write(`data: ${JSON.stringify(result.toolCalls)}\n\n`);
        }

        // Send message
        res.write(`event: message\n`);
        res.write(`data: ${JSON.stringify({ content: result.response })}\n\n`);

        // Send approval actions if needed
        if (result.requiresApproval && result.approvalActions) {
            res.write(`event: approval_required\n`);
            res.write(`data: ${JSON.stringify(result.approvalActions)}\n\n`);
        }

        // Send done event
        res.write(`event: done\n`);
        res.write(`data: ${JSON.stringify({
            sessionId: sessionId || 'default',
            processingTimeMs: Date.now()
        })}\n\n`);

        res.end();
    } catch (error) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
        res.end();
    }
});

export { router as chatRoutes };
export default router;
