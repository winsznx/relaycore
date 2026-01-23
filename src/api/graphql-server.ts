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

    // Escrow Session Routes
    const sessionRoutes = await import('./session-routes.js');
    app.use('/api/sessions', sessionRoutes.default);

    // A2A Discovery Routes (/.well-known/agent-card.json)
    const wellKnownRoutes = await import('./well-known-routes.js');
    app.use('/.well-known', wellKnownRoutes.default);

    // Task Artifacts Routes
    const taskRoutes = await import('./task-routes.js');
    app.use('/api/tasks', taskRoutes.default);

    // Route Proxy Routes (x402-protected API proxying)
    const routeProxyModule = await import('./route-proxy.js');
    app.use('/api/routes', routeProxyModule.default);
    app.use('/proxy', routeProxyModule.proxyRouter);

    // Meta-Agent Routes (Agent discovery and hiring)
    const metaAgentRoutes = await import('./meta-agent-routes.js');
    app.use('/api/meta-agent', metaAgentRoutes.default);

    // Initialize agents (auto-registers PerpAI agents)
    await import('../services/agents/index.js');
    console.log('Agent registry initialized with PerpAI agents');

    // Payment routes (x402)
    const paymentRoutes = await import('./payment-routes.js');
    app.use('/api', paymentRoutes.default);

    // Explorer Routes (Indexed data: sessions, transactions, agents, payments)
    const explorerRoutes = await import('./explorer.js');
    app.use('/api/explorer', explorerRoutes.default);

    // Observability Routes (Health, metrics, traces, alerts)
    const observabilityRoutes = await import('./observability.js');
    app.use('/api/observability', observabilityRoutes.default);

    // RWA Routes (Real-World Asset tokenization)
    const rwaRoutes = await import('./rwa.js');
    app.use('/api/rwa', rwaRoutes.default);

    // RWA State Machine Routes (Agent-mediated settlement)
    const rwaStateMachineRoutes = await import('./rwa-state-machine.js');
    app.use('/api/rwa/state-machine', rwaStateMachineRoutes.default);

    // RWA Agent Coordination Routes (Multi-agent orchestration)
    const rwaCoordinationRoutes = await import('./rwa-coordination.js');
    app.use('/api/rwa/coordination', rwaCoordinationRoutes.default);

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

    // RPC Health Check Endpoint (proxy to avoid CORS)
    app.get('/api/health/rpc', async (req, res) => {
        try {
            const rpcUrl = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org';
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_chainId',
                    params: [],
                    id: 1
                })
            });

            const data = await response.json();

            if (response.ok && data.result) {
                res.json({
                    status: 'connected',
                    chainId: data.result,
                    rpcUrl
                });
            } else {
                res.status(503).json({
                    status: 'disconnected',
                    error: 'Invalid RPC response'
                });
            }
        } catch (error: any) {
            logger.error('RPC health check failed', error);
            res.status(503).json({
                status: 'disconnected',
                error: error.message
            });
        }
    });

    // Global Health Check
    app.get('/health', (req, res) => {
        res.status(200).send('OK');
    });

    // Signing Interface (Simple HTML for demo purposes)
    app.get('/sign/:txId', (req, res) => {
        const { txId } = req.params;
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Sign Transaction</title>
                <style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f2f5; }
                    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; width: 100%; text-align: center; }
                    h2 { margin-top: 0; color: #1a1a1a; }
                    .tx-id { background: #f0f0f0; padding: 0.5rem; border-radius: 4px; font-family: monospace; word-break: break-all; margin: 1rem 0; font-size: 0.9rem; }
                    button { background: #000; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 1rem; width: 100%; }
                    button:hover { background: #333; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>Sign transaction</h2>
                    <p>You are about to sign and authorize the following transaction:</p>
                    <div class="tx-id">${txId}</div>
                    <button onclick="alert('Transaction signed successfully! (Demo mode)'); window.close()">Sign & Submit</button>
                    <p style="margin-top: 1rem; color: #666; font-size: 0.8rem;">Powered by Relay Core</p>
                </div>
            </body>
            </html>
        `);
    });

    app.listen(4001, () => {
        console.log(`x402 Settlement Endpoint at http://localhost:4001/api/pay`);
    });

    // 3. Start Indexers (PerpAI, Temporal, Graph)
    try {
        const { startIndexers } = await import('../services/indexer/index.js');
        await startIndexers();
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
