/**
 * Claude Chat API Route
 * 
 * REST endpoint for AI chat interactions
 * Connects frontend AIChat component to Claude agent service
 */

import { Router, type Request, type Response } from 'express';
import { agentChat } from '../services/ai/relay-agent-service.js';
import logger from '../lib/logger.js';

const router = Router();

interface ChatRequest {
    message: string;
    walletAddress?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    sessionId?: string;
}

/**
 * POST /api/chat
 * Main chat endpoint for Claude AI
 */
router.post('/', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
        const { message, walletAddress, conversationHistory, sessionId } = req.body as ChatRequest;

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

        // Validate conversation history
        const validHistory = (conversationHistory || [])
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .slice(-20); // Max 20 messages

        logger.info('Agent chat request', {
            messageLength: message.length,
            hasWallet: !!walletAddress,
            historyLength: validHistory.length,
        });

        // SOP 1: Intent Classification (< 50ms)
        const { classifyIntent, executeFastPath } = await import('../services/ai/intent-classifier.js');
        const intent = classifyIntent(message);

        logger.info('Intent classified', {
            type: intent.type,
            confidence: intent.confidence,
            requiresLLM: intent.requiresLLM,
            tool: intent.tool,
        });

        // SOP 4: Fast path for simple queries (< 300ms total)
        if (!intent.requiresLLM && intent.tool) {
            try {
                const fastResponse = await executeFastPath(intent, { walletAddress });
                const processingTimeMs = Date.now() - startTime;

                logger.info('Fast path response', {
                    processingTimeMs,
                    tool: intent.tool,
                });

                return res.json({
                    success: true,
                    message: fastResponse,
                    sessionId: sessionId || 'default',
                    processingTimeMs,
                    fastPath: true,
                });
            } catch (error) {
                logger.warn('Fast path failed, falling back to LLM', error as Error);
                // Fall through to LLM path
            }
        }

        // Slow path: Call Relay Agent with LLM (SOP 2: Data-first, tool-first)
        const response = await agentChat(
            [...validHistory, { role: 'user', content: message }],
            {
                walletAddress,
                sessionId: sessionId || 'default',
            }
        );

        const processingTimeMs = Date.now() - startTime;

        // Log successful response
        logger.info('Agent response sent', {
            sessionId: sessionId || 'default',
            processingTimeMs,
            tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
            toolCallsCount: response.toolCalls?.length || 0,
            dataSources: response.toolCalls?.map(t => t.dataSource).join(', ') || 'none',
        });

        res.json({
            success: true,
            message: response.content,
            toolCalls: response.toolCalls,
            sessionId: sessionId || 'default',
            processingTimeMs,
        });
    } catch (error) {
        logger.error('Agent chat error', error as Error);

        res.status(500).json({
            success: false,
            error: 'Failed to process agent request',
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
 */
router.post('/stream', async (req: Request, res: Response) => {
    const { message, walletAddress, conversationHistory, sessionId } = req.body as ChatRequest;

    // Validate
    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const validHistory = (conversationHistory || [])
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .slice(-20);

        // Call Relay Agent
        const response = await agentChat(
            [...validHistory, { role: 'user', content: message }],
            {
                walletAddress,
                sessionId: sessionId || 'default',
            }
        );

        // Send tool calls if any
        if (response.toolCalls) {
            res.write(`event: tool_calls\n`);
            res.write(`data: ${JSON.stringify(response.toolCalls)}\n\n`);
        }

        // Send message
        res.write(`event: message\n`);
        res.write(`data: ${JSON.stringify({ content: response.content })}\n\n`);

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
