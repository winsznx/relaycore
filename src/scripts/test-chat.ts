/**
 * Quick Test Script for LangGraph Chatbot
 * 
 * Tests the chatbot without requiring full build.
 * Run with: tsx src/scripts/test-chat.ts
 */

import { processChat } from '../services/chat/graph.js';
import { logger } from '../lib/logger.js';

async function testChat() {
    console.log('\n🧪 Testing LangGraph Chatbot...\n');

    const testCases = [
        {
            name: 'Simple Query',
            message: 'What is the current BTC price?',
            wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0b5f1',
        },
        {
            name: 'Service Discovery',
            message: 'Find trading services',
            wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0b5f1',
        },
        {
            name: 'Approval Required',
            message: 'Pay 100 USDC to service xyz',
            wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0b5f1',
        },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
        try {
            console.log(`\n📝 Test: ${test.name}`);
            console.log(`   Message: "${test.message}"`);

            const result = await processChat(test.message, {
                walletAddress: test.wallet,
            });

            if (result.error) {
                console.log(`   ❌ FAILED: ${result.error}`);
                failed++;
            } else {
                console.log(`   ✅ PASSED`);
                console.log(`   Response: ${result.response.substring(0, 100)}...`);
                if (result.toolCalls && result.toolCalls.length > 0) {
                    console.log(`   Tools called: ${result.toolCalls.map(t => t.name).join(', ')}`);
                }
                if (result.requiresApproval) {
                    console.log(`   ⚠️  Requires approval`);
                }
                passed++;
            }
        } catch (error) {
            console.log(`   ❌ ERROR: ${(error as Error).message}`);
            failed++;
        }
    }

    console.log(`\n\n📊 Results: ${passed} passed, ${failed} failed\n`);

    if (failed === 0) {
        console.log('✅ All tests passed!\n');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed\n');
        process.exit(1);
    }
}

testChat().catch(error => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
});
