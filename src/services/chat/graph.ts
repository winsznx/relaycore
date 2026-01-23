/**
 * Relay Core LangGraph Definition
 * 
 * Production-grade state graph for chatbot orchestration.
 * Implements proper separation of concerns and deterministic flow.
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { RelayChatStateAnnotation, type RelayChatState } from './graph-state.js';
import {
    validateInput,
    classifyIntent,
    retrieveContext,
    makeDecision,
    executeTools,
    runSimulation,
    generateApproval,
    synthesizeResponse,
    updateMemory,
} from './nodes.js';
import { logger } from '../../lib/logger.js';

// Define routing logic
function routeAfterValidation(state: RelayChatState): string {
    if (state.error) {
        return 'synthesize_response';
    }
    return 'classify_intent';
}

function routeAfterIntent(state: RelayChatState): string {
    switch (state.intent) {
        case 'simulate':
            return 'run_simulation';
        case 'query':
        case 'explain':
            return 'retrieve_context';
        case 'execute':
            return 'make_decision';
        default:
            return 'make_decision';
    }
}

function routeAfterDecision(state: RelayChatState): string {
    if (state.requiresApproval) {
        return 'generate_approval';
    }
    return 'execute_tools';
}

function routeAfterTools(state: RelayChatState): string {
    // Check if any tools failed
    const hasErrors = state.toolCalls.some(tc => tc.error);

    if (hasErrors) {
        logger.warn('Some tools failed', {
            failed: state.toolCalls.filter(tc => tc.error).map(tc => tc.name),
        });
    }

    return 'synthesize_response';
}

// Build the graph
const workflow = new StateGraph(RelayChatStateAnnotation)
    // Add all nodes
    .addNode('validate_input', validateInput)
    .addNode('classify_intent', classifyIntent)
    .addNode('retrieve_context', retrieveContext)
    .addNode('make_decision', makeDecision)
    .addNode('execute_tools', executeTools)
    .addNode('run_simulation', runSimulation)
    .addNode('generate_approval', generateApproval)
    .addNode('synthesize_response', synthesizeResponse)
    .addNode('update_memory', updateMemory)

    // Define edges
    .addEdge(START, 'validate_input')
    .addConditionalEdges('validate_input', routeAfterValidation)
    .addConditionalEdges('classify_intent', routeAfterIntent)
    .addEdge('retrieve_context', 'make_decision')
    .addConditionalEdges('make_decision', routeAfterDecision)
    .addConditionalEdges('execute_tools', routeAfterTools)
    .addEdge('run_simulation', 'synthesize_response')
    .addEdge('generate_approval', 'synthesize_response')
    .addEdge('synthesize_response', 'update_memory')
    .addEdge('update_memory', END);

// Compile the graph
export const relayChatGraph = workflow.compile();

// Export convenience function
export async function processChat(
    message: string,
    context: {
        walletAddress?: string;
        sessionId?: string;
        agentId?: string;
        taskId?: string;
    } = {}
): Promise<{
    response: string;
    toolCalls?: Array<{ name: string; result: unknown }>;
    requiresApproval?: boolean;
    approvalActions?: unknown[];
    error?: string;
}> {
    try {
        const result = await relayChatGraph.invoke({
            messages: [{ role: 'user' as const, content: message }],
            context,
        });

        const lastMessage = result.messages[result.messages.length - 1];

        return {
            response: lastMessage?.content || 'No response generated',
            toolCalls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
            requiresApproval: result.requiresApproval,
            approvalActions: result.approvalActions,
            error: result.error,
        };
    } catch (error) {
        logger.error('Chat processing failed', error as Error);
        return {
            response: 'An error occurred processing your request',
            error: (error as Error).message,
        };
    }
}
