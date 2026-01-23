/**
 * LangGraph State Schema for Relay Core Chatbot
 * 
 * Defines the state structure that flows through the graph.
 * This is the single source of truth for conversation state.
 */

import { Annotation } from '@langchain/langgraph';
import type { ChatAction } from '../../types/chat.types.js';

export interface ToolCall {
    name: string;
    input: Record<string, unknown>;
    result?: unknown;
    error?: string;
    executionTimeMs?: number;
    dataSource?: string;
}

export interface RetrievedDocument {
    content: string;
    source: string;
    relevanceScore?: number;
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export type Intent = 'query' | 'execute' | 'explain' | 'simulate' | null;

export const RelayChatStateAnnotation = Annotation.Root({
    messages: Annotation<Message[]>({
        reducer: (current, update) => current.concat(update),
        default: () => [],
    }),

    intent: Annotation<Intent>({
        reducer: (_, update) => update,
        default: () => null,
    }),

    context: Annotation<{
        walletAddress?: string;
        sessionId?: string;
        agentId?: string;
        taskId?: string;
    }>({
        reducer: (current, update) => ({ ...current, ...update }),
        default: () => ({}),
    }),

    toolCalls: Annotation<ToolCall[]>({
        reducer: (current, update) => current.concat(update),
        default: () => [],
    }),

    retrievedDocs: Annotation<RetrievedDocument[]>({
        reducer: (current, update) => current.concat(update),
        default: () => [],
    }),

    requiresApproval: Annotation<boolean>({
        reducer: (_, update) => update,
        default: () => false,
    }),

    approvalActions: Annotation<ChatAction[] | undefined>({
        reducer: (_, update) => update,
        default: () => undefined,
    }),

    error: Annotation<string | undefined>({
        reducer: (_, update) => update,
        default: () => undefined,
    }),

    simulationResult: Annotation<Record<string, unknown> | undefined>({
        reducer: (_, update) => update,
        default: () => undefined,
    }),
});

export type RelayChatState = typeof RelayChatStateAnnotation.State;
