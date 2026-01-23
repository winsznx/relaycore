/**
 * Relay Core Indexer Suite
 * 
 * Main entry point for all indexers. Manages lifecycle of cron jobs
 * with graceful startup and shutdown handling.
 * 
 * Architecture based on Luganodes/Solana-Indexer patterns:
 * - Repository pattern for data access
 * - Cron-based batch processing
 * - Graceful shutdown handling
 * - Event-driven design
 * Manages all blockchain and state indexing cron jobs.
 * Runs in backend Node.js process.
 */

import logger from '../../lib/logger.js';
import { transactionIndexer } from './crons/transaction.cron.js';
import { escrowSessionIndexer } from './crons/escrow.cron.js';
import { paymentIndexer } from './crons/payment.cron.js';
import { agentIndexer } from './crons/agent.cron.js';
import { feedbackIndexer } from './crons/feedback.cron.js';
import { reputationCalculator } from './crons/reputation.cron.js';
import { rwaStateIndexer } from './crons/rwa-state.cron.js';
import { usdcTransferIndexer } from './crons/usdc-transfer.cron.js';

// Track cron handles for cleanup
const cronHandles: { cancel: () => void }[] = [];

/**
 * Initialize and start all indexers.
 */
export function startIndexers() {
    logger.info('Starting Relay Core Indexer Suite');

    try {
        transactionIndexer.start();
        logger.info('✓ Transaction Indexer started (every 1 min)');

        escrowSessionIndexer.start();
        logger.info('✓ Escrow Session Indexer started (every 2 min)');

        paymentIndexer.start();
        logger.info('✓ Payment Indexer started (every 5 min)');

        agentIndexer.start();
        logger.info('✓ Agent Indexer started (every 15 min)');

        feedbackIndexer.start();
        logger.info('✓ Feedback Indexer started (every 15 min)');

        reputationCalculator.start();
        logger.info('✓ Reputation Calculator started (daily at 1:00 AM)');

        rwaStateIndexer.start();
        logger.info('✓ RWA State Indexer started (every 2 min)');

        usdcTransferIndexer.start();
        logger.info('✓ USDC Transfer Indexer started (every 30 sec)');

        logger.info('All indexers started successfully');
    } catch (error) {
        logger.error('Failed to start indexers', error as Error);
        throw error;
    }
}

/**
 * Stop all indexers gracefully.
 */
export async function stopIndexers(): Promise<void> {
    logger.info('Stopping indexers');

    transactionIndexer.stop();
    escrowSessionIndexer.stop();
    paymentIndexer.stop();
    agentIndexer.stop();
    feedbackIndexer.stop();
    reputationCalculator.stop();
    rwaStateIndexer.stop();
    usdcTransferIndexer.stop();

    for (const handle of cronHandles) {
        handle.cancel();
    }

    cronHandles.length = 0;
    logger.info('All indexers stopped');
}

/**
 * Run a specific indexer once (for testing or manual execution).
 */
export async function runIndexer(name: string): Promise<void> {
    switch (name) {
        case 'transaction':
            await transactionIndexer.run();
            break;
        case 'escrow':
            await escrowSessionIndexer.run();
            break;
        case 'payment':
            await paymentIndexer.run();
            break;
        case 'agent':
            await agentIndexer.run();
            break;
        case 'feedback':
            await feedbackIndexer.run();
            break;
        case 'reputation':
            await reputationCalculator.run();
            break;
        case 'usdc':
        case 'usdc-transfer':
            await usdcTransferIndexer.run();
            break;
        case 'rwa':
        case 'rwa-state':
            await rwaStateIndexer.run();
            break;
        default:
            throw new Error(`Unknown indexer: ${name}`);
    }
}

/**
 * Run all indexers once (for testing or manual execution).
 */
export async function runAllIndexers(): Promise<void> {
    logger.info('Running all indexers once');
    await transactionIndexer.run();
    await escrowSessionIndexer.run();
    await paymentIndexer.run();
    await agentIndexer.run();
    await feedbackIndexer.run();
    await reputationCalculator.run();
    logger.info('All indexers completed');
}

export {
    transactionIndexer,
    escrowSessionIndexer,
    paymentIndexer,
    agentIndexer,
    feedbackIndexer,
    reputationCalculator,
    rwaStateIndexer,
    usdcTransferIndexer
};

if (typeof process !== 'undefined' && process.on) {
    process.on('SIGINT', async () => {
        console.log('\nShutting down indexers...');
        await stopIndexers();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\nShutting down indexers...');
        await stopIndexers();
        process.exit(0);
    });
}

if (typeof window === 'undefined' && process.argv[1]?.includes('indexer')) {
    try {
        startIndexers();
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

