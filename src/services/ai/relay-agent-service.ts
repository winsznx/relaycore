/**
 * Relay Core Agent Service
 * 
 * Agent Control Console - NOT a generic chatbot
 * Follows SOPs for execution-oriented AI interface
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../lib/logger.js';
import { RELAY_AGENT_TOOLS, executeRelayTool } from './relay-agent-tools.js';
import RELAY_AGENT_SYSTEM_PROMPT from './relay-agent-prompt.js';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AgentMessage {
    role: 'user' | 'assistant';
    content: string | Array<any>;
}

interface AgentResponse {
    content: string;
    toolCalls?: Array<{
        name: string;
        input: Record<string, any>;
        result: any;
        executionTimeMs: number;
        dataSource: string;
    }>;
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
}

/**
 * Agent Control Console Chat
 * SOP 2: Tool-first, LLM-second
 * SOP 7: Pre-computed context windows
 */
export async function agentChat(
    messages: AgentMessage[],
    context: {
        walletAddress?: string;
        sessionId?: string;
    } = {}
): Promise<AgentResponse> {
    const toolCalls: AgentResponse['toolCalls'] = [];
    let conversationMessages = [...messages];

    // Build context-aware system prompt
    const systemPrompt = `${RELAY_AGENT_SYSTEM_PROMPT}

CURRENT CONTEXT:
${context.walletAddress ? `Connected Wallet: ${context.walletAddress}` : 'Wallet: Not connected'}
${context.sessionId ? `Session: ${context.sessionId}` : ''}

Remember: You are a command console, not a conversation partner.`;

    // Initial Claude call with Relay-specific tools
    let response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        temperature: 0.7, // Lower temperature for more deterministic responses
        system: systemPrompt,
        messages: conversationMessages.map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : msg.content,
        })),
        tools: RELAY_AGENT_TOOLS as any,
    });

    // Handle tool calls (SOP 2: Data first, then reasoning)
    while (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
            toolUseBlocks.map(async (toolUse: any) => {
                try {
                    const { result, executionTimeMs, dataSource } = await executeRelayTool(
                        toolUse.name,
                        toolUse.input
                    );

                    toolCalls.push({
                        name: toolUse.name,
                        input: toolUse.input,
                        result,
                        executionTimeMs,
                        dataSource,
                    });

                    return {
                        type: 'tool_result',
                        tool_use_id: toolUse.id,
                        content: JSON.stringify(result),
                    };
                } catch (error) {
                    logger.error(`Tool execution failed: ${toolUse.name}`, error as Error);

                    return {
                        type: 'tool_result',
                        tool_use_id: toolUse.id,
                        content: JSON.stringify({
                            error: 'Tool execution failed',
                            message: (error as Error).message,
                        }),
                        is_error: true,
                    };
                }
            })
        );

        // Add assistant's tool use and tool results to conversation
        conversationMessages.push({
            role: 'assistant',
            content: response.content,
        });

        conversationMessages.push({
            role: 'user',
            content: toolResults,
        });

        // Continue conversation with tool results
        response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            temperature: 0.7,
            system: systemPrompt,
            messages: conversationMessages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            tools: RELAY_AGENT_TOOLS as any,
        });
    }

    // Extract final text response
    const textContent = response.content.find(block => block.type === 'text');
    const finalText = textContent?.type === 'text' ? textContent.text : '';

    // SOP 8: No markdown in responses
    const cleanText = finalText
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .trim();

    return {
        content: cleanText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
        },
    };
}

export default {
    agentChat,
};
