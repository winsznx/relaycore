/**
 * LangGraph Chatbot Tests
 * 
 * Integration tests for the complete chatbot flow.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { processChat } from '../services/chat/index.js';

describe('LangGraph Chatbot', () => {
    const testWallet = '0x742d35Cc6634C0532925a3b844Bc9e7595f0b5f1';

    describe('Query Intent', () => {
        it('should handle price queries', async () => {
            const result = await processChat(
                'What is the current BTC price?',
                { walletAddress: testWallet }
            );

            expect(result.response).toBeTruthy();
            expect(result.error).toBeUndefined();
            expect(result.toolCalls).toBeDefined();
            expect(result.toolCalls?.some(tc => tc.name === 'get_market_price')).toBe(true);
        }, 30000);

        it('should handle service discovery', async () => {
            const result = await processChat(
                'Find trading services',
                { walletAddress: testWallet }
            );

            expect(result.response).toBeTruthy();
            expect(result.error).toBeUndefined();
        }, 30000);
    });

    describe('Execute Intent', () => {
        it('should require approval for payments', async () => {
            const result = await processChat(
                'Pay 10 USDC to service xyz',
                { walletAddress: testWallet }
            );

            expect(result.response).toBeTruthy();
            expect(result.requiresApproval).toBe(true);
            expect(result.approvalActions).toBeDefined();
        }, 30000);
    });

    describe('Simulate Intent', () => {
        it('should simulate payments', async () => {
            const result = await processChat(
                'Simulate paying 5 USDC to service abc',
                { walletAddress: testWallet }
            );

            expect(result.response).toBeTruthy();
            expect(result.error).toBeUndefined();
        }, 30000);
    });

    describe('Explain Intent', () => {
        it('should explain system state', async () => {
            const result = await processChat(
                'Explain my recent transactions',
                { walletAddress: testWallet }
            );

            expect(result.response).toBeTruthy();
            expect(result.error).toBeUndefined();
        }, 30000);
    });

    describe('Error Handling', () => {
        it('should handle empty messages', async () => {
            const result = await processChat('', { walletAddress: testWallet });

            expect(result.error).toBeTruthy();
        });

        it('should handle missing wallet gracefully', async () => {
            const result = await processChat('What is BTC price?');

            expect(result.response).toBeTruthy();
        }, 30000);
    });

    describe('Tool Execution', () => {
        it('should execute tools and return metadata', async () => {
            const result = await processChat(
                'Get BTC price',
                { walletAddress: testWallet }
            );

            if (result.toolCalls && result.toolCalls.length > 0) {
                const toolCall = result.toolCalls[0];
                expect(toolCall.name).toBeTruthy();
                expect(toolCall.result).toBeDefined();
                expect(toolCall.executionTimeMs).toBeGreaterThan(0);
                expect(toolCall.dataSource).toBeTruthy();
            }
        }, 30000);
    });
});
