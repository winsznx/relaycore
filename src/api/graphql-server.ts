import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import express from 'express';
import cors from 'cors';
import typeDefs from './graphql/schema.ts';
import resolvers from './graphql/resolvers.ts';
import { supabase } from '../lib/supabase.ts';
import { checkRateLimit, RateLimitError } from '../lib/rate-limiter.ts';
import logger from '../lib/logger.ts';
import { facilitatorService } from '../services/x402/facilitator-service.ts';

/**
 * Main API Server for Relay Core
 * 
 * Includes:
 * - GraphQL API (Port 4000)
 * - REST API for x402 (Port 4001) - Separate Express app to avoid Apollo import issues
 */

const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    formatError: (error) => {
        logger.error('GraphQL Error', new Error(error.message), {
            code: error.extensions?.code,
            path: error.path
        });
        return {
            message: error.message,
            code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
            path: error.path,
        };
    },
});

async function startServers() {
    // 1. Start GraphQL Server (Standalone)
    const { url } = await startStandaloneServer(server, {
        listen: { port: 4000 },
        context: async ({ req }) => {
            const ip = req.headers['x-forwarded-for'] as string ||
                req.headers['x-real-ip'] as string ||
                'unknown';

            // Rate limiting
            try {
                checkRateLimit(ip, { limit: 100, windowMs: 60000 });
            } catch (error) {
                if (error instanceof RateLimitError) {
                    logger.warn('Rate limit exceeded', { ip, retryAfter: error.retryAfter });
                    throw new Error(`Rate limit exceeded. Retry in ${error.retryAfter}s`);
                }
                throw error;
            }

            // Extract API key from headers
            const apiKey = req.headers['x-api-key'];

            // Validate API key against database
            let authenticated = false;
            if (apiKey) {
                try {
                    const { data, error } = await supabase
                        .rpc('validate_api_key', { api_key: apiKey });

                    if (!error && data === true) {
                        authenticated = true;
                        logger.debug('API key authenticated', { ip });
                    }
                } catch (error) {
                    logger.error('API key validation error', error as Error, { ip });
                }
            }

            return {
                apiKey,
                authenticated,
                ip,
            };
        },
    });

    console.log(`GraphQL Server ready at: ${url}`);

    // 2. Start REST API Server (Express)
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Import and mount trade routes (with x402 payment middleware)
    const tradeRoutes = await import('./trade-routes.js');
    app.use('/api/trade', tradeRoutes.default);

    // Service Discovery API
    const serviceDiscovery = await import('./service-discovery.js');
    app.use('/api/services', serviceDiscovery.default);

    // PerpAI Routes
    const perpaiRoutes = await import('./perpai-routes.js');
    app.use('/api/perpai', perpaiRoutes.default);

    // Bot Integration Routes
    const botRoutes = await import('./bot-routes.js');
    app.use('/api/bot', botRoutes.default);

    // Claude AI Chat Routes
    const chatRoutes = await import('./chat-routes.js');
    app.use('/api/chat', chatRoutes.default);

    // User Profile & Settings Routes
    const userRoutes = await import('./user-routes.js');
    app.use('/api/user', userRoutes.default);

    // Agent Registry Routes
    const agentRoutes = await import('./routes/agents.js');
    app.use('/api/agents', agentRoutes.default);

    // Initialize agents (auto-registers PerpAI agents)
    await import('../services/agents/index.js');
    console.log('Agent registry initialized with PerpAI agents');

    // Payment routes (x402)
    const paymentRoutes = await import('./payment-routes.js');
    app.use('/api', paymentRoutes.default);

    // x402 Settlement Endpoint
    app.post('/api/pay', async (req, res) => {
        try {
            const { paymentHeader, paymentRequirements } = req.body;

            if (!paymentHeader || !paymentRequirements) {
                return res.status(400).json({ error: 'Missing payment parameters' });
            }

            // Settle payment via Facilitator Service
            const result = await facilitatorService.settlePayment({
                paymentHeader,
                paymentRequirements
            });

            res.json(result);
        } catch (error: any) {
            logger.error('Payment settlement failed', error);
            res.status(500).json({ error: error.message || 'Payment settlement failed' });
        }
    });

    // Chat API Endpoint
    app.post('/api/chat', async (req, res) => {
        try {
            const { message, walletAddress, conversationHistory } = req.body;

            if (!message || typeof message !== 'string') {
                return res.status(400).json({ error: 'Message is required' });
            }

            // Import chat service dynamically to avoid circular dependencies
            const { chatWithAgent } = await import('../services/claude/claude-agent.js');

            const response = await chatWithAgent(message, {
                walletAddress,
                conversationHistory: conversationHistory || [],
            });

            res.json(response);
        } catch (error: any) {
            logger.error('Chat API error', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.listen(4001, () => {
        console.log(`x402 Settlement Endpoint at http://localhost:4001/api/pay`);
    });

    // 3. Start Indexers (PerpAI, Temporal, Graph)
    try {
        const { startAllIndexers } = await import('../services/indexer/index.js');
        await startAllIndexers();
        console.log('All indexers started successfully');
    } catch (error) {
        logger.warn('Failed to start indexers (non-blocking)', error as Error);
        // Don't exit - indexers are optional for development
    }

    // 4. Register AI Agents as Services
    try {
        const { registerAgentsAsServices } = await import('../services/agents/register-agents-as-services.ts');
        await registerAgentsAsServices();
        console.log('AI Agents registered in marketplace');
    } catch (error) {
        console.error('Failed to register agents:', error);
        logger.warn('Failed to register agents as services (non-blocking)', error as Error);
    }

    // 4. Start Telegram Bot (if configured)
    console.log('Attempting to start Telegram bot...');
    try {
        const { startTelegramBot } = await import('../services/bot-linking/telegram-bot.js');
        console.log('Bot module imported successfully');
        await startTelegramBot();
        console.log('Bot startup function completed');
    } catch (error) {
        console.error('Bot startup failed:', error);
        logger.warn('Telegram bot not started (optional)', error as Error);
    }
}

startServers().catch((error) => {
    console.error('Failed to start servers:', error);
    process.exit(1);
});
