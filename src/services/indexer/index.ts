/**
 * Relay Core Indexer Suite
 * 
 * Main entry point for all indexers. Manages lifecycle of cron jobs
 * with graceful startup and shutdown handling.
 */

import schedule from 'node-schedule';
import logger from '../../lib/logger.js';
import { paymentIndexer } from './crons/payment.cron.js';
import { agentIndexer } from './crons/agent.cron.js';
import { feedbackIndexer } from './crons/feedback.cron.js';
import { reputationCalculator } from './crons/reputation.cron.js';

const cronHandles: schedule.Job[] = [];

/**
 * Initialize and start all indexers.
 */
export async function startIndexers(): Promise<void> {
    logger.info('Starting Relay Core indexers');

    try {
        cronHandles.push(paymentIndexer.start());
        cronHandles.push(agentIndexer.start());
        cronHandles.push(feedbackIndexer.start());
        cronHandles.push(reputationCalculator.start());

        logger.info('All indexers started', { count: cronHandles.length });

        console.log('\nRelay Core Indexer Suite Active');
        console.log('================================');
        console.log('  Payment Indexer:      every 5 minutes');
        console.log('  Agent Indexer:        every 15 minutes');
        console.log('  Feedback Indexer:     every 15 minutes');
        console.log('  Reputation Calc:      daily at 1:00 AM');
        console.log('');
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

    paymentIndexer.stop();
    agentIndexer.stop();
    feedbackIndexer.stop();
    reputationCalculator.stop();

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
        default:
            throw new Error(`Unknown indexer: ${name}`);
    }
}

/**
 * Run all indexers once (for testing or manual execution).
 */
export async function runAllIndexers(): Promise<void> {
    logger.info('Running all indexers once');
    await paymentIndexer.run();
    await agentIndexer.run();
    await feedbackIndexer.run();
    await reputationCalculator.run();
    logger.info('All indexers completed');
}

export { paymentIndexer, agentIndexer, feedbackIndexer, reputationCalculator };

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
    startIndexers().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
