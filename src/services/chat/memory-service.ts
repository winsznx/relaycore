/**
 * Memory Persistence Service
 * 
 * Manages conversation history storage and retrieval in Supabase.
 * Implements short-term and long-term memory strategies.
 */

import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import type { Message } from './graph-state.js';

interface ConversationRecord {
    id: string;
    wallet_address: string;
    session_id: string;
    messages: Message[];
    summary?: string;
    created_at: string;
    updated_at: string;
}

export class MemoryService {
    private readonly TABLE_NAME = 'chat_conversations';
    private readonly MAX_MESSAGES_BEFORE_SUMMARY = 20;

    /**
     * Store conversation turn
     */
    async storeConversation(
        walletAddress: string,
        sessionId: string,
        messages: Message[]
    ): Promise<void> {
        try {
            // Check if conversation exists
            const { data: existing } = await supabase
                .from(this.TABLE_NAME)
                .select('*')
                .eq('wallet_address', walletAddress.toLowerCase())
                .eq('session_id', sessionId)
                .single();

            if (existing) {
                // Update existing conversation
                const updatedMessages = [...existing.messages, ...messages];

                // Generate summary if needed
                let summary = existing.summary;
                if (updatedMessages.length > this.MAX_MESSAGES_BEFORE_SUMMARY) {
                    summary = await this.generateSummary(updatedMessages);
                }

                await supabase
                    .from(this.TABLE_NAME)
                    .update({
                        messages: updatedMessages,
                        summary,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);

                logger.info('Conversation updated', {
                    sessionId,
                    messageCount: updatedMessages.length,
                    hasSummary: !!summary,
                });
            } else {
                // Create new conversation
                await supabase
                    .from(this.TABLE_NAME)
                    .insert({
                        wallet_address: walletAddress.toLowerCase(),
                        session_id: sessionId,
                        messages,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });

                logger.info('Conversation created', {
                    sessionId,
                    messageCount: messages.length,
                });
            }
        } catch (error) {
            logger.error('Failed to store conversation', error as Error);
        }
    }

    /**
     * Retrieve conversation history
     */
    async retrieveConversation(
        walletAddress: string,
        sessionId: string
    ): Promise<Message[]> {
        try {
            const { data, error } = await supabase
                .from(this.TABLE_NAME)
                .select('messages, summary')
                .eq('wallet_address', walletAddress.toLowerCase())
                .eq('session_id', sessionId)
                .single();

            if (error || !data) {
                return [];
            }

            // Return last 10 messages + summary as context
            const messages = data.messages || [];
            const recentMessages = messages.slice(-10);

            if (data.summary && messages.length > 10) {
                // Prepend summary as system message
                return [
                    {
                        role: 'system',
                        content: `Previous conversation summary: ${data.summary}`,
                    },
                    ...recentMessages,
                ];
            }

            return recentMessages;
        } catch (error) {
            logger.error('Failed to retrieve conversation', error as Error);
            return [];
        }
    }

    /**
     * Generate summary of conversation
     */
    private async generateSummary(messages: Message[]): Promise<string> {
        // Simple summary for now - in production, use LLM
        const userMessages = messages.filter(m => m.role === 'user').length;
        const assistantMessages = messages.filter(m => m.role === 'assistant').length;

        return `Conversation with ${userMessages} user messages and ${assistantMessages} assistant responses. Topics discussed: ${this.extractTopics(messages).join(', ')}.`;
    }

    /**
     * Extract topics from messages (simple keyword extraction)
     */
    private extractTopics(messages: Message[]): string[] {
        const keywords = new Set<string>();
        const commonWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but'];

        messages.forEach(msg => {
            const words = msg.content
                .toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3 && !commonWords.includes(w));

            words.forEach(w => keywords.add(w));
        });

        return Array.from(keywords).slice(0, 5);
    }

    /**
     * Clear old conversations (cleanup)
     */
    async clearOldConversations(daysOld: number = 30): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const { data, error } = await supabase
                .from(this.TABLE_NAME)
                .delete()
                .lt('updated_at', cutoffDate.toISOString())
                .select();

            if (error) throw error;

            const deletedCount = data?.length || 0;
            logger.info('Old conversations cleared', { deletedCount, daysOld });

            return deletedCount;
        } catch (error) {
            logger.error('Failed to clear old conversations', error as Error);
            return 0;
        }
    }
}

export const memoryService = new MemoryService();
