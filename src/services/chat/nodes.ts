/**
 * LangGraph Nodes for Relay Core Chatbot
 * 
 * Each node has a single, well-defined responsibility.
 * Nodes do NOT call each other - the graph handles transitions.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import type { RelayChatState } from './graph-state.js';
import { relayTools } from './tools.js';
import { logger } from '../../lib/logger.js';

const llm = new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Node 1: Input Validation
export async function validateInput(state: RelayChatState): Promise<Partial<RelayChatState>> {
    const lastMessage = state.messages[state.messages.length - 1];

    if (!lastMessage || !lastMessage.content || lastMessage.content.trim().length === 0) {
        return {
            error: 'Empty or invalid message',
        };
    }

    // Normalize wallet addresses if present
    if (state.context.walletAddress) {
        state.context.walletAddress = state.context.walletAddress.toLowerCase();
    }

    logger.info('Input validated', {
        messageLength: lastMessage.content.length,
        hasContext: !!state.context.walletAddress,
    });

    return {};
}

// Node 2: Intent Classification
export async function classifyIntent(state: RelayChatState): Promise<Partial<RelayChatState>> {
    const lastMessage = state.messages[state.messages.length - 1];

    const systemPrompt = `You are an intent classifier for Relay Core, an agentic finance platform.

Classify the user's intent into ONE of these categories:
- query: User wants information (prices, status, metrics, history)
- execute: User wants to perform an action (payment, trade, session creation)
- explain: User wants to understand past decisions or transactions
- simulate: User wants to dry-run an operation before executing

Respond with ONLY the intent category, nothing else.

User message: ${lastMessage.content}`;

    const response = await llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: lastMessage.content },
    ]);

    const intent = response.content.toString().trim().toLowerCase() as 'query' | 'execute' | 'explain' | 'simulate';

    logger.info('Intent classified', { intent });

    return { intent };
}

// Node 3: Context Retrieval (RAG)
export async function retrieveContext(state: RelayChatState): Promise<Partial<RelayChatState>> {
    const lastMessage = state.messages[state.messages.length - 1];

    // Import RAG service
    const { ragService } = await import('./rag-service.js');

    try {
        // Retrieve relevant documentation
        const docs = await ragService.retrieve(lastMessage.content, 3);

        logger.info('Context retrieved', {
            docCount: docs.length,
            avgRelevance: docs.reduce((sum, d) => sum + d.relevanceScore, 0) / docs.length || 0,
        });

        return {
            retrievedDocs: docs,
        };
    } catch (error) {
        logger.error('Context retrieval failed', error as Error);
        return {
            retrievedDocs: [],
        };
    }
}

// Node 4: Decision Node
export async function makeDecision(state: RelayChatState): Promise<Partial<RelayChatState>> {
    const lastMessage = state.messages[state.messages.length - 1];

    const systemPrompt = `You are the decision engine for Relay Core chatbot.

Based on the user's intent and message, decide if tools are needed.

Intent: ${state.intent}
Message: ${lastMessage.content}

Available tools:
- query_indexer: Query blockchain data
- get_service_metrics: Get service stats
- get_market_price: Get crypto prices
- discover_services: Find services
- simulate_payment: Simulate payment
- generate_handoff_url: Create signing URL

Respond with a JSON object:
{
  "needsTools": boolean,
  "toolsToCall": string[] (tool names),
  "requiresApproval": boolean
}

If the user just wants a simple answer and no data is needed, set needsTools to false.`;

    const response = await llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: lastMessage.content },
    ]);

    try {
        // Extract JSON from markdown code blocks if present
        let jsonStr = response.content.toString().trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        const decision = JSON.parse(jsonStr);

        logger.info('Decision made', decision);

        return {
            requiresApproval: decision.requiresApproval || false,
        };
    } catch (error) {
        logger.error('Decision parsing failed', error as Error);
        return {};
    }
}

// Node 5: Tool Execution
export async function executeTools(state: RelayChatState): Promise<Partial<RelayChatState>> {
    const lastMessage = state.messages[state.messages.length - 1];

    // Bind tools to LLM
    const llmWithTools = llm.bindTools(relayTools);

    const response = await llmWithTools.invoke([
        { role: 'user', content: lastMessage.content },
    ]);

    // Check if tools were called
    if (!response.tool_calls || response.tool_calls.length === 0) {
        return {};
    }

    // Execute tools
    const toolCalls = await Promise.all(
        response.tool_calls.map(async (toolCall) => {
            const tool = relayTools.find(t => t.name === toolCall.name);

            if (!tool) {
                return {
                    name: toolCall.name,
                    input: toolCall.args,
                    error: `Tool ${toolCall.name} not found`,
                };
            }

            try {
                const startTime = Date.now();
                const result = await tool.invoke(toolCall.args);
                const executionTimeMs = Date.now() - startTime;

                return {
                    name: toolCall.name,
                    input: toolCall.args,
                    result,
                    executionTimeMs,
                    dataSource: result.dataSource || 'unknown',
                };
            } catch (error) {
                logger.error(`Tool ${toolCall.name} failed`, error as Error);
                return {
                    name: toolCall.name,
                    input: toolCall.args,
                    error: (error as Error).message,
                };
            }
        })
    );

    logger.info('Tools executed', {
        count: toolCalls.length,
        tools: toolCalls.map(t => t.name),
    });

    return { toolCalls };
}

// Node 6: Simulation
export async function runSimulation(state: RelayChatState): Promise<Partial<RelayChatState>> {
    const lastMessage = state.messages[state.messages.length - 1];

    // Use simulate_payment tool
    const simulateTool = relayTools.find(t => t.name === 'simulate_payment');

    if (!simulateTool) {
        return {
            error: 'Simulation tool not available',
        };
    }

    // Extract params from message (simplified - in production, use LLM to extract)
    // For now, return a generic simulation
    const simulationResult = {
        description: `Simulation for: "${lastMessage.content}"`,
        wouldExecute: 'Payment to service',
        estimatedCost: 'Varies by service',
        risks: [],
        confirmations: ['This is a simulation - no actual execution'],
    };

    logger.info('Simulation completed');

    return { simulationResult };
}

// Node 7: Approval Gate
export async function generateApproval(state: RelayChatState): Promise<Partial<RelayChatState>> {
    // Generate approval actions for risky operations
    const approvalActions = [{
        label: 'Proceed with operation',
        endpoint: '/api/execute',
        method: 'POST' as const,
        body: {
            intent: state.intent,
            context: state.context,
        },
        requiresApproval: true,
        riskLevel: 'medium' as const,
    }];

    logger.info('Approval actions generated');

    return {
        requiresApproval: true,
        approvalActions,
    };
}

// Node 8: Response Synthesis
export async function synthesizeResponse(state: RelayChatState): Promise<Partial<RelayChatState>> {
    const lastMessage = state.messages[state.messages.length - 1];

    // Build context from tool results
    let toolContext = '';
    if (state.toolCalls.length > 0) {
        toolContext = '\n\nTool Results:\n' + state.toolCalls.map(tc =>
            `- ${tc.name}: ${tc.error || JSON.stringify(tc.result)}`
        ).join('\n');
    }

    const systemPrompt = `You are Relay Core AI assistant. You help users with agentic finance on Cronos.

CRITICAL RULES:
1. NEVER fabricate data - only use information from tool results
2. If a tool failed, say so explicitly
3. Be concise and direct
4. Do NOT use markdown formatting
5. If approval is required, explain why

Intent: ${state.intent}
${toolContext}`;

    const response = await llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: lastMessage.content },
    ]);

    const content = response.content.toString()
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .trim();

    logger.info('Response synthesized', {
        length: content.length,
    });

    return {
        messages: [{
            role: 'assistant' as const,
            content,
        }],
    };
}

// Node 9: Memory Update
export async function updateMemory(state: RelayChatState): Promise<Partial<RelayChatState>> {
    // Import memory service
    const { memoryService } = await import('./memory-service.js');

    if (!state.context.walletAddress) {
        logger.warn('No wallet address - skipping memory update');
        return {};
    }

    const sessionId = state.context.sessionId || 'default';

    try {
        await memoryService.storeConversation(
            state.context.walletAddress,
            sessionId,
            state.messages
        );

        logger.info('Memory updated', {
            messageCount: state.messages.length,
            walletAddress: state.context.walletAddress,
            sessionId,
        });
    } catch (error) {
        logger.error('Memory update failed', error as Error);
    }

    return {};
}
